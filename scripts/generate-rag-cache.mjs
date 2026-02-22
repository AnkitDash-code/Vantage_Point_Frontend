#!/usr/bin/env node
/**
 * Pre-generate RAG embedding cache for deployment.
 *
 * Reads all precomputed team JSON files, chunks the text, embeds via Jina,
 * and writes the cache to public/precomputed/rag-cache.json so it ships
 * with the repo — zero cold-start delay on any host.
 *
 * Usage:
 *   node scripts/generate-rag-cache.mjs
 *
 * Requires JINA_API_KEY in .env or .env.local
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { config } from "dotenv";

// Load .env.local then .env
config({ path: ".env.local" });
config({ path: ".env" });

const JINA_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v3";
const JINA_BATCH_SIZE = 64;
const MAX_INPUT_CHARS = 800;
const SEMANTIC_MAX_CHARS = 800;

const JINA_API_KEY = process.env.JINA_API_KEY;
if (!JINA_API_KEY) {
    console.error("❌ JINA_API_KEY not found in .env or .env.local");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Jina embedding
// ---------------------------------------------------------------------------

async function jinaRequest(inputs, task) {
    const response = await fetch(JINA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JINA_API_KEY}`,
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

    const data = await response.json();
    return data.data.map((item) => item.embedding);
}

async function embedTexts(texts, task) {
    if (!texts.length) return [];
    const trimmed = texts.map((t) => t.slice(0, MAX_INPUT_CHARS)).filter((t) => t.trim().length > 0);
    if (!trimmed.length) return [];

    const results = [];
    for (let start = 0; start < trimmed.length; start += JINA_BATCH_SIZE) {
        const batch = trimmed.slice(start, start + JINA_BATCH_SIZE);
        console.log(`  📡 Embedding batch ${Math.floor(start / JINA_BATCH_SIZE) + 1}/${Math.ceil(trimmed.length / JINA_BATCH_SIZE)} (${batch.length} texts)`);
        const batchEmbeddings = await jinaRequest(batch, task);
        results.push(...batchEmbeddings);
    }
    return results;
}

// ---------------------------------------------------------------------------
// Text chunking (mirrors rag-engine.ts logic)
// ---------------------------------------------------------------------------

function fixedSplit(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += SEMANTIC_MAX_CHARS) {
        const chunk = text.slice(i, i + SEMANTIC_MAX_CHARS).trim();
        if (chunk) chunks.push(chunk);
    }
    return chunks;
}

function teamDataToTextChunks(data) {
    const chunks = [];
    const teamName = data.team_name;
    const m = data.metrics;

    if (m) {
        let overview = `${teamName} Team Overview:\n`;
        overview += `Overall Win Rate: ${m.win_rate}%\n`;

        if (m.side_metrics) {
            overview += `Attack Win Rate: ${m.side_metrics.attack_win_rate}% (${m.side_metrics.attack_rounds} rounds)\n`;
            overview += `Defense Win Rate: ${m.side_metrics.defense_win_rate}% (${m.side_metrics.defense_rounds} rounds)\n`;
            overview += `Attack K/D: ${m.side_metrics.attack_kd}, Defense K/D: ${m.side_metrics.defense_kd}\n`;
        }
        if (m.first_duel) {
            overview += `First Kill Rate: ${m.first_duel.team_first_kill_rate}%\n`;
            overview += `First Kill Conversion: ${m.first_duel.first_kill_conversion_rate}%\n`;
        }
        if (m.combat_metrics) {
            overview += `Trade Efficiency: ${m.combat_metrics.trade_efficiency}%\n`;
        }
        if (m.round_type_performance) {
            const rp = m.round_type_performance;
            if (rp.pistol) overview += `Pistol Win Rate: ${rp.pistol.win_rate}%\n`;
            if (rp.eco) overview += `Eco Win Rate: ${rp.eco.win_rate}%\n`;
            if (rp.full_buy) overview += `Full Buy Win Rate: ${rp.full_buy.win_rate}%\n`;
        }
        if (m.site_preferences) {
            overview += `Site Preferences: ${Object.entries(m.site_preferences).map(([s, p]) => `${s}-Site ${p}%`).join(", ")}\n`;
        }
        chunks.push(overview);

        if (m.win_rate_by_map && Object.keys(m.win_rate_by_map).length) {
            let mapText = `${teamName} Map Win Rates:\n`;
            for (const [map, wr] of Object.entries(m.win_rate_by_map)) {
                mapText += `${map}: ${wr}%\n`;
            }
            chunks.push(mapText);
        }

        if (m.map_detailed) {
            for (const [map, stats] of Object.entries(m.map_detailed)) {
                let mc = `${teamName} on ${map}:\n`;
                mc += `Rounds Played: ${stats.rounds_played}, Win Rate: ${stats.win_rate}%\n`;
                mc += `Attack: ${stats.attack_win_rate}% (${stats.attack_rounds} rounds)\n`;
                mc += `Defense: ${stats.defense_win_rate}% (${stats.defense_rounds} rounds)\n`;
                mc += `Top Agent: ${stats.top_agent}\n`;
                chunks.push(mc);
            }
        }

        if (m.player_tendencies?.length) {
            let pt = `${teamName} Player Stats:\n`;
            for (const p of m.player_tendencies) {
                pt += `${p.player}: KD ${p.kd_ratio}, Avg Kills ${p.avg_kills}, Top Agent ${p.top_agent} (${p.top_agent_rate}%), First Kill Rate ${p.first_kill_rate}%\n`;
            }
            chunks.push(pt);
        }

        if (m.agent_composition?.length) {
            let at = `${teamName} Agent Composition:\n`;
            for (const a of m.agent_composition) {
                at += `${a.agent}: ${a.pick_rate}% pick rate (${a.pick_count} picks)\n`;
            }
            if (m.role_distribution) {
                at += `Role Distribution: ${Object.entries(m.role_distribution).map(([r, p]) => `${r} ${p}%`).join(", ")}\n`;
            }
            chunks.push(at);
        }

        if (m.combat_metrics) {
            let ct = `${teamName} Combat Metrics:\n`;
            ct += `Trade Efficiency: ${m.combat_metrics.trade_efficiency}%\n`;
            ct += `Total Kills Analyzed: ${m.combat_metrics.total_kills_analyzed}\n`;
            if (m.combat_metrics.clutch_performers?.length) {
                ct += `Top Clutch Players:\n`;
                for (const c of m.combat_metrics.clutch_performers.slice(0, 3)) {
                    ct += `  ${c.player}: ${c.clutches_won}/${c.clutches_faced} clutches (${c.clutch_rate}%)\n`;
                }
            }
            if (m.combat_metrics.multi_killers?.length) {
                ct += `Top Multi-Kill Players:\n`;
                for (const mk of m.combat_metrics.multi_killers.slice(0, 3)) {
                    ct += `  ${mk.player}: ${mk.total} multi-kills (2K: ${mk["2k"]}, 3K: ${mk["3k"]}, 4K: ${mk["4k"]})\n`;
                }
            }
            chunks.push(ct);
        }

        if (m.opponent_stats?.length) {
            let ot = `${teamName} Opponent Record:\n`;
            for (const o of m.opponent_stats) {
                ot += `vs ${o.opponent}: ${o.win_rate}% win rate (${o.matches} matches, ${o.rounds_played} rounds)\n`;
            }
            chunks.push(ot);
        }
    }

    if (data.insights) {
        for (const [section, content] of Object.entries(data.insights)) {
            if (content && content.length > 0) {
                chunks.push(`${teamName} ${section} Scouting Report:\n${content}`);
            }
        }
    }

    return chunks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const startTime = Date.now();
    console.log("🔧 Generating RAG embedding cache...\n");

    // Load team data
    const teamsDir = join(process.cwd(), "public", "precomputed", "teams");
    let files;
    try {
        files = await readdir(teamsDir);
    } catch {
        console.error("❌ No precomputed/teams directory found");
        process.exit(1);
    }

    const teams = [];
    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
            const raw = await readFile(join(teamsDir, file), "utf-8");
            teams.push(JSON.parse(raw));
        } catch (e) {
            console.warn(`⚠ Failed to load ${file}:`, e.message);
        }
    }

    console.log(`📂 Loaded ${teams.length} teams\n`);

    // Chunk all team data
    const allTexts = [];
    for (const team of teams) {
        const textChunks = teamDataToTextChunks(team);
        for (const text of textChunks) {
            allTexts.push({ text, source: team.team_name });
        }
    }

    // Split large chunks
    const finalTexts = [];
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

    console.log(`📝 ${finalTexts.length} text chunks ready to embed\n`);

    // Embed
    const texts = finalTexts.map((t) => t.text);
    const embeddings = await embedTexts(texts, "retrieval.passage");

    const chunks = finalTexts.map((t, i) => ({
        text: t.text,
        source: t.source,
        embedding: embeddings[i] || [],
    }));

    // Compute hash
    const raw = JSON.stringify(
        teams.map((t) => ({ n: t.team_name, m: t.matches_analyzed })).sort((a, b) => a.n.localeCompare(b.n)),
    );
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);

    // Write cache
    const cachePath = join(process.cwd(), "public", "precomputed", "rag-cache.json");
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ hash, chunks }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMB = (Buffer.byteLength(JSON.stringify({ hash, chunks })) / 1024 / 1024).toFixed(1);

    console.log(`\n✅ Cache saved to public/precomputed/rag-cache.json`);
    console.log(`   ${chunks.length} chunks | ${sizeMB} MB | ${elapsed}s`);
    console.log(`   Hash: ${hash}`);
    console.log(`\n💡 Commit this file to GitHub — no more 17s cold starts!`);
}

main().catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
});
