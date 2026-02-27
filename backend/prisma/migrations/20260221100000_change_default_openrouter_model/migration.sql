-- AlterTable: change default OpenRouter model to xiaomi/mimo-v2-flash
ALTER TABLE "global_settings"
ALTER COLUMN "openrouter_model" SET DEFAULT 'xiaomi/mimo-v2-flash';
