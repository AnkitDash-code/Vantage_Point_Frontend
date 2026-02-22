# 🎮 Cloud9 VALORANT AI Coach Assistant

> **LLM-Powered Esports Analytics Platform** - Transform match data into actionable coaching insights using AI

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![Groq](https://img.shields.io/badge/Groq-GPT--OSS--120B-orange?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)

## 🌟 Overview

An **AI-first esports analytics platform** that uses Large Language Models to analyze Cloud9's VALORANT performance data and generate comprehensive coaching insights. Built for **100% frontend deployment** with zero backend dependencies.

### ✨ Key Features

- 🤖 **LLM-Powered Analysis** - GPT-OSS-120B model via Groq API for intelligent insights
- 📊 **Player Performance Insights** - 12+ detailed insights across KAST correlations, setup patterns, economy, and timing
- 📋 **Macro Game Review** - 500-700 word comprehensive post-match review agendas with markdown tables
- 🎯 **What-If Simulator** - Explore hypothetical scenarios and strategic alternatives
- 🎨 **Hackathon-Ready UI** - Advanced animations with Framer Motion (floating particles, 3D transforms, mouse tracking)
- 📦 **Static Export Ready** - Deploy anywhere as static files (Vercel, Netlify, GitHub Pages)

---

## 📊 Data Source

The cached data used in this frontend is obtained from the separate backend component available at [Vantage_Point](https://github.com/AnkitDash-code/Vantage_Point). This repository contains the code for data collection and processing using the AG Grid API, which was a mandatory requirement for this project. The frontend is separate and optimized for LLM integration.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Groq API Key** - Get free API key at [https://console.groq.com](https://console.groq.com)

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local and add your Groq API key:
# GROQ_API_KEY=your_groq_api_key_here

# Start development server
npm run dev
```

Visit **http://localhost:3000** to see the application.

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + React 18 | Static site generation, routing |
| **Language** | TypeScript | Type safety across the codebase |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Animation** | Framer Motion | Advanced UI animations |
| **LLM Engine** | Groq API | GPT-OSS-120B model inference |
| **Markdown** | react-markdown + remark-gfm | Render LLM-generated tables |

### Project Structure

```
Frontend/
├── app/
│   ├── page.tsx                    # Landing page with animations
│   ├── coach/
│   │   ├── page.tsx                # Main coach dashboard
│   │   └── components/
│   │       ├── InsightsTab.tsx     # Player performance insights
│   │       ├── MacroReviewTab.tsx  # Post-match review agenda
│   │       └── WhatIfSimulator.tsx # Hypothetical scenario analysis
│   └── layout.tsx
├── lib/
│   ├── llm-engine.ts               # Core LLM integration (Groq API)
│   ├── kast-llm.ts                 # Player insights generation
│   ├── macro-llm.ts                # Macro review generation
│   └── whatif-llm.ts               # What-if scenario analysis
├── public/
│   └── data/
│       └── teams/
│           └── cloud9-20.json      # 20 matches of Cloud9 data
└── tailwind.config.ts
```

---

## 🎯 Features Deep Dive

### 1. Player Performance Insights

Generates **12 comprehensive insights** across 4 categories:

- **KAST Correlations** (3 insights) - K/D ratios, first kill rates, role effectiveness
- **Setup Patterns** (3 insights) - Attack patterns, site preferences, composition issues
- **Economy Patterns** (3 insights) - Win rates, force buy tendencies, economic decisions
- **Timing Patterns** (3 insights) - Execute speed, rush rates, late-round vulnerabilities

Each insight includes:
- **DATA**: 2-3 sentences with concrete statistics
- **RECOMMENDATION**: 50+ words of actionable advice with specific drills
- **SEVERITY**: Critical/High/Medium/Low priority classification

### 2. Macro Game Review

Generates **500-700 word comprehensive post-match review** with:

- **6 detailed sections** covering all aspects of team play
- **4+ markdown tables** with statistics and comparisons
- **Priority action items** (Critical, High Priority, Optimization)
- **Practice drills** with specific durations and success metrics
- **VOD review focus areas** for coaching sessions

### 3. What-If Simulator

Explore hypothetical scenarios:
- "What if we ran more Split compositions with double controller?"
- "What if we prioritized eco rounds differently?"
- Strategic alternatives with probability analysis

---

## 🎨 UI/UX Highlights

### Landing Page

- **20 floating particles** with random animation paths
- **Mouse-following gradient** with spring physics
- **Glowing title** with pulsing shadow effects
- **Animated gradient text** with moving background
- **Typewriter effect** for subtitle
- **3D transforming cards** (rotateY on hover)
- **Stats counter** with spring animations
- **Tech stack badges** with hover effects

### Coach Dashboard

- **Dark esports theme** with cyan accents
- **Markdown table rendering** for structured data
- **Real-time LLM streaming** with loading states
- **Responsive design** optimized for all screen sizes

---

## 📊 Data Format

The platform uses precomputed match metrics stored in JSON:

```json
{
  "team_name": "Cloud9",
  "matches_analyzed": 20,
  "metrics": {
    "overall": {
      "win_rate": 0.45,
      "rounds_per_match": 22.3
    },
    "player_tendencies": [
      {
        "player": "OXY",
        "kd_ratio": 1.15,
        "first_kill_rate": 18.2,
        "top_agent": "Jett"
      }
    ],
    "site_preferences": {
      "A": 0.42,
      "B": 0.35,
      "C": 0.23
    }
  }
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key for GPT-OSS-120B access |

### LLM Configuration

Edit `lib/llm-engine.ts` to customize:

```typescript
model: 'openai/gpt-oss-120b',  // Model selection
max_tokens: 4000,               // Maximum output length
temperature: 0.7,               // Creativity level (0-1)
```

---

## 🚢 Deployment

### Static Export

```bash
# Build static files
npm run build

# Output will be in 'out/' directory
# Deploy the 'out/' folder to any static hosting service
```

### Deployment Platforms

- **Vercel** - Zero-config deployment (recommended)
- **Netlify** - Drag-and-drop deployment
- **GitHub Pages** - Free hosting for static sites
- **AWS S3 + CloudFront** - Scalable cloud hosting

---

## 🧪 Development

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start  # Preview production build
```

### Linting

```bash
npm run lint
```

---

## 📈 Performance

- **First Load JS**: ~250KB (optimized with Next.js code splitting)
- **LLM Response Time**: 2-5 seconds (depends on Groq API load)
- **Markdown Rendering**: Real-time with react-markdown
- **Animation FPS**: 60fps (GPU-accelerated with Framer Motion)

---

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- [ ] Add support for more teams beyond Cloud9
- [ ] Implement real-time match data ingestion
- [ ] Add historical trend analysis across multiple matches
- [ ] Support additional LLM providers (OpenAI, Anthropic)
- [ ] Add user authentication for personalized insights
- [ ] Create mobile-optimized interface

---

## 📄 License

MIT License - feel free to use this project for your own esports analytics needs.

---

## 🙏 Acknowledgments

- **Cloud9** - Match data and inspiration
- **Groq** - Fast LLM inference with GPT-OSS-120B
- **Vercel** - Next.js framework and deployment platform
- **Anthropic** - LLM prompt engineering best practices

---

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Contact: [Your Email/Discord]

---

**Built with ❤️ for the esports community**
