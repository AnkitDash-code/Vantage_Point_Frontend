"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface MacroReviewResponse {
  match_id: string;
  team_name: string;
  agenda: string;
}

interface MacroReviewTabProps {
  apiBaseUrl: string;
  matchId: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export default function MacroReviewTab({
  apiBaseUrl,
  matchId,
  loading,
  setLoading,
  setError,
}: MacroReviewTabProps) {
  const [review, setReview] = useState<MacroReviewResponse | null>(null);

  const fetchMacroReview = async () => {
    if (!matchId) {
      setError("Please select a match first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/macro-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          team_name: "Cloud9",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch macro review");
      }

      const data: MacroReviewResponse = await response.json();
      setReview(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate macro review");
      console.error("Error fetching macro review:", err);
    } finally {
      setLoading(false);
    }
  };

  // Format the agenda text with proper styling
  const formatAgenda = (agendaText: string) => {
    const lines = agendaText.split("\n");
    const sections: { title: string; content: string[] }[] = [];
    let currentSection: { title: string; content: string[] } | null = null;

    lines.forEach((line) => {
      // Section headers (numbered sections)
      if (/^\d+\.\s+[A-Z]/.test(line)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line,
          content: [],
        };
      } else if (currentSection && line.trim()) {
        currentSection.content.push(line);
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  };

  const renderAgendaLine = (line: string, index: number) => {
    const isWarning = line.includes("⚠");
    const isSuccess = line.includes("✓");
    const isRecommendation = line.includes("→");

    let className = "text-muted";
    let icon = null;

    if (isWarning) {
      className = "text-orange-400";
      icon = "⚠";
    } else if (isSuccess) {
      className = "text-green-400";
      icon = "✓";
    } else if (isRecommendation) {
      className = "text-cyan-400";
      icon = "→";
    }

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={`font-mono text-sm ${className} leading-relaxed`}
      >
        {line}
      </motion.div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Automated Macro Game Review
        </h2>
        <p className="text-sm text-muted">
          Post-match analysis agenda highlighting critical strategic moments
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6">
        <button
          onClick={fetchMacroReview}
          disabled={loading || !matchId}
          className="cut-corner px-6 py-2.5 text-sm uppercase tracking-[0.22em] border border-cyan-500/30 text-cyan glow-cyan hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generating Review..." : "Generate Review Agenda"}
        </button>

        {!matchId && (
          <p className="text-xs text-orange-400 mt-2">
            ⚠ Please select a match from the dropdown above
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-muted">
              Analyzing match and generating review agenda...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && review && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Match Info Header */}
          <div className="cut-corner border border-ethereal-strong bg-black/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted mb-2">
                  Match ID
                </div>
                <div className="text-lg font-mono text-white">
                  {review.match_id}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.3em] text-muted mb-2">
                  Team
                </div>
                <div className="text-lg font-semibold text-cyan">
                  {review.team_name}
                </div>
              </div>
            </div>
          </div>

          {/* Agenda Sections */}
          <div className="cut-corner border border-ethereal bg-black/30 p-6">
            <div className="space-y-6">
              {formatAgenda(review.agenda).map((section, sectionIdx) => (
                <motion.div
                  key={sectionIdx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: sectionIdx * 0.1 }}
                  className="border-l-4 border-cyan-500/50 pl-4"
                >
                  <h3 className="text-lg font-bold text-white mb-3">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.content.map((line, lineIdx) =>
                      renderAgendaLine(line, lineIdx)
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Raw Agenda (Collapsible) */}
          <details className="cut-corner border border-ethereal bg-black/20 p-4">
            <summary className="cursor-pointer text-sm uppercase tracking-[0.3em] text-muted hover:text-white transition-colors">
              View Raw Agenda
            </summary>
            <pre className="mt-4 whitespace-pre-wrap font-mono text-xs text-muted leading-relaxed">
              {review.agenda}
            </pre>
          </details>

          {/* Export Options */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(review.agenda);
                alert("Agenda copied to clipboard!");
              }}
              className="cut-corner px-4 py-2 text-xs uppercase tracking-[0.22em] border border-ethereal text-muted hover:text-white hover:border-white/30 transition-all"
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={() => {
                const blob = new Blob([review.agenda], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `c9-review-${review.match_id}.txt`;
                a.click();
              }}
              className="cut-corner px-4 py-2 text-xs uppercase tracking-[0.22em] border border-ethereal text-muted hover:text-white hover:border-white/30 transition-all"
            >
              💾 Download as TXT
            </button>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && !review && (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">📋</span>
          <h3 className="text-xl font-bold text-white mb-2">
            Ready to Generate Review
          </h3>
          <p className="text-muted mb-6">
            Select a match and click "Generate Review Agenda" to analyze
            strategic decisions
          </p>
          <div className="cut-corner border border-ethereal bg-black/20 p-6 max-w-2xl mx-auto">
            <h4 className="text-sm uppercase tracking-[0.3em] text-muted mb-3">
              Agenda Sections Include:
            </h4>
            <ul className="text-sm text-muted space-y-2 text-left">
              <li>• Pistol Round Performance (R1, R13)</li>
              <li>• Economy Management (Force buys, eco rounds)</li>
              <li>• Mid-Round Execution (Timing, late plants)</li>
              <li>• Ultimate Economy (Orb collection)</li>
              <li>• Critical Moments (Momentum swings)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
