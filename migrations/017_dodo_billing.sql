-- Phase 17: Migrate billing provider from Stripe to Dodo Payments
-- Renames stripe_customer_id and stripe_subscription_id columns to use
-- provider-neutral dodo_ prefixed names. Safe to run on existing data —
-- existing NULL values remain NULL; any previously stored Stripe IDs are
-- preserved in the renamed columns until overwritten by Dodo webhook events.

ALTER TABLE workspaces
  RENAME COLUMN stripe_customer_id     TO dodo_customer_id;

ALTER TABLE workspaces
  RENAME COLUMN stripe_subscription_id TO dodo_subscription_id;
