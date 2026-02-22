import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { RAGEngine } from "@/lib/rag-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ChatRequest {
    message: string;
    team_name?: string;
    history?: ChatMessage[];
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(ragContext: string[], teamName?: string): string {
    const contextBlock = ragContext.length
        ? `\n\n=== SCOUTING INTELLIGENCE (Retrieved from RAG) ===\n${ragContext.join("\n\n---\n\n")}\n=== END SCOUTING INTELLIGENCE ===`
        : "";

    return `You are **Vantage Point AI** — an elite VALORANT esports analyst and strategic advisor for Cloud9's coaching staff.

Your expertise:
- Deep statistical analysis of team performance, player tendencies, and meta trends
- Strategic scouting intelligence: attack/defense patterns, site preferences, economy management
- Agent composition analysis and counter-strategy development
- Player-level insights: entry fraggers, weak links, clutch specialists
- Map-specific tendencies and win conditions

Rules:
- Ground every claim in specific data when available. Use "X% of rounds" format.
- When referencing player stats, cite KD ratios, first kill rates, clutch rates, etc.
- Provide actionable tactical recommendations, not generic advice.
- Format responses in clean markdown with headers, bullet points, and tables when appropriate.
- If asked about a team, focus on that team. If no team is specified, default to Cloud9.
- If you don't have data for something, say so honestly rather than making up stats.
${teamName ? `\nThe user is currently analyzing: **${teamName}**` : ""}
${contextBlock}`;
}

// ---------------------------------------------------------------------------
// POST handler — streaming chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const body: ChatRequest = await request.json();
        const { message, team_name, history } = body;

        if (!message?.trim()) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 },
            );
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        const jinaApiKey = process.env.JINA_API_KEY;

        if (!groqApiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY not configured" },
                { status: 500 },
            );
        }

        // --- RAG Retrieval ---
        let ragContext: string[] = [];
        if (jinaApiKey) {
            try {
                ragContext = await RAGEngine.retrieveContext(
                    message,
                    jinaApiKey,
                    5,
                    team_name,
                );
                console.log(`[Chat API] Retrieved ${ragContext.length} RAG chunks`);
            } catch (e) {
                console.warn("[Chat API] RAG retrieval failed, proceeding without context:", e);
            }
        }

        // --- Build messages ---
        const systemPrompt = buildSystemPrompt(ragContext, team_name);
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
        ];

        // Add conversation history (limit to last 10 messages to stay within context)
        if (history?.length) {
            const recentHistory = history.slice(-10);
            messages.push(...recentHistory);
        }

        messages.push({ role: "user", content: message });

        // --- Stream Groq response ---
        const groq = new Groq({ apiKey: groqApiKey });

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages,
            temperature: 0.4,
            stream: true,
        });

        // Create a ReadableStream that forwards chunks
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                let closed = false;
                try {
                    for await (const chunk of completion) {
                        if (closed) break;
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
                            );
                        }
                    }
                    if (!closed) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
                        );
                        controller.close();
                        closed = true;
                    }
                } catch (error) {
                    console.error("[Chat API] Stream error:", error);
                    if (!closed) {
                        try {
                            controller.enqueue(
                                encoder.encode(
                                    `data: ${JSON.stringify({ error: "Stream error" })}\n\n`,
                                ),
                            );
                            controller.close();
                        } catch {
                            // Stream already closed
                        }
                        closed = true;
                    }
                }
            },
            cancel() {
                // Client disconnected — no-op, the `closed` flag prevents further writes
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        console.error("[Chat API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
