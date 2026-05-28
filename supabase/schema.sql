-- Mimamori Supabase Schema (PostgreSQL)
-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS "public"."alerts" CASCADE;
DROP TABLE IF EXISTS "public"."documents" CASCADE;
DROP TABLE IF EXISTS "public"."hydration_logs" CASCADE;
DROP TABLE IF EXISTS "public"."journals" CASCADE;
DROP TABLE IF EXISTS "public"."user_state" CASCADE;
DROP TABLE IF EXISTS "public"."reset_tokens" CASCADE;
DROP TABLE IF EXISTS "public"."users" CASCADE;

-- 1. Users Table
CREATE TABLE "public"."users" (
    "email" VARCHAR PRIMARY KEY,
    "name" VARCHAR NOT NULL,
    "password" VARCHAR NOT NULL,
    "role" VARCHAR NOT NULL DEFAULT 'patient',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User State Table
CREATE TABLE "public"."user_state" (
    "email" VARCHAR PRIMARY KEY REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "profile" JSONB DEFAULT '{}'::jsonb,
    "caregivers" JSONB DEFAULT '[]'::jsonb,
    "invitations" JSONB DEFAULT '[]'::jsonb,
    "appointments" JSONB DEFAULT '[]'::jsonb,
    "custom_notes" JSONB DEFAULT '[]'::jsonb,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Journals Table
CREATE TABLE "public"."journals" (
    "id" VARCHAR PRIMARY KEY,
    "email" VARCHAR NOT NULL REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "date" VARCHAR NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_journals_email ON "public"."journals"("email");
CREATE INDEX idx_journals_date ON "public"."journals"("date");

-- 4. Hydration Logs Table
CREATE TABLE "public"."hydration_logs" (
    "id" VARCHAR PRIMARY KEY,
    "email" VARCHAR NOT NULL REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "date" VARCHAR NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_hydration_logs_email ON "public"."hydration_logs"("email");
CREATE INDEX idx_hydration_logs_date ON "public"."hydration_logs"("date");

-- 5. Documents Table
CREATE TABLE "public"."documents" (
    "id" VARCHAR PRIMARY KEY,
    "email" VARCHAR NOT NULL REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "type" VARCHAR NOT NULL DEFAULT 'unknown',
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_documents_email ON "public"."documents"("email");

-- 6. Alerts Table
CREATE TABLE "public"."alerts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR NOT NULL REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT FALSE,
    "source_doc_id" VARCHAR,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_alerts_email_created_at ON "public"."alerts"("email", "created_at" DESC);

-- 7. Reset Tokens Table
CREATE TABLE "public"."reset_tokens" (
    "token" VARCHAR PRIMARY KEY,
    "email" VARCHAR NOT NULL REFERENCES "public"."users"("email") ON DELETE CASCADE,
    "used" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_reset_tokens_email ON "public"."reset_tokens"("email");

-- ========================================================================================
-- Row Level Security (RLS)
-- ========================================================================================

-- Enable RLS on all tables
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."journals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hydration_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reset_tokens" ENABLE ROW LEVEL SECURITY;

-- Note: The API routes use the SUPABASE_SERVICE_ROLE_KEY to interact with the database.
-- The service_role key bypasses RLS by default. By enabling RLS without adding any explicit 
-- public or authenticated policies, we effectively deny all direct client-side (anon) access 
-- to these tables, which is the correct security posture for this application.

-- ========================================================================================
-- Storage Buckets Configuration
-- ========================================================================================

-- Create the 'documents' storage bucket (private, 50MB limit)
-- Note: RLS on storage.objects is managed internally by Supabase — do NOT alter it here.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Access is done via the Next.js API using the service_role key, which bypasses RLS.
-- No explicit client-side storage policies are needed.
