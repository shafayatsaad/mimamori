<div align="center">

<!-- ANIMATED HEADER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,50:06B6D4,100:8B5CF6&height=220&section=header&text=Mimamori%20AI&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=AI-Powered%20Healthcare%20Wellness%20Companion&descAlignY=55&descSize=18&descColor=ffffff" width="100%" />

<!-- LANGUAGE TOGGLE -->
[ 🇬🇧 English ](README.md) | [ 🇯🇵 日本語 ](README_JP.md)

<br />

<!-- TECH BADGES -->
[![Next.js](https://img.shields.io/badge/Next.js-14.x-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini-8E75C2?style=flat-square&logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)

<br />

![Mimamori Hero](image.png)

<br />

<p>
  <b>Mimamori AI</b> is a proactive healthcare monitoring platform that bridges the <b>Clinical Data Gap</b> between patient visits. By transforming natural voice logs into <b>doctor-ready clinical insights</b>, it empowers patients and provides peace of mind to caregivers through real-time AI synthesis and smart in-app alerts.
</p>

<br />

<!-- ACTION BUTTONS -->
[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-10B981?style=for-the-badge&labelColor=1E293B)](https://mimamori-ai.com/)
[![Star This Repo](https://img.shields.io/badge/⭐_Star_This_Repo-Support_Us-FFD700?style=for-the-badge&labelColor=1E293B)](https://github.com/shafayatsaad/mimamori)

</div>

---

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [🚨 The Clinical Data Gap](#-the-clinical-data-gap)
- [✨ Key Features](#-key-features)
- [🧠 AI & Machine Learning Depth](#-ai--machine-learning-depth)
- [🛡️ Security & Data Privacy](#️-security--data-privacy)
- [🏗️ System Architecture](#️-system-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📖 Use Cases](#-use-cases)
- [🚀 Getting Started](#-getting-started)
- [🗺️ Roadmap](#️-roadmap)
- [👥 Team](#-team)

---

## 🎯 Overview

**Mimamori** (meaning "watching over" in Japanese) was built to transform how chronic conditions and daily wellness are monitored. Developed using **Supabase** and **Google Gemini**, the platform ensures that the 99.9% of time patients spend outside of clinics is no longer a data "black box."

### Why Mimamori?

- 🎙️ **Voice-First**: Log symptoms naturally without the friction of typing.
- 🧠 **Medical Intelligence**: Extract clinical entities using Google Gemini AI prompting.
- 🔔 **Proactive Safety**: Receive smart in-app notifications when health trends show signs of deterioration.
- 👨‍👩‍👧 **Care Circle**: Seamlessly connect family, caregivers, and doctors on a single dashboard.

---

## 🚨 The Clinical Data Gap

Modern healthcare is often episodic and reactive. Patients spend over 8,700 hours a year outside clinical settings—hours where vital health data is lost. Mimamori solves this:

| Problem | Impact | Mimamori Solution |
|---------|--------|-------------------|
| ❌ **Episodic Care** | Critical symptoms missed between visits | **Continuous Logging** via voice |
| ❌ **Recall Bias** | Patients struggle to articulate symptoms to doctors | **Synthesized PDF Reports** |
| ❌ **Caregiver Isolation** | Family members lack real-time visibility | **Shared Care Circle Dashboard** |
| ❌ **Unstructured Data** | Health diaries are messy and hard to analyze | **Gemini Clinical NLP Entity Extraction** |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🗣️ **Voice Symptoms Log** | AI-powered voice capture that understands colloquial nuances and non-linear speech. |
| 🧬 **Clinical Synthesis** | Automated extraction of medications, conditions, dosages, and vitals using Google Gemini NLP. |
| 📑 **Doctor-Ready Reports** | Comprehensive PDF health summaries with longitudinal trend visualizations and anomaly detection. |
| ⚠️ **Smart Alerts** | Real-time in-app notifications for abnormal vitals or worsening symptom trends. |
| 🛡️ **Health Vault** | Secure, encrypted storage for lab reports and medical prescriptions with OCR parsing via Gemini Vision. |
| 🤝 **Care Circle** | Granular permission settings to share health updates with family and medical teams. |

---

## 🧠 AI & Machine Learning Depth

Mimamori leverages a multi-model orchestration strategy to ensure clinical accuracy:

### 1. Natural Language Processing (NLP)
We use **Google Gemini 2.0** to parse unstructured voice-to-text logs. This allows us to identify:
*   **PHM (Personal Health Metadata)**: Medications, frequencies, and dosages.
*   **Anatomical Identifiers**: Locations of pain or discomfort.
*   **Structured Medical Classifications**: Organizing symptoms, treatments, and procedures.

### 2. Large Language Models (LLM)
**Google Gemini 2.0 Flash** serves as our primary reasoning engine. It:
*   Synthesizes days/weeks of logs into concise summaries.
*   Performs sentiment analysis to detect changes in a patient's emotional well-being—a key indicator for physical health decline.
*   Triages entries to determine if they require immediate "Care Circle" alerts.

---

## 🛡️ Security & Data Privacy

Patient data is treated with the highest level of security:

*   **Encryption at Rest**: All sensitive health data in **Supabase PostgreSQL** and **Supabase Storage** is protected with secure access controls and encrypted at rest.
*   **HIPAA Alignment**: Architecture designed with HIPAA principles in mind, ensuring data isolation and audit trails.
*   **Secure Auth**: Secure custom authentication system using **bcrypt** for password hashing and stateless **JWT (jose)** tokens stored in `httpOnly` cookies.
*   **Stateless Processing**: Personal Health Information (PHI) is processed dynamically and sanitized for AI model prompts.

---

## 🏗️ System Architecture

```mermaid
graph TD
    User((User/Patient)) -->|Voice/Text| NextJS[Next.js 14 Frontend]
    NextJS -->|Auth| JWT[JWT + bcrypt Auth]
    NextJS -->|AI Reasoning & OCR| Gemini[Google Gemini / 2.0 Flash]
    NextJS -->|Secure Storage| Storage[Supabase Storage]
    NextJS -->|Persistent State| Database[Supabase PostgreSQL]
    NextJS -->|Metadata| Postgres[Prisma + PostgreSQL]
    Gemini -->|Insights & Entities| NextJS
    NextJS -->|Trigger Alerts| Alerts[In-App Alerts]
    Alerts -->|Dashboard Alerts| Caregiver((Caregiver/Doctor))
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 (App Router) | High-performance, SEO-friendly framework |
| **Styling** | Tailwind CSS + Custom CSS | Glassmorphism & premium UI/UX |
| **Animation** | Framer Motion | Smooth interactions and dynamic transitions |
| **AI Layer** | Google Gemini (2.0 Flash) | Reasoning, Summarization & Sentiment Analysis |
| **Clinical NLP** | Google Gemini NLP Prompting | Medical Entity Extraction |
| **OCR Layer** | Google Gemini Vision | Smart medical document parsing |
| **Database** | Supabase PostgreSQL + Prisma | Scalable relational schemas |
| **Auth** | bcrypt + JWT (jose) | Secure cookie-based identity management |
| **Storage** | Supabase Storage | Encrypted medical vault for documents |

---

## 📖 Use Cases

### 1. Chronic Condition Management
Patients with COPD, CHF, or Diabetes can log daily vitals naturally. Mimamori tracks the "delta"—the change over time—that doctors need but patients often forget.

### 2. Post-Surgical Recovery
Track recovery progress and early signs of infection or complications. The AI detects subtle language changes that might signal distress or worsening pain levels.

### 3. Elderly Independent Living
Allows seniors to live independently while keeping their family informed. "Smart Alerts" act as a safety net if a daily log is missed or shows concerning trends.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase Project (Database + Storage bucket configured)
- Google Gemini API Key from Google AI Studio
- Prisma CLI installed globally

### Installation

```bash
# Clone the repository
git clone https://github.com/shafayatsaad/mimamori.git
cd mimamori

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

### Environment Configuration

Configure your `.env.local` based on `.env.example`. Key variables include:
```env
# Supabase & Gemini Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_google_gemini_api_key
SUPABASE_STORAGE_BUCKET=documents

# Relational Database Configuration
POSTGRES_PRISMA_URL=your_postgres_prisma_url_with_pooling
POSTGRES_URL_NON_POOLING=your_postgres_direct_url

# Authentication / Session
SESSION_JWT_SECRET=your_jwt_signing_secret
```

### Development

```bash
# Initialize database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

### ☁️ Deployment (Vercel)

Mimamori is configured to be deployed easily on Vercel or any other Next.js-compatible hosting platform. 

1. **Connect Repository**: Import the GitHub repository into your Vercel dashboard.
2. **Setup Postgres Database**: In Vercel, navigate to the Storage tab and create a **Vercel Postgres** database or connect your Supabase database.
3. **App Environment Variables**: Add the required environment variables in the Vercel Environment Variables section:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable anonymous key.
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `SESSION_JWT_SECRET`: Secret used to sign JWT session tokens.
4. **Deploy**: Vercel will automatically run the build command (`prisma generate && next build`) and deploy the application.

---

## 🗺️ Roadmap

- [ ] **Wearable Integration**: Direct sync with Apple HealthKit and Google Fit.
- [ ] **Smart Home Voice Skill**: Native Alexa and Google Home versions for hands-free logging.
- [ ] **Pharmacological Interaction Alerts**: AI-driven warnings for potential drug-drug interactions.
- [ ] **Clinician Dashboard**: A specialized web-view tailored specifically for GP/Specialist workflow integration.

---

## 👥 Team

<div align="center">
<table>
<tr>
<td align="center">
  <a href="https://github.com/shafayatsaad">
    <img src="https://github.com/shafayatsaad.png" width="120px" style="border-radius: 50%;" alt="Shafayat Saad"/>
    <br />
    <strong>Shafayat Saad</strong>
  </a>
  <br />
  <sub>Full-Stack Developer & AI Architect</sub>
  <br /><br />
  <a href="https://github.com/shafayatsaad">
    <img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" />
  </a>
  <a href="https://www.linkedin.com/in/shafayatsaad/">
    <img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" />
  </a>
</td>
</tr>
</table>
</div>

---

<div align="center">

<!-- FOOTER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,50:06B6D4,100:8B5CF6&height=120&section=footer" width="100%" />

**Developed with ❤️ for the AIdeas Healthcare Hackathon**

[![Website](https://img.shields.io/badge/🌐_Visit_Website-mimamori--ai.com-10B981?style=for-the-badge)](https://mimamori-ai.com/)

</div>
