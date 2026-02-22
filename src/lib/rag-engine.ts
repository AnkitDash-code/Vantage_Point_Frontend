/**
 * RAG Engine for VALORANT Scouting Intelligence
 *
 * TypeScript port of the Python rag_engine.py — uses Jina embeddings
 * for semantic retrieval and cosine similarity search over in-memory vectors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbeddingResponse {
  data: { embedding: number[] }[];
}

interface DocumentChunk {
  text: string;
  source: string;
  embedding: number[];
}

interface TeamData {
  team_name: string;
  matches_analyzed: number;
  metrics: Record<string, unknown>;
  insights: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const JINA_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v3";
const JINA_BATCH_SIZE = 64;
const MAX_INPUT_CHARS = 800;
const SEMANTIC_MAX_CHARS = 800;
const SEMANTIC_MIN_CHARS = 150;
const SEMANTIC_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Singleton state (persists across requests in the same server process)
// ---------------------------------------------------------------------------

let _chunks: DocumentChunk[] = [];
let _initialized = false;
let _initializing: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// ---------------------------------------------------------------------------
// Jina Embedding API
// ---------------------------------------------------------------------------

async function jinaRequest(
  inputs: string[],
  task: string,
  apiKey: string,
): Promise<number[][]> {
  const response = await fetch(JINA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      task,
      late_chunking: false,
      input: inputs.map((t) => t.slice(0, MAX_INPUT_CHARS)),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jina API error: ${response.status} - ${text}`);
  }

  const data: EmbeddingResponse = await response.json();
  return data.data.map((item) => item.embedding);
}

async function embedTexts(
  texts: string[],
  task: string,
  apiKey: string,
): Promise<number[][]> {
  if (!texts.length) return [];

  const trimmed = texts
    .map((t) => t.slice(0, MAX_INPUT_CHARS))
    .filter((t) => t.trim().length > 0);
  if (!trimmed.length) return [];

  const results: number[][] = [];
  for (let start = 0; start < trimmed.length; start += JINA_BATCH_SIZE) {
    const batch = trimmed.slice(start, start + JINA_BATCH_SIZE);
    const batchEmbeddings = await jinaRequest(batch, task, apiKey);
    results.push(...batchEmbeddings);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Text splitting
// ---------------------------------------------------------------------------

function sentenceCandidates(text: string): string[] {
  // Split on sentence boundaries: period, exclamation, question mark, or newlines
  const raw = text.split(/(?<=[.!?])\s+|\n{2,}/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 10);
}

async function semanticSplit(
  text: string,
  apiKey: string,
): Promise<string[]> {
  const candidates = sentenceCandidates(text);
  if (candidates.length <= 1) return candidates;

  // For small texts, skip embedding-based splitting
  if (text.length < SEMANTIC_MIN_CHARS * 2) return [text];

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(candidates, "retrieval.passage", apiKey);
  } catch {
    // Fallback: split by fixed size if embeddings fail
    return fixedSplit(text);
  }

  if (embeddings.length !== candidates.length) return fixedSplit(text);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  let prevVector: number[] | null = null;

  for (let idx = 0; idx < candidates.length; idx++) {
    const sentence = candidates[idx];
    const vector = embeddings[idx];

    if (!current.length) {
      current = [sentence];
      currentLen = sentence.length;
      prevVector = vector;
      continue;
    }

    const similarity = prevVector ? cosineSimilarity(prevVector, vector) : 1;
    const wouldExceed = currentLen + sentence.length > SEMANTIC_MAX_CHARS;
    const shouldSplit =
      similarity < SEMANTIC_THRESHOLD && currentLen >= SEMANTIC_MIN_CHARS;

    if (wouldExceed || shouldSplit) {
      chunks.push(current.join(" ").trim());
      current = [sentence];
      currentLen = sentence.length;
    } else {
      current.push(sentence);
      currentLen += sentence.length + 1;
    }
    prevVector = vector;
  }

  if (current.length) chunks.push(current.join(" ").trim());
  return chunks.filter((c) => c.length > 0);
}

function fixedSplit(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += SEMANTIC_MAX_CHARS) {
    const chunk = text.slice(i, i + SEMANTIC_MAX_CHARS).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Document ingestion — convert precomputed team JSON to text chunks
// ---------------------------------------------------------------------------

function teamDataToTextChunks(data: TeamData): string[] {
  const chunks: string[] = [];
  const teamName = data.team_name;

  // Metrics summary chunk
  const m = data.metrics;
  if (m) {
    const winRate = m.win_rate as number;
    const sideMetrics = m.side_metrics as Record<string, number> | undefined;
    const firstDuel = m.first_duel as Record<string, unknown> | undefined;
    const combatMetrics = m.combat_metrics as Record<string, unknown> | undefined;
    const roundPerf = m.round_type_performance as Record<string, Record<string, number>> | undefined;
    const sitePref = m.site_preferences as Record<string, number> | undefined;

    let overview = `${teamName} Team Overview:\n`;
    overview += `Overall Win Rate: ${winRate}%\n`;

    if (sideMetrics) {
      overview += `Attack Win Rate: ${sideMetrics.attack_win_rate}% (${sideMetrics.attack_rounds} rounds)\n`;
      overview += `Defense Win Rate: ${sideMetrics.defense_win_rate}% (${sideMetrics.defense_rounds} rounds)\n`;
      overview += `Attack K/D: ${sideMetrics.attack_kd}, Defense K/D: ${sideMetrics.defense_kd}\n`;
    }

    if (firstDuel) {
      overview += `First Kill Rate: ${firstDuel.team_first_kill_rate}%\n`;
      overview += `First Kill Conversion: ${firstDuel.first_kill_conversion_rate}%\n`;
    }

    if (combatMetrics) {
      overview += `Trade Efficiency: ${combatMetrics.trade_efficiency}%\n`;
    }

    if (roundPerf) {
      const pistol = roundPerf.pistol;
      const eco = roundPerf.eco;
      const fullBuy = roundPerf.full_buy;
      if (pistol) overview += `Pistol Win Rate: ${pistol.win_rate}%\n`;
      if (eco) overview += `Eco Win Rate: ${eco.win_rate}%\n`;
      if (fullBuy) overview += `Full Buy Win Rate: ${fullBuy.win_rate}%\n`;
    }

    if (sitePref) {
      overview += `Site Preferences: ${Object.entries(sitePref)
        .map(([s, p]) => `${s}-Site ${p}%`)
        .join(", ")}\n`;
    }

    chunks.push(overview);

    // Map win rates chunk
    const mapWr = m.win_rate_by_map as Record<string, number> | undefined;
    if (mapWr && Object.keys(mapWr).length) {
      let mapText = `${teamName} Map Win Rates:\n`;
      for (const [map, wr] of Object.entries(mapWr)) {
        mapText += `${map}: ${wr}%\n`;
      }
      chunks.push(mapText);
    }

    // Map detailed chunk
    const mapDetailed = m.map_detailed as Record<string, Record<string, unknown>> | undefined;
    if (mapDetailed) {
      for (const [map, stats] of Object.entries(mapDetailed)) {
        let mapChunk = `${teamName} on ${map}:\n`;
        mapChunk += `Rounds Played: ${stats.rounds_played}, Win Rate: ${stats.win_rate}%\n`;
        mapChunk += `Attack: ${stats.attack_win_rate}% (${stats.attack_rounds} rounds)\n`;
        mapChunk += `Defense: ${stats.defense_win_rate}% (${stats.defense_rounds} rounds)\n`;
        mapChunk += `Top Agent: ${stats.top_agent}\n`;
        chunks.push(mapChunk);
      }
    }

    // Player tendencies chunks
    const players = m.player_tendencies as Array<Record<string, unknown>> | undefined;
    if (players?.length) {
      let playerText = `${teamName} Player Stats:\n`;
      for (const p of players) {
        playerText += `${p.player}: KD ${p.kd_ratio}, Avg Kills ${p.avg_kills}, `;
        playerText += `Top Agent ${p.top_agent} (${p.top_agent_rate}%), First Kill Rate ${p.first_kill_rate}%\n`;
      }
      chunks.push(playerText);
    }

    // Agent composition chunk
    const agents = m.agent_composition as Array<Record<string, unknown>> | undefined;
    if (agents?.length) {
      let agentText = `${teamName} Agent Composition:\n`;
      for (const a of agents) {
        agentText += `${a.agent}: ${a.pick_rate}% pick rate (${a.pick_count} picks)\n`;
      }
      const roleDist = m.role_distribution as Record<string, number> | undefined;
      if (roleDist) {
        agentText += `Role Distribution: ${Object.entries(roleDist)
          .map(([r, p]) => `${r} ${p}%`)
          .join(", ")}\n`;
      }
      chunks.push(agentText);
    }

    // Combat metrics chunk
    if (combatMetrics) {
      let combatText = `${teamName} Combat Metrics:\n`;
      combatText += `Trade Efficiency: ${combatMetrics.trade_efficiency}%\n`;
      combatText += `Total Kills Analyzed: ${combatMetrics.total_kills_analyzed}\n`;

      const clutchers = combatMetrics.clutch_performers as Array<Record<string, unknown>> | undefined;
      if (clutchers?.length) {
        combatText += `Top Clutch Players:\n`;
        for (const c of clutchers.slice(0, 3)) {
          combatText += `  ${c.player}: ${c.clutches_won}/${c.clutches_faced} clutches (${c.clutch_rate}%)\n`;
        }
      }

      const multiKillers = combatMetrics.multi_killers as Array<Record<string, unknown>> | undefined;
      if (multiKillers?.length) {
        combatText += `Top Multi-Kill Players:\n`;
        for (const mk of multiKillers.slice(0, 3)) {
          combatText += `  ${mk.player}: ${mk.total} multi-kills (2K: ${mk["2k"]}, 3K: ${mk["3k"]}, 4K: ${mk["4k"]})\n`;
        }
      }
      chunks.push(combatText);
    }

    // Opponent stats chunk
    const opponents = m.opponent_stats as Array<Record<string, unknown>> | undefined;
    if (opponents?.length) {
      let oppText = `${teamName} Opponent Record:\n`;
      for (const o of opponents) {
        oppText += `vs ${o.opponent}: ${o.win_rate}% win rate (${o.matches} matches, ${o.rounds_played} rounds)\n`;
      }
      chunks.push(oppText);
    }
  }

  // Insights chunks (already rich LLM-generated text)
  if (data.insights) {
    for (const [section, content] of Object.entries(data.insights)) {
      if (content && content.length > 0) {
        // Prefix with team name and section for better retrieval
        chunks.push(`${teamName} ${section} Scouting Report:\n${content}`);
      }
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Knowledge base initialization
// ---------------------------------------------------------------------------

async function loadAllTeamData(): Promise<TeamData[]> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const teamsDir = path.join(process.cwd(), "public", "precomputed", "teams");

  let files: string[];
  try {
    files = await fs.readdir(teamsDir);
  } catch {
    console.warn("[RAG] No precomputed teams directory found");
    return [];
  }

  const teams: TeamData[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(teamsDir, file), "utf-8");
      teams.push(JSON.parse(raw));
    } catch (e) {
      console.warn(`[RAG] Failed to load ${file}:`, e);
    }
  }
  return teams;
}

// ---------------------------------------------------------------------------
// Embedding cache — avoids re-calling Jina on every cold start
// ---------------------------------------------------------------------------

const CACHE_FILENAME = "rag-embeddings.json";
const PREBUILT_CACHE = "rag-cache.json"; // committed to repo

interface EmbeddingCache {
  hash: string;
  chunks: DocumentChunk[];
}

async function computeDataHash(teams: TeamData[]): Promise<string> {
  // Create a stable string from all team data to detect changes
  const crypto = await import("crypto");
  const raw = JSON.stringify(
    teams.map((t) => ({ n: t.team_name, m: t.matches_analyzed })).sort((a, b) =>
      a.n.localeCompare(b.n),
    ),
  );
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

async function getDevCachePath(): Promise<string> {
  const path = await import("path");
  return path.join(process.cwd(), ".next", "cache", CACHE_FILENAME);
}

async function getPrebuiltCachePath(): Promise<string> {
  const path = await import("path");
  return path.join(process.cwd(), "public", "precomputed", PREBUILT_CACHE);
}

async function loadEmbeddingCache(hash: string): Promise<DocumentChunk[] | null> {
  const fs = await import("fs/promises");

  // 1. Try pre-built cache (committed to repo — instant on any host)
  try {
    const prebuiltPath = await getPrebuiltCachePath();
    const raw = await fs.readFile(prebuiltPath, "utf-8");
    const cache: EmbeddingCache = JSON.parse(raw);
    if (cache.hash === hash && cache.chunks?.length > 0) {
      console.log("[RAG] Using pre-built cache from public/precomputed/");
      return cache.chunks;
    }
    console.log("[RAG] Pre-built cache hash mismatch");
  } catch {
    // No pre-built cache — continue to dev cache
  }

  // 2. Try dev cache (.next/cache/ — survives dev server restarts)
  try {
    const devPath = await getDevCachePath();
    const raw = await fs.readFile(devPath, "utf-8");
    const cache: EmbeddingCache = JSON.parse(raw);
    if (cache.hash === hash && cache.chunks?.length > 0) {
      return cache.chunks;
    }
    console.log("[RAG] Dev cache hash mismatch — rebuilding");
  } catch {
    // No dev cache either
  }

  return null;
}

async function saveEmbeddingCache(hash: string, chunks: DocumentChunk[]): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  try {
    const cachePath = await getDevCachePath();
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    const cache: EmbeddingCache = { hash, chunks };
    await fs.writeFile(cachePath, JSON.stringify(cache));
    console.log(`[RAG] Saved embedding cache (${chunks.length} chunks)`);
  } catch (e) {
    console.warn("[RAG] Failed to save cache:", e);
  }
}

// ---------------------------------------------------------------------------
// Build knowledge base (with cache)
// ---------------------------------------------------------------------------

async function buildKnowledgeBase(jinaApiKey: string): Promise<void> {
  if (_initialized) return;
  if (_initializing) {
    await _initializing;
    return;
  }

  _initializing = (async () => {
    console.log("[RAG] Building knowledge base...");
    const startTime = Date.now();

    const teams = await loadAllTeamData();
    if (!teams.length) {
      console.warn("[RAG] No team data found");
      _initialized = true;
      return;
    }

    // Check disk cache first
    const dataHash = await computeDataHash(teams);
    const cached = await loadEmbeddingCache(dataHash);
    if (cached) {
      _chunks = cached;
      _initialized = true;
      console.log(`[RAG] Loaded ${cached.length} chunks from cache in ${Date.now() - startTime}ms`);
      return;
    }

    // Convert all team data to text chunks
    const allTexts: { text: string; source: string }[] = [];
    for (const team of teams) {
      const textChunks = teamDataToTextChunks(team);
      for (const text of textChunks) {
        allTexts.push({ text, source: team.team_name });
      }
    }

    console.log(`[RAG] Created ${allTexts.length} text chunks from ${teams.length} teams`);

    // For large insight texts, apply fixed splitting to keep chunks manageable
    const finalTexts: { text: string; source: string }[] = [];
    for (const item of allTexts) {
      if (item.text.length > SEMANTIC_MAX_CHARS * 2) {
        const splits = fixedSplit(item.text);
        for (const split of splits) {
          finalTexts.push({ text: split, source: item.source });
        }
      } else {
        finalTexts.push(item);
      }
    }

    console.log(`[RAG] ${finalTexts.length} chunks after splitting`);

    // Embed all chunks
    const texts = finalTexts.map((t) => t.text);
    let embeddings: number[][];
    try {
      embeddings = await embedTexts(texts, "retrieval.passage", jinaApiKey);
    } catch (e) {
      console.error("[RAG] Failed to embed documents:", e);
      // Store chunks without embeddings — will fall back to keyword search
      _chunks = finalTexts.map((t) => ({
        text: t.text,
        source: t.source,
        embedding: [],
      }));
      _initialized = true;
      return;
    }

    _chunks = finalTexts.map((t, i) => ({
      text: t.text,
      source: t.source,
      embedding: embeddings[i] || [],
    }));

    // Save to disk cache for next startup
    await saveEmbeddingCache(dataHash, _chunks);

    _initialized = true;
    console.log(`[RAG] Knowledge base built in ${Date.now() - startTime}ms with ${_chunks.length} embedded chunks`);
  })();

  await _initializing;
  _initializing = null;
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

async function retrieveContext(
  query: string,
  jinaApiKey: string,
  k: number = 5,
  teamFilter?: string,
): Promise<string[]> {
  await buildKnowledgeBase(jinaApiKey);

  if (!_chunks.length) return [];

  // Check if we have embeddings available
  const hasEmbeddings = _chunks.some((c) => c.embedding.length > 0);

  if (hasEmbeddings) {
    // Semantic search
    let queryEmbedding: number[];
    try {
      const embeddings = await embedTexts([query], "retrieval.query", jinaApiKey);
      queryEmbedding = embeddings[0];
    } catch {
      // Fall back to keyword search
      return keywordSearch(query, k, teamFilter);
    }

    if (!queryEmbedding?.length) return keywordSearch(query, k, teamFilter);

    // Score all chunks with cosine similarity
    let scored = _chunks
      .filter((c) => c.embedding.length > 0)
      .map((chunk) => ({
        text: chunk.text,
        source: chunk.source,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }));

    // Optionally filter by team
    if (teamFilter) {
      const filter = teamFilter.toLowerCase();
      const teamChunks = scored.filter((s) =>
        s.source.toLowerCase().includes(filter),
      );
      // If we have enough team-specific chunks, prefer them
      if (teamChunks.length >= k) {
        scored = teamChunks;
      }
    }

    // Sort by score descending and return top-k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.text);
  }

  // Fallback: keyword search
  return keywordSearch(query, k, teamFilter);
}

function keywordSearch(
  query: string,
  k: number,
  teamFilter?: string,
): string[] {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let candidates = _chunks;
  if (teamFilter) {
    const filter = teamFilter.toLowerCase();
    const teamCandidates = candidates.filter((c) =>
      c.source.toLowerCase().includes(filter),
    );
    if (teamCandidates.length > 0) candidates = teamCandidates;
  }

  const scored = candidates.map((chunk) => {
    const lower = chunk.text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      const regex = new RegExp(word, "gi");
      const matches = lower.match(regex);
      score += matches ? matches.length : 0;
    }
    return { text: chunk.text, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, k)
    .filter((s) => s.score > 0)
    .map((s) => s.text);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const RAGEngine = {
  retrieveContext,
  buildKnowledgeBase,
  cosineSimilarity,
  embedTexts,
};

export type { TeamData, DocumentChunk };
