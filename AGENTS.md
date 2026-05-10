# Mimamori - AI Health Monitoring Platform

## Quick Reference

- **Framework**: Next.js 14 App Router + React 18 + TypeScript + Tailwind CSS
- **Location**: All app code is in the project root
- **Primary DB**: AWS DynamoDB (single-table design)
- **Secondary DB**: Prisma + PostgreSQL (CarePlan, PromptTemplate, PermissionType, DocumentCategoryRule)
- **AI**: Amazon Bedrock (Claude 3.5 Haiku primary, Nova fallback) + Comprehend Medical + Textract
- **Auth**: bcrypt + JWT (jose) stored in httpOnly cookies
- **Tests**: Vitest + fast-check, run with `npm test`
- **Build**: `npm run build` (prisma generate + next build)
- **Dev**: `npm run dev`

## Project Architecture

The project follows Next.js 14 App Router conventions with all source code at the repository root.

## Critical Conventions

- Path alias: `@/*` maps to the project root
- API routes follow: auth check -> rate limit -> validate -> business logic -> response
- All AI prompts include `SYSTEM_GUARDRAIL` from `lib/ai/guardrails.ts`
- All user text sanitized via `sanitizeForPrompt()` before AI prompts
- Pure functions with optional config injection for testability
- Named exports preferred (except React page defaults)
- File naming: PascalCase components, kebab-case utilities, kebab-case route directories
- Tests: `<module>.<type>.test.ts` (e.g., `hydration.property.test.ts`)

## User Types

- **Patient**: Full access to all features
- **Caregiver**: Permission-gated access (Diary, Alerts, Vault), can manage multiple linked patients

## Key State

Global state in `context/AppContext.tsx` via React Context. Syncs bidirectionally with DynamoDB. Falls back to localStorage.
