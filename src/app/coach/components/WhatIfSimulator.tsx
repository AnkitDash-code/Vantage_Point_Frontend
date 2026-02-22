"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface WhatIfResponse {
  match_id: string;
  query: string;
  analysis: string;
}

interface WhatIfSimulatorProps {
  apiBaseUrl: string;
  matchId: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export default function WhatIfSimulator({
  apiBaseUrl,
  matchId,
  loading,
  setLoading,
  setError,
}: WhatIfSimulatorProps) {
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<WhatIfResponse | null>(null);

  const exampleQueries = [
    "On Round 22 (score 10-11) on Haven, we attempted a 3v5 retake on C-site and lost. Would it have been better to save our weapons?",
    "Round 15 (8-6): We forced a 4v5 retake on A-site with 25 seconds left. Should we have saved?",
    "Round 8: 2v4 situation on B-site. We attempted retake and lost. Was saving the better call?",
  ];

  const simulateWhatIf = async () => {
    if (!matchId) {
      setError("Please select a match first");
      return;
    }

    if (!query.trim()) {
      setError("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          query: query.trim(),
          team_name: "Cloud9",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to simulate scenario");
      }

      const data: WhatIfResponse = await response.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Failed to simulate what-if scenario");
      console.error("Error simulating what-if:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatAnalysis = (analysisText: string) => {
    const sections = analysisText.split("\n\n");
    return sections.map((section, idx) => {
      const lines = section.split("\n");
      const isHeader = lines[0]?.includes("ANALYZING") || lines[0]?.includes("GAME STATE");
      const isActualDecision = section.includes("ACTUAL DECISION");
      const isAlternative = section.includes("ALTERNATIVE");
      const isRecommendation = section.includes("RECOMMENDATION");

      return (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.1 }}
          className={`mb-4 ${
            isHeader
              ? "border-l-4 border-cyan-500 pl-4"
              : isActualDecision
              ? "border-l-4 border-orange-500 pl-4 bg-orange-500/5 p-4 rounded-r"
              : isAlternative
              ? "border-l-4 border-green-500 pl-4 bg-green-500/5 p-4 rounded-r"
              : isRecommendation
              ? "border-l-4 border-blue-500 pl-4 bg-blue-500/10 p-4 rounded-r"
              : ""
          }`}
        >
          {lines.map((line, lineIdx) => {
            const isWarning = line.includes("⚠");
            const isSuccess = line.includes("✓");
            const isBullet = line.trim().startsWith("-");

            let className = "text-muted";
            if (isHeader && lineIdx === 0) {
              className = "text-xl font-bold text-white";
            } else if (line.includes(":") && !isBullet) {
              className = "text-white font-semibold";
            } else if (isWarning) {
              className = "text-orange-400";
            } else if (isSuccess) {
              className = "text-green-400";
            }

            return (
              <div
                key={lineIdx}
                className={`font-mono text-sm ${className} leading-relaxed ${
                  isBullet ? "ml-4" : ""
                }`}
              >
                {line}
              </div>
            );
          })}
        </motion.div>
      );
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Hypothetical Outcome Predictor
        </h2>
        <p className="text-sm text-muted">
          Ask "what if" questions about past strategic decisions
        </p>
      </div>

      {/* Query Input */}
      <div className="mb-6">
        <label className="block text-xs uppercase tracking-[0.3em] text-muted mb-3">
          Your Question
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Example: On Round 22 (score 10-11) on Haven, we attempted a 3v5 retake on C-site and lost. Would it have been better to save our weapons?"
          rows={4}
          className="w-full cut-corner border border-cyan-500/30 bg-black/50 px-4 py-3 text-sm font-mono text-white placeholder:text-muted/50 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20 focus:outline-none resize-none"
        />

        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={simulateWhatIf}
            disabled={loading || !matchId || !query.trim()}
            className="cut-corner px-6 py-2.5 text-sm uppercase tracking-[0.22em] border border-cyan-500/30 text-cyan glow-cyan hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Analyzing..." : "Simulate Scenario"}
          </button>

          <button
            onClick={() => setQuery("")}
            className="text-xs uppercase tracking-[0.22em] text-muted hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>

        {!matchId && (
          <p className="text-xs text-orange-400 mt-2">
            ⚠ Please select a match from the dropdown above
          </p>
        )}
      </div>

      {/* Example Queries */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-muted mb-3">
          Example Questions
        </div>
        <div className="space-y-2">
          {exampleQueries.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(example)}
              className="w-full text-left cut-corner border border-ethereal bg-black/20 p-3 text-xs font-mono text-muted hover:text-white hover:border-white/20 transition-all"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-muted">
              Simulating alternative scenario...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && analysis && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Query Echo */}
          <div className="cut-corner border border-ethereal-strong bg-black/40 p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-muted mb-2">
              Your Question
            </div>
            <div className="text-sm text-white font-mono italic">
              "{analysis.query}"
            </div>
          </div>

          {/* Analysis */}
          <div className="cut-corner border border-ethereal bg-black/30 p-6">
            {formatAnalysis(analysis.analysis)}
          </div>

          {/* Comparison Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cut-corner border border-orange-500/50 bg-orange-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚠</span>
                <h3 className="text-lg font-bold text-orange-400">
                  Actual Decision
                </h3>
              </div>
              <p className="text-sm text-muted">
                What was done in the match (attempted retake)
              </p>
            </div>

            <div className="cut-corner border border-green-500/50 bg-green-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✓</span>
                <h3 className="text-lg font-bold text-green-400">
                  Alternative Scenario
                </h3>
              </div>
              <p className="text-sm text-muted">
                What would have happened (save and full buy next round)
              </p>
            </div>
          </div>

          {/* Export Options */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                const fullText = `QUERY:\n${analysis.query}\n\nANALYSIS:\n${analysis.analysis}`;
                navigator.clipboard.writeText(fullText);
                alert("Analysis copied to clipboard!");
              }}
              className="cut-corner px-4 py-2 text-xs uppercase tracking-[0.22em] border border-ethereal text-muted hover:text-white hover:border-white/30 transition-all"
            >
              📋 Copy Analysis
            </button>
            <button
              onClick={() => {
                const fullText = `QUERY:\n${analysis.query}\n\nANALYSIS:\n${analysis.analysis}`;
                const blob = new Blob([fullText], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `c9-whatif-${analysis.match_id}.txt`;
                a.click();
              }}
              className="cut-corner px-4 py-2 text-xs uppercase tracking-[0.22em] border border-ethereal text-muted hover:text-white hover:border-white/30 transition-all"
            >
              💾 Download Analysis
            </button>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && !analysis && (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🔮</span>
          <h3 className="text-xl font-bold text-white mb-2">
            Ready to Predict
          </h3>
          <p className="text-muted mb-6">
            Ask a question about past decisions to see alternative outcomes
          </p>
          <div className="cut-corner border border-ethereal bg-black/20 p-6 max-w-2xl mx-auto">
            <h4 className="text-sm uppercase tracking-[0.3em] text-muted mb-3">
              Analysis Includes:
            </h4>
            <ul className="text-sm text-muted space-y-2 text-left">
              <li>• Game state analysis (player counts, time, utility)</li>
              <li>• Probability of actual decision success</li>
              <li>• Probability of alternative scenario</li>
              <li>• Economic impact comparison</li>
              <li>• Strategic recommendation with reasoning</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
