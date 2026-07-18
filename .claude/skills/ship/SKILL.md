---
name: ship
description: Deliver a backlog item end-to-end — plan → implement → verify → doc close-out → commit. Use when asked to "do B-nn", "next item", or hand over any feature-sized chunk of work.
---

# Shipping a backlog item

The full delivery loop for one item from [docs/BACKLOG.md](../../../docs/BACKLOG.md).
Ordered; don't skip the close-out — that's the step that keeps the backlog
truthful across sessions.

## 1. Scope

Read the backlog row and its plan doc in [docs/plans/](../../../docs/plans/).
Restate in 2–3 sentences what will be built and what's explicitly out of
scope, then proceed (don't wait for approval unless the plan conflicts with
the current code or the request).

If the item has an unshipped dependency (see BACKLOG.md dependency notes),
stop and say so instead of silently building the dependency too.

## 2. Implement

Follow the plan doc. Deviations are fine when the code demands them, but
**note each one out loud and in the plan doc** during close-out — never
silently absorb a plan change. Respect the safety invariant (POST-only write
path, no OAuth scope widening) at all times.

## 3. Verify

Run the **verify** skill in full (tests, typecheck, behavior check matched to
the change, safety invariant). For feature-sized diffs, also run `/simplify`
on the working tree before committing.

## 4. Close out docs

- **BACKLOG.md** — mark the item `✅ YYYY-MM-DD` in the Status column (format
  defined by the **backlog** skill; add the column if it doesn't exist yet).
- **Plan doc** — record what shipped and any deviations from the plan; if the
  plan has remaining items, leave it clear what's still open.
- **JOURNAL.md** — append an entry to
  [docs/JOURNAL.md](../../../docs/JOURNAL.md) (format defined there): 1–3
  sentences at product altitude on what changed and why.
- **ARCHITECTURE.md** — update *only if* an invariant, data flow, or module
  boundary changed. Cosmetic/UI work doesn't touch it.
- **CLAUDE.md** — only if a workflow-level fact changed (new command, new
  convention). Rare.

## 5. Commit and push

Straight to `main`, conventional-commit subject ≤ 50 chars, one commit per
coherent change (implementation and doc close-out may be separate commits).
Rerun tests + typecheck if anything changed since verify. Then `git push`.

## Batch mode

Asked for multiple items ("do plan 6")? Ship them one at a time — full loop
per item, commit between items — never one mega-diff.
