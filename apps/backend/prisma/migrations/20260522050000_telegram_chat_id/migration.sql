-- Telegram Bot integration: store the chat_id the user obtained from their
-- Telegram client (via @userinfobot or by messaging our bot first).
-- We deliberately don't store the bot token here — that's a single env var.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
