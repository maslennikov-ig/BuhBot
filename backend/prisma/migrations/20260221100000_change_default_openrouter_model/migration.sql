-- AlterTable: change default OpenRouter model to xiaomi/mimo-v2-flash
ALTER TABLE "settings"
ALTER COLUMN "openrouter_model" SET DEFAULT 'xiaomi/mimo-v2-flash';
