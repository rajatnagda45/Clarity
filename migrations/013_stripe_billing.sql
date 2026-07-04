-- Phase 6: Stripe Billing Integration
-- Adds Stripe customer and subscription tracking to workspaces.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
