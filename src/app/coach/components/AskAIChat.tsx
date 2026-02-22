"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AskAIChatProps {
  teamName?: string;
}

// ---------------------------------------------------------------------------
// Suggested starters (compact)
// ---------------------------------------------------------------------------

const STARTERS = [
  { label: "Attack patterns", question: "What are Cloud9's main attack patterns?" },
  { label: "Weak links", question: "Who is Cloud9's weakest player to target?" },
  { label: "Map pick/ban", question: "Which maps should we pick and ban vs Cloud9?" },
  { label: "How to win", question: "Give me a game plan to beat Cloud9." },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AskAIChat({ teamName = "Cloud9" }: AskAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput("");
      setIsStreaming(true);
      setError(null);

      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            team_name: teamName,
            history,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.error) { setError(data.error); break; }
              if (data.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.content,
                    };
                  }
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to get response";
        setError(msg);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, teamName],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ethereal">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-[0.2em] text-white font-semibold">
            Ask AI
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="text-[10px] uppercase tracking-[0.15em] text-muted hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 ? (
          /* Starters */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2 pt-2"
          >
            <p className="text-[11px] text-muted/70 uppercase tracking-[0.15em] mb-3">
              Quick questions
            </p>
            {STARTERS.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => sendMessage(s.question)}
                className="block w-full text-left text-xs text-muted hover:text-white border border-ethereal hover:border-cyan-500/30 bg-black/20 hover:bg-cyan-500/5 px-3 py-2.5 transition-all cut-corner"
              >
                {s.label}
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={msg.role === "user" ? "flex justify-end" : ""}
              >
                <div
                  className={
                    msg.role === "user"
                      ? "max-w-[90%] bg-cyan-500/15 border border-cyan-500/25 px-3 py-2 cut-corner"
                      : "bg-black/20 border border-ethereal px-3 py-2.5 cut-corner"
                  }
                >
                  {msg.role === "user" ? (
                    <p className="text-xs text-white font-mono leading-relaxed">
                      {msg.content}
                    </p>
                  ) : msg.content ? (
                    <div className="prose prose-xs prose-invert max-w-none text-muted text-xs leading-relaxed [&_h1]:text-sm [&_h1]:text-white [&_h2]:text-xs [&_h2]:text-white [&_h3]:text-xs [&_h3]:text-white [&_strong]:text-white [&_a]:text-cyan [&_code]:text-cyan [&_code]:text-[10px] [&_table]:text-[10px] [&_th]:text-white [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0 [&_h2]:my-2 [&_h3]:my-1.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.3s" }} />
                      <span className="text-[10px] text-muted ml-1">Thinking...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-1.5 border border-red/40 bg-red/10 text-red text-[10px]">
          ⚠ {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-ethereal px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about teams, players, maps..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-black/30 border border-ethereal px-3 py-2 text-xs text-white placeholder:text-muted/40 focus:outline-none focus:border-cyan-500/40 resize-none font-mono disabled:opacity-40 cut-corner"
          />
          {isStreaming ? (
            <button
              onClick={() => { abortRef.current?.abort(); setIsStreaming(false); }}
              className="shrink-0 px-3 py-2 text-[10px] uppercase tracking-[0.15em] border border-red/40 text-red hover:bg-red/10 transition-all cut-corner"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 px-3 py-2 text-[10px] uppercase tracking-[0.15em] border border-cyan-500/40 text-cyan hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed cut-corner"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
