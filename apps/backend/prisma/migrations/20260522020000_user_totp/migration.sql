-- Two-factor authentication (TOTP) — RFC 6238, 30-second window, SHA-1, 6 digits.
-- We store the base32 shared secret directly. For higher-stakes deployments,
-- consider encrypting at rest with a KMS key (out of scope for this version).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
