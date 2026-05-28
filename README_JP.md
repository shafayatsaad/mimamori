<div align="center">

<!-- アニメーションヘッダー -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,50:06B6D4,100:8B5CF6&height=220&section=header&text=Mimamori%20AI&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=AI駆動型ヘルスケア・ウェルネスコンパニオン&descAlignY=55&descSize=18&descColor=ffffff" width="100%" />

<!-- 言語切り替え -->
[ 🇬🇧 English ](README.md) | [ 🇯🇵 日本語 ](README_JP.md)

<br />

<!-- テクノロジーバッジ -->
[![Next.js](https://img.shields.io/badge/Next.js-14.x-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![DynamoDB](https://img.shields.io/badge/Amazon-DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)

<br />

![Mimamori Hero](image.png)

<br />

<p>
  <b>Mimamori AI</b> は、診察の合間に生じる<b>「臨床データの空白（Clinical Data Gap）」</b>を埋める、プロアクティブなヘルスケア・モニタリングプラットフォームです。日常の音声ログを<b>医師が活用可能な臨床的インサイト</b>に変換し、リアルタイムのAI合成とスマートアラートを通じて、患者の自己管理を支援し、介助者に安心を提供します。
</p>

<br />

<!-- アクションボタン -->
[![ライブデモ](https://img.shields.io/badge/🌐_ライブデモ-サイトを表示-10B981?style=for-the-badge&labelColor=1E293B)](https://mimamori-ai.com/)
[![リポジトリにスター](https://img.shields.io/badge/⭐_スターで応援-Support_Us-FFD700?style=for-the-badge&labelColor=1E293B)](https://github.com/shafayatsaad/mimamori)
[![記事を読む](https://img.shields.io/badge/📖_ケーススタディ-AWS_Builder-FF9900?style=for-the-badge&labelColor=1E293B)](https://builder.aws.com/content/3AAMRb7lRzAJnleldfYBBtfM1WG/aideas-transforming-healthcare-into-ai-powered-wellness-companion)

</div>

---

## 📋 目次

- [🎯 概要](#-概要)
- [🚨 臨床データの空白（課題）](#-臨床データの空白（課題）)
- [✨ 主要機能](#-主要機能)
- [🧠 AI & 機械学習の深掘り](#-ai--機械学習の深掘り)
- [🛡️ セキュリティとデータプライバシー](#️-セキュリティとデータプライバシー)
- [🏗️ システムアーキテクチャ](#️-システムアーキテクチャ)
- [🛠️ 技術スタック](#️-技術スタック)
- [📖 ユースケース](#-ユースケース)
- [🚀 セットアップ方法](#-セットアップ方法)
- [🗺️ ロードマップ](#️-ロードマップ)
- [👥 チーム](#-チーム)

---

## 🎯 概要

**Mimamori（みまもり）** は、慢性疾患や日常の健康状態のモニタリング方法を革新するために構築されました。**AWS Bedrock** と **Kiro IDE** を活用して開発されたこのプラットフォームは、患者が診察室の外で過ごす99.9%の時間を「データのブラックボックス」にさせません。

### なぜ Mimamori なのか？

- 🎙️ **音声ファースト**: タイピングの手間なく、自然な会話で症状を記録。
- 🧠 **医療インテリジェンス**: Amazon Comprehend Medical を使用して臨床エンティティを抽出。
- 🔔 **予防的な安全性**: 健康トレンドに悪化の兆候が見られた際にスマートアラートを受信。
- 👨‍👩‍👧 **ケアサークル**: 家族、介助者、医師を一つのダッシュボードでシームレスに接続。

---

## 🚨 臨床データの空白（課題）

現代のヘルスケアは、エピソード的（断続的）かつ反応的なものになりがちです。患者は年間8,700時間以上を診察室の外で過ごしており、そこでの重要な健康データは失われてしまいます。Mimamori はこの問題を解決します：

| 課題 | 影響 | Mimamori の解決策 |
|------|------|-------------------|
| ❌ **断続的なケア** | 診察の合間の重要な症状を見逃す | 音声による**継続的なログ記録** |
| ❌ **想起バイアス** | 医師に症状を正確に伝えるのが困難 | **合成されたPDFレポート** |
| ❌ **介助者の孤立** | 家族がリアルタイムの状況を把握できない | **共有ケアサークルダッシュボード** |
| ❌ **非構造化データ** | 健康日記が整理されず分析が困難 | **Comprehend Medical によるNLP抽出** |

---

## ✨ 主要機能

| 機能 | 説明 |
|------|------|
| 🗣️ **音声症状ログ** | 口語のニュアンスや非線形な発話を理解するAI駆動の音声キャプチャ。 |
| 🧬 **臨床データ合成** | 医療グレードのNLPを使用し、処方薬、疾患名、用法、バイタルを自動抽出。 |
| 📑 **医師向けレポート** | 長期的なトレンド可視化と異常検知を備えた、包括的なPDF健康サマリー。 |
| ⚠️ **スマートアラート** | 脈拍や酸素飽和度の異常、症状の悪化トレンドをSNS/SESでリアルタイム通知。 |
| 🛡️ **ヘルスボルト** | Textract によるOCR解析を備えた、検査結果や処方箋の安全な暗号化保存。 |
| 🤝 **ケアサークル** | 家族や医療チームと健康アップデートを共有するための詳細な権限設定。 |

---

## 🧠 AI & 機械学習の深掘り

Mimamori は、臨床的な正確性を確保するためにマルチモデル・オーケストレーション戦略を採用しています。

### 1. 自然言語処理 (NLP)
**Amazon Comprehend Medical** を使用して、構造化されていない音声ログを解析します。これにより以下を特定します：
*   **PHM (個人健康メタデータ)**: 服薬情報と投与量。
*   **解剖学的識別子**: 痛みや違和感のある部位。
*   **標準医療コード**: 専門的なレビューのための ICD-10 や RxNorm へのマッピング。

### 2. 大規模言語モデル (LLM)
**Amazon Bedrock (Nova Pro/Micro)** が主要な推論エンジンとして機能します：
*   数日〜数週間のログを簡潔なサマリーに合成。
*   感情分析を行い、身体的健康悪化の重要な指標である心理的変化を検知。
*   エントリーをトリアージし、「ケアサークル」への即時アラートが必要か判断。

---

## 🛡️ セキュリティとデータプライバシー

患者データは最高レベルのセキュリティで保護されています：

*   **保存データの暗号化**: **DynamoDB** と **S3** 内のすべての機密データは AWS KMS で暗号化。
*   **HIPAA 準拠設計**: データの分離と監査トレイルを確保し、HIPAAの原則に基づいたアーキテクチャ。
*   **安全な認証**: パスワードハッシュ化用の **bcrypt** と、`httpOnly` クッキーに保存されるステートレスな **JWT (jose)** トークンを使用した安全なカスタム認証システムを採用。
*   **ステートレス処理**: 個人健康情報 (PHI) は動的に処理され、AIモデルのプロンプト用にサニタイズされます。

---

## 🏗️ システムアーキテクチャ

```mermaid
graph TD
    User((ユーザー/患者)) -->|音声/テキスト| NextJS[Next.js 14 フロントエンド]
    NextJS -->|認証| JWT[JWT + bcrypt 認証]
    NextJS -->|AI推論| Bedrock[Amazon Bedrock / Nova]
    NextJS -->|NLPエンティティ抽出| CompMed[Amazon Comprehend Medical]
    NextJS -->|OCR解析| Textract[Amazon Textract]
    NextJS -->|安全なストレージ| S3[Amazon S3]
    NextJS -->|状態管理| Dynamo[Amazon DynamoDB]
    NextJS -->|メタデータ| Postgres[Prisma + PostgreSQL]
    Bedrock -->|インサイト| NextJS
    CompMed -->|臨床エンティティ| NextJS
    NextJS -->|アラートをトリガー| SNS[SES / SNS 通知]
    SNS -->|アラート配信| Caregiver((介助者/医師))
```

---

## 🛠️ 技術スタック

| レイヤー | 使用技術 | 用途 |
|---------|----------|------|
| **フロントエンド** | Next.js 14 (App Router) | 高性能でSEOに強いフレームワーク |
| **スタイリング** | Tailwind CSS + カスタムCSS | グラスモーフィズムとプレミアムなUI/UX |
| **アニメーション** | Framer Motion | 滑らかなインタラクションと動的な遷移 |
| **AIレイヤー** | Amazon Bedrock (Nova) | 推論、要約、および感情分析 |
| **医療用NLP** | Amazon Comprehend Medical | 臨床オントロジーの抽出 |
| **OCRレイヤー** | Amazon Textract | 医療文書の高度なパース |
| **データベース** | DynamoDB + Prisma (PostgreSQL) | スケーラブルな状態管理とリレーショナルメタデータ |
| **認証** | bcrypt + JWT (jose) | クッキーベースの安全なセッション管理 |
| **メッセージング** | Amazon SES / SNS | 即時のマルチチャネル通知 |

---

## 📖 ユースケース

### 1. 慢性疾患の管理
COPD、CHF、糖尿病などの患者が日常のバイタルを自然に記録できます。Mimamori は、医師が必要とするが患者が忘れがちな「デルタ（時間の経過による変化）」を追跡します。

### 2. 術後の回復
回復の進捗や、感染症・合併症の初期兆候を追跡します。AIは、苦痛や痛みの悪化を示唆する可能性のある微妙な言語表現の変化を検知します。

### 3. 高齢者の自立支援
高齢者が自立して生活することを可能にしつつ、家族に状況を知らせます。「スマートアラート」は、ログの記録漏れや懸念されるトレンドがあった際のセーフティネットとして機能します。

---

## 🚀 セットアップ方法

### 前提条件

- Node.js 18以上
- AWS アカウント (Bedrock, DynamoDB, S3 へのアクセス権限)
- Prisma CLI がグローバルにインストールされていること

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/shafayatsaad/mimamori.git
cd mimamori

# 依存関係をインストール
npm install

# 環境変数の設定
cp .env.example .env.local
```

### 環境設定

`.env.example` で定義されているキーを使用して `.env.local` を構成します。主な環境変数は以下の通りです：
```env
# インフラ & AWS 設定
APP_REGION=us-west-2
APP_S3_BUCKET_NAME=your_s3_bucket_name
APP_SES_FROM_EMAIL=your_verified_sender_email
APP_BEDROCK_ROUTER_ARN=your_bedrock_router_arn
MIMAMORI_USERS_TABLE=your_users_table_name
MIMAMORI_DATA_TABLE=your_data_table_name

# リレーショナルデータベース設定
POSTGRES_PRISMA_URL=your_postgres_prisma_url_with_pooling
POSTGRES_URL_NON_POOLING=your_postgres_direct_url

# セッション & 認証設定
SESSION_JWT_SECRET=your_jwt_signing_secret
```

### 開発環境の起動

```bash
# データベースの初期化
npx prisma generate
npx prisma db push

# 開発サーバーの起動
npm run dev
```

---

## 🗺️ ロードマップ

- [ ] **ウェアラブル連携**: Apple HealthKit および Google Fit との直接同期。
- [ ] **スマートホーム音声スキル**: ハンズフリー記録のための Alexa および Google Home ネイティブ版。
- [ ] **薬物相互作用アラート**: AIによる潜在的な薬物間相互作用の警告。
- [ ] **臨床医向けダッシュボード**: かかりつけ医や専門医のワークフローに最適化された専用ウェブビュー。

---

## 👥 チーム

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
  <sub>フルスタックデベロッパー & AIアーキテクト</sub>
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

<!-- フッター -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,50:06B6D4,100:8B5CF6&height=120&section=footer" width="100%" />

**AIdeas Healthcare ハッカソンのために ❤️ を込めて開発**

[![ウェブサイト](https://img.shields.io/badge/🌐_ウェブサイトを表示-10B981?style=for-the-badge)](https://mimamori-ai.com/)

</div>
