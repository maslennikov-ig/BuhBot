-- Add OpenRouter API settings to global_settings table
ALTER TABLE "public"."global_settings" 
ADD COLUMN IF NOT EXISTS "openrouter_api_key" TEXT,
ADD COLUMN IF NOT EXISTS "openrouter_model" TEXT NOT NULL DEFAULT 'openai/gpt-oss-120b';
