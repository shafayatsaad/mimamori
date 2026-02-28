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
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![DynamoDB](https://img.shields.io/badge/Amazon-DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)

<br />

<p>
  <b>Mimamori AI</b> is a proactive healthcare monitoring platform that bridges the <b>Clinical Data Gap</b> between patient visits. By transforming natural voice logs into <b>doctor-ready clinical insights</b>, it empowers patients and provides peace of mind to caregivers through real-time AI synthesis and smart alerts.
</p>

<br />

<!-- ACTION BUTTONS -->
[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-10B981?style=for-the-badge&labelColor=1E293B)](https://mimamori-ai.com/)
[![Star This Repo](https://img.shields.io/badge/⭐_Star_This_Repo-Support_Us-FFD700?style=for-the-badge&labelColor=1E293B)](https://github.com/shafayatsaad/mimamori)
[![Read Article](https://img.shields.io/badge/📖_Case_Study-AWS_Builder-FF9900?style=for-the-badge&labelColor=1E293B)](https://builder.aws.com/content/3AAMRb7lRzAJnleldfYBBtfM1WG/aideas-transforming-healthcare-into-ai-powered-wellness-companion)

</div>

---

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [🚨 The Clinical Data Gap](#-the-clinical-data-gap)
- [✨ Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [🤖 AI Agent Ecosystem](#-ai-agent-ecosystem)
- [👥 Team](#-team)

---

## 🎯 Overview

**Mimamori** (meaning "watching over" in Japanese) was built to transform how chronic conditions and daily wellness are monitored. Developed using **AWS Bedrock** and **Kiro IDE**, the platform ensures that the 99.9% of time patients spend outside of clinics is no longer a data "black box."

### Why Mimamori?

- 🎙️ **Voice-First**: Log symptoms naturally without the friction of typing.
- 🧠 **Medical Intelligence**: Extract clinical entities using Amazon Comprehend Medical.
- 🔔 **Proactive Safety**: Receive smart alerts when health trends show signs of deterioration.
- 👨‍👩‍👧 **Care Circle**: Seamlessly connect family, caregivers, and doctors on a single dashboard.

---

## 🚨 The Clinical Data Gap

Modern healthcare is often episodic and reactive. Mimamori solves the critical disconnects in current care models:

| Problem | Impact | Mimamori Solution |
|---------|--------|-------------------|
| ❌ **Episodic Care** | Critical symptoms missed between visits | **Continuous Logging** via voice |
| ❌ **Recall Bias** | Patients struggle to articular symptoms to doctors | **Synthesized PDF Reports** |
| ❌ **Caregiver Isolation** | Family members lack real-time visibility | **Shared Care Circle Dashboard** |
| ❌ **Unstructured Data** | Health diaries are messy and hard to analyze | **Comprehend Medical NLP Extraction** |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🗣️ **Voice Symptoms Log** | AI-powered voice capture that understands colloquial nuances. |
| 🧬 **Clinical Synthesis** | Automated extraction of medications, conditions, and vitals. |
| 📑 **Doctor-Ready Reports** | Comprehensive PDF health summaries with trend visualizations. |
| ⚠️ **Smart Alerts** | Real-time notifications for pulse/oxygen anomalies or worsening trends. |
| 🛡️ **Health Vault** | Encrypted storage for lab reports and medical prescriptions via Textract. |
| 🤝 **Care Circle** | Transparent health monitoring for the entire patient support network. |

---

## 🏗️ System Architecture

```mermaid
graph TD
    User((User/Patient)) -->|Voice/Text| NextJS[Next.js 14 Frontend]
    NextJS -->|Auth| Amplify[AWS Amplify Auth]
    NextJS -->|API Requests| Bedrock[Amazon Bedrock / Nova]
    NextJS -->|NLP Extraction| CompMed[Amazon Comprehend Medical]
    NextJS -->|OCR Analysis| Textract[Amazon Textract]
    NextJS -->|Secure Storage| S3[Amazon S3]
    NextJS -->|State Mgmt| Dynamo[Amazon DynamoDB]
    NextJS -->|Relational Data| SQLite[Prisma + SQLite]
    Bedrock -->|Insights| NextJS
    CompMed -->|Entities| NextJS
    NextJS -->|Alerts| SNS[SES / SNS Notifications]
    SNS -->|Notifications| Caregiver((Caregiver/Doctor))
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 (App Router) | Core Application Framework |
| **Logic** | React 18 + TypeScript | Component & State Logic |
| **Styling** | Tailwind CSS | Modern Glassmorphism UI |
| **Animation** | Framer Motion | Smooth Transitions & Micro-interactions |
| **AI Engine** | Amazon Bedrock (Nova Micro/Pro) | Primary LLM Reasoning |
| **Medical NLP** | Amazon Comprehend Medical | Clinical Entity Extraction |
| **Document AI** | Amazon Textract | Medical Document OCR |
| **Databases** | DynamoDB + Prisma (SQLite) | Data Persistence |
| **Messaging** | Amazon SES / SNS | Smart Alerts & Notifications |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS Account (Bedrock, DynamoDB access)
- Prisma CLI

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

### Development

```bash
# Generate Prisma Client
npx prisma generate

# Run the dev server
npm run dev
```

_The application will be available at `http://localhost:3000`_

---

## 🤖 AI Agent Ecosystem

Mimamori utilizes a multi-agent orchestrated system:

1. **Diary Agent**: Captures and routes voice logs to appropriate handlers.
2. **Clinical Extraction Agent**: Uses Comprehend Medical to structure raw text into medical ontologies.
3. **Alert Specialist**: Correlates daily vitals against baseline thresholds to trigger SNS alerts.
4. **Synthesis Agent**: Generates professional summaries for clinical review.

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
  <sub>Full-Stack Developer</sub>
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
