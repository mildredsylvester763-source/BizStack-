# BizStack Release Reconciliation Contract

This repository intentionally separates four states:
1. Source — the Git branch and commit that contain the implementation.
2. Runtime — Supabase migrations/schema/functions that must exist for the source to work.
3. Deployment — the Vercel artifact that is actually serving the application.
4. Design — the Figma product contract for interaction and visual behavior.

A feature is not complete because it exists in only one of these states.

## Definition of done
- UI and responsive states
- persistent data model
- RLS / authorization
- server/API action
- validation and state transitions
- provider/integration behavior
- webhook/event processing where applicable
- retries and failure/reversal paths
- audit trail
- notifications
- reporting/export
- AI/Operator entry point where appropriate
- loading, empty, success, failure and approval states
- automated verification
- deployment verification
- Figma alignment

## Deployment safety
- main is the production branch.
- Feature branches are development/review states.
- The reconciliation branch is explicitly disabled from Vercel automatic deployment.
- Never remove a feature just to make a deployment green.
- Diagnose the failing layer, repair the root cause, rerun verification, and preserve unrelated functionality.
- A Vercel deployment SHA must never be assumed to equal the latest Git SHA.
- Before a production merge, record the Git SHA, Vercel deployment, Supabase migration state and Figma revision.

## Duplicate-prevention rule
Every capability gets one canonical implementation surface.
Before adding a new file or screen: search for the existing capability; identify its canonical route/component; extend it if it already owns the capability; if two implementations exist, consolidate behavior before deleting either one; keep the feature inventory updated.

## AI Builder contract
The Operator is the primary interaction surface.
Natural language / voice → context → plan → tools → project graph → files/schema/auth/integrations → runtime → tests → self-fix → preview → approval → deploy → logs → version/rollback.
Code, Preview, Files, Terminal, Browser, Diff and Run Timeline are work surfaces of the same project session, not separate disconnected builders.

## Connected app contract
Provider apps use authorization-first connections. API keys belong to Custom Connector unless a provider explicitly requires a user-supplied credential.
Connection state must distinguish disconnected, authorizing, permission review, authorized, verifying, connected, syncing, ready, error, reconnecting and revoked.
Multiple accounts per provider are supported.

## Financial integrity
Money movement must be provider-confirmed. Balances and accounting records must eventually be backed by immutable journal postings and reconciliation. UI-only balances or simulated transfers are not acceptable.

## Source / deployment truth
A failed Vercel build is a deployment problem, not permission to simplify the product.
Release process: source verification → runtime/schema verification → build verification → preview verification → deployment verification → feature inventory reconciliation → production merge.