---
name: backlog
description: Capture, triage, and groom backlog items in docs/BACKLOG.md. Use when the user shares an idea ("idea:", "add to the backlog"), asks what to do next, or asks to groom/reprioritize the backlog.
---

# Backlog: capture → triage → groom

Owns the conventions for [docs/BACKLOG.md](../../../docs/BACKLOG.md) and the
plan docs in [docs/plans/](../../../docs/plans/) so every session files and
updates items the same way. Read BACKLOG.md before doing anything.

## Capturing an idea

1. **Restate** the raw idea as a one-line item title in the backlog's voice
   (outcome-focused, ≤ ~10 words). Confirm the restatement if the idea was
   ambiguous; otherwise proceed.
2. **Check for overlap first.** Scan existing items and plan groupings — a new
   sharing idea probably belongs in plan-9, a metrics idea in plan-11, etc. If
   it's a duplicate or a variant, say so and extend the existing item/plan
   instead of adding a new ID.
3. **Assign the next B-nn ID** (max existing + 1; IDs are never reused).
4. **Rate it** with the existing rubric: priority **P1** (highest user impact)
   / **P2** (valuable) / **P3** (polish); effort **S** (< half day) / **M**
   (day-ish) / **L** (multi-day).
5. **Attach a plan**: link an existing plan doc if the item fits its seam, or
   create `docs/plans/plan-N-<slug>.md` in the style of the others (context,
   items covered, approach, risks). Fixes/improvements go in the main table;
   new-capability ideas go in the Vision track table.
6. Note any dependencies in the "Vision-track dependencies" / grouping
   sections if they exist.

## Status convention

Both tables carry a **Status** column (add it, blank by default, the first
time an item ships):

- blank — open
- `✅ YYYY-MM-DD` — shipped (date of the landing commit)
- `✂️` — dropped, with a one-line reason struck through in the title cell

The **ship** skill marks items shipped; this skill defines the format.

## Grooming (on request)

1. Flag items made stale by shipped work (e.g. a prerequisite landed, or a
   shipped feature absorbed them) — propose dropping or rewording.
2. Re-derive the "Suggested order" section from current priorities, statuses,
   and dependency notes; keep it a short numbered list with one-line
   rationale each.
3. Don't churn priorities without cause — only propose changes you can tie to
   something that happened (user feedback, shipped work, new constraint).

## Answering "what's next?"

Recommend one item (not a menu): highest-priority open item whose
dependencies are shipped, tie-broken by smallest effort. Name the runner-up
in one sentence.
