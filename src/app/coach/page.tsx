"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import InsightsTab from "./components/InsightsTab";
import MacroReviewTab from "./components/MacroReviewTab";
import WhatIfSimulator from "./components/WhatIfSimulator";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type TabId = "insights" | "macro" | "whatif";

interface Match {
  id: string;
  map: string;
  opponent: string;
  score: string;
  date: string;
}

export default function CoachDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("insights");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available matches on mount
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/teams`);
        if (!response.ok) {
          throw new Error("Failed to fetch team data");
        }
        const data = await response.json();

        // Find Cloud9
        const c9Team = data.teams?.find(
          (t: any) => t.name.toLowerCase().includes("cloud9")
        );

        if (c9Team) {
          // For MVP, we'll use mock match list since GRID cache structure
          // In production, would fetch actual match list
          setMatches([
            {
              id: "1",
              map: "Haven",
              opponent: "Team X",
              score: "11-13",
              date: "2024-01-15",
            },
            {
              id: "2",
              map: "Ascent",
              opponent: "Team Y",
              score: "13-10",
              date: "2024-01-14",
            },
          ]);
        }
      } catch (err) {
        console.error("Error fetching matches:", err);
      }
    };

    fetchMatches();
  }, []);

  const tabs = [
    { id: "insights" as TabId, label: "Player Insights", icon: "📊" },
    { id: "macro" as TabId, label: "Macro Review", icon: "📋" },
    { id: "whatif" as TabId, label: "What-If Simulator", icon: "🔮" },
  ];

  return (
    <div className="relative min-h-screen bg-void">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-70" />
      <div className="pointer-events-none absolute inset-0 gradient-halo opacity-90" />

      <div className="relative z-10">
        {/* Header */}
        <motion.nav
          className="sticky top-4 z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-4 backdrop-blur-md bg-[rgba(10,14,20,0.65)] border border-white/10 shadow-[0_12px_35px_rgba(0,0,0,0.35)] cut-corner"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[rgba(6,182,212,0.8)]" />
            <span className="text-sm uppercase tracking-[0.4em] text-muted">
              Vantage Point | Assistant Coach
            </span>
          </div>
          <a
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-muted hover:text-white transition-colors"
          >
            ← Back to Home
          </a>
        </motion.nav>

        {/* Main Content */}
        <motion.div
          className="mx-auto max-w-7xl px-6 py-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {/* Title Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white md:text-5xl">
              Comprehensive Assistant Coach
            </h1>
            <p className="mt-3 text-lg text-muted">
              Cloud9 Performance Analysis & Strategic Intelligence
            </p>
          </div>

          {/* Match Selector */}
          <div className="mb-8 cut-corner border border-ethereal-strong bg-glass p-6">
            <label className="block text-sm uppercase tracking-[0.3em] text-muted mb-3">
              Select Match for Analysis
            </label>
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full md:w-96 h-12 cut-corner border border-cyan-500/30 bg-black/50 px-4 text-sm font-mono text-white focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20 focus:outline-none"
            >
              <option value="">Choose a match...</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.map} vs {match.opponent} ({match.score}) - {match.date}
                </option>
              ))}
            </select>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cut-corner px-6 py-3 text-sm uppercase tracking-[0.22em] transition-all ${
                  activeTab === tab.id
                    ? "border-2 border-cyan-400 bg-[rgba(6,182,212,0.15)] text-cyan glow-cyan"
                    : "border border-ethereal text-muted hover:text-white hover:border-white/20"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="cut-corner border border-ethereal-strong bg-glass p-8 min-h-[600px]">
            {error && (
              <div className="mb-6 p-4 border border-red/50 bg-red/10 text-red rounded">
                <strong>Error:</strong> {error}
              </div>
            )}

            {activeTab === "insights" && (
              <InsightsTab
                apiBaseUrl={API_BASE_URL}
                loading={loading}
                setLoading={setLoading}
                setError={setError}
              />
            )}

            {activeTab === "macro" && (
              <MacroReviewTab
                apiBaseUrl={API_BASE_URL}
                matchId={selectedMatchId}
                loading={loading}
                setLoading={setLoading}
                setError={setError}
              />
            )}

            {activeTab === "whatif" && (
              <WhatIfSimulator
                apiBaseUrl={API_BASE_URL}
                matchId={selectedMatchId}
                loading={loading}
                setLoading={setLoading}
                setError={setError}
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
