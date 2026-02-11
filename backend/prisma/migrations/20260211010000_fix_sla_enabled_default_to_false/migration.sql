-- Fix: Align slaEnabled schema default with actual behavior
-- chat-event.handler.ts always creates new chats with slaEnabled=false,
-- but the schema default was @default(true), which is misleading.
-- No UPDATE needed — existing chats already have the correct values
-- set explicitly by the handler.

ALTER TABLE "public"."chats"
  ALTER COLUMN "sla_enabled" SET DEFAULT false;
