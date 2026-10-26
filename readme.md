<div align="center">

# 🌌 VITVERSE
### *The Tamagotchi that won't let you doomscroll.*

**A gamified, AI-powered wellness sanctuary designed to intercept burnout, gamify self-care, and build emotional attachment through habit loops.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-vitverse--mauve.vercel.app-00e5ff?style=for-the-badge&logo=vercel)](https://vitverse-mauve.vercel.app/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa)](https://vitverse-mauve.vercel.app/)
[![Tech Stack](https://img.shields.io/badge/Stack-Vanilla_JS_|_Vercel_|_Supabase-000000?style=for-the-badge)]()
[![Acquisition Ready](https://img.shields.io/badge/Status-Acquisition_Ready-4ade80?style=for-the-badge)]()

</div>

---

## 📸 Screenshots

*Click to expand*

| The Sanctuary (Home) | The AI Confidant | The Zen Sandbox |
|:---:|:---:|:---:|
| <img src="[[LINK_TO_MAIN_SCREENSHOT]]" width="250" /> | <img src="[[LINK_TO_AI_SCREENSHOT]]" width="250" /> | <img src="[[LINK_TO_ZEN_SCREENSHOT]]" width="250" /> |
| *A dynamic glowing companion whose Aura changes based on your real-life stats.* | *An emotionally intelligent AI that parses "brain dumps" into actionable game plans or empathy.* | *A spatial, Web Audio-powered Zen garden for active meditation.* |

---

## 🎯 The Acquisition Thesis (Why Vitverse?)

The wellness app market is saturated with punitive streak-trackers (Habitica, Finch) and sterile meditation libraries (Calm, Headspace). **Vitverse bridges the gap between emotional attachment and forced accountability.**

1. **The "Forced Mechanic" Moat:** Unlike destination apps, Vitverse uses a glowing Companion that visually degrades if the user neglects their mental health. It creates loss aversion and genuine guilt, driving D7/D30 retention far beyond standard wellness apps.
2. **Proprietary State Engine:** The custom `companion.js` engine handles an event-sourced, decay-based stat system with diminishing returns, utilizing localized caching to ensure 0ms UI latency while syncing to the cloud in the background.
3. **Multi-Modal AI Integration:** The backend uses xAI (Grok) to automatically detect whether a user needs *empathy* (Confidant mode) or a *tactical plan* (Tactician mode). It includes strict crisis-intervention logic (self-harm detection) making it safe for consumer deployment.
4. **Spatial Grounding (Zen Sandbox):** A proprietary Canvas-based 2D game where users rake sand and place items, accompanied by generative Web Audio. It serves as an ASMR-level distraction for panic attacks.

---

## ✨ Core Features

*   🫁 **BreatheWell:** Scientifically backed 4-7-8 and Box breathing protocols with haptic feedback and Zen mode.
*   ✅ **ChronoZen:** A drag-and-drop task calendar that converts chores into "Quests" that feed the Companion's energy.
*   🌙 **Dreamweaver:** A sleep tracker with a reactive 3D moon that shifts color based on sleep quality.
*   ✨ **SoulSync:** A mood check-in that morphs the app's background and provides a private reflection canvas.
*   🧠 **AI Tactician/Confidant:** A unified input that routes user thoughts to an LLM for either emotional validation or step-by-step task breakdown.
*   🪨 **The Zen Sandbox:** A standalone interactive garden with procedural audio generation.
*   🔗 **PWA & Offline First:** Fully installable on iOS/Android, complete with service workers, local caching, and auto-update logic.

---

## 🛠️ Technical Architecture

Vitverse is built with a "local-first" philosophy for instant rendering, backed by serverless cloud infrastructure.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JS | Zero-dependency core for blazing-fast PWA performance. |
| **State Engine** | Custom Event-Sourced JS | Handles decay math, XP, and levels via `localStorage`. |
| **Backend** | Vercel Serverless Functions | Secure API endpoints to hide keys and route LLM requests. |
| **AI Engine** | xAI (Grok) / JSON Mode | Strict JSON schema output for UI rendering. |
| **Rate Limiting** | Upstash Redis | Prevents bot abuse and caps API spend. |
| **Database** | Supabase (PostgreSQL) | Row-Level Security (RLS) for cloud sync across devices. |
| **Analytics** | PostHog | Funnel tracking, retention curves, and first-dump metrics. |
| **Audio** | Web Audio API | Procedural synthesis (no MP3s) for the Zen Sandbox. |

---

## 🚀 Business & Monetization Ready

Vitverse is currently a fully functional MVP with a clear path to revenue:

*   **Freemium Paywall Ready:** The architecture is split. The core loop is free. The "Unlimited AI Plans," "Advanced Weekly Reports," and "Exclusive Companion Skins" are gated behind a $4.99/mo tier.
*   **Distribution:** Ready to be wrapped via **Capacitor** for native iOS and Android deployment, allowing for push notifications ("Your companion is wilting. Tap to restore").
*   **Target Audience:** High-stress professionals, students, and the ADHD community who struggle with traditional habit trackers.

---

## 💻 Running Locally

To spin up the Vitverse environment locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vitverse.git
