"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Insight {
  type: string;
  player?: string;
  data: string;
  recommendation: string;
  severity: "critical" | "high" | "medium" | "low";
  loss_rate?: number;
  sample_size?: number;
}

interface InsightsData {
  kast_correlations: Insight[];
  setup_patterns: Insight[];
  economy_patterns: Insight[];
  timing_patterns?: Insight[];
}

interface InsightsResponse {
  team: string;
  matches_analyzed: number;
  insights: InsightsData;
}

interface InsightsTabProps {
  apiBaseUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export default function InsightsTab({
  apiBaseUrl,
  loading,
  setLoading,
  setError,
}: InsightsTabProps) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [numMatches, setNumMatches] = useState(50);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: "Cloud9",
          num_matches: numMatches,
          game_title: "VALORANT",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch insights");
      }

      const data: InsightsResponse = await response.json();
      setInsights(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate insights");
      console.error("Error fetching insights:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-500/50 bg-red-500/10 text-red-400";
      case "high":
        return "border-orange-500/50 bg-orange-500/10 text-orange-400";
      case "medium":
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-400";
      default:
        return "border-blue-500/50 bg-blue-500/10 text-blue-400";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      default:
        return "🔵";
    }
  };

  const renderInsightCard = (insight: Insight, index: number) => (
    <motion.div
      key={`${insight.type}-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`cut-corner border p-5 ${getSeverityColor(insight.severity)}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getSeverityIcon(insight.severity)}</span>
          <span className="text-xs uppercase tracking-[0.3em] font-mono">
            {insight.severity}
          </span>
        </div>
        {insight.loss_rate && (
          <span className="text-sm font-bold">
            {insight.loss_rate}% Loss Rate
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {insight.player && `${insight.player}: `}
        {insight.data}
      </h3>

      <p className="text-sm text-muted mb-3">{insight.recommendation}</p>

      {insight.sample_size && (
        <div className="text-xs text-muted/70">
          Sample: {insight.sample_size} rounds
        </div>
      )}
    </motion.div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Personalized Player Insights
        </h2>
        <p className="text-sm text-muted">
          KAST correlations, setup patterns, and economy analysis for Cloud9
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-end gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-muted mb-2">
            Matches to Analyze
          </label>
          <select
            value={numMatches}
            onChange={(e) => setNumMatches(Number(e.target.value))}
            className="h-10 cut-corner border border-cyan-500/30 bg-black/50 px-4 text-sm font-mono text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value={20}>20 matches</option>
            <option value={50}>50 matches</option>
            <option value={100}>100 matches</option>
          </select>
        </div>

        <button
          onClick={fetchInsights}
          disabled={loading}
          className="cut-corner px-6 py-2.5 text-sm uppercase tracking-[0.22em] border border-cyan-500/30 text-cyan glow-cyan hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Generate Insights"}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-muted">
              Analyzing Cloud9 matches...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && insights && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="cut-corner border border-ethereal bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                Matches Analyzed
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {insights.matches_analyzed}
              </div>
            </div>
            <div className="cut-corner border border-ethereal bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                Total Insights
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {Object.values(insights.insights).reduce(
                  (sum, arr) => sum + arr.length,
                  0
                )}
              </div>
            </div>
            <div className="cut-corner border border-ethereal bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                Critical Issues
              </div>
              <div className="text-3xl font-bold text-red-400 mt-2">
                {Object.values(insights.insights).reduce(
                  (sum, arr) =>
                    sum + arr.filter((i) => i.severity === "critical").length,
                  0
                )}
              </div>
            </div>
          </div>

          {/* KAST Correlations */}
          {insights.insights.kast_correlations.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span>
                KAST Correlation Analysis
              </h3>
              <p className="text-sm text-muted mb-4">
                Rounds lost when players die without KAST (Kill, Assist,
                Survived, Traded)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.insights.kast_correlations.map((insight, idx) =>
                  renderInsightCard(insight, idx)
                )}
              </div>
            </div>
          )}

          {/* Setup Patterns */}
          {insights.insights.setup_patterns.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🎯</span>
                Setup & Composition Patterns
              </h3>
              <p className="text-sm text-muted mb-4">
                Starting positions and agent compositions that correlate with
                losses
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.insights.setup_patterns.map((insight, idx) =>
                  renderInsightCard(insight, idx)
                )}
              </div>
            </div>
          )}

          {/* Economy Patterns */}
          {insights.insights.economy_patterns.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>💰</span>
                Economy Management
              </h3>
              <p className="text-sm text-muted mb-4">
                Force buy cascades and economic decision patterns
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.insights.economy_patterns.map((insight, idx) =>
                  renderInsightCard(insight, idx)
                )}
              </div>
            </div>
          )}

          {/* Timing Patterns */}
          {insights.insights.timing_patterns &&
            insights.insights.timing_patterns.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>⏱️</span>
                  Timing & Execution
                </h3>
                <p className="text-sm text-muted mb-4">
                  Late executes and fast round vulnerabilities
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.insights.timing_patterns.map((insight, idx) =>
                    renderInsightCard(insight, idx)
                  )}
                </div>
              </div>
            )}

          {/* No Insights Found */}
          {Object.values(insights.insights).every((arr) => arr.length === 0) && (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">✅</span>
              <h3 className="text-xl font-bold text-white mb-2">
                No Critical Issues Detected
              </h3>
              <p className="text-muted">
                Cloud9's performance appears consistent across analyzed matches.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && !insights && (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">📊</span>
          <h3 className="text-xl font-bold text-white mb-2">
            Ready to Analyze
          </h3>
          <p className="text-muted mb-6">
            Click "Generate Insights" to analyze Cloud9's recent matches
          </p>
        </div>
      )}
    </div>
  );
}
