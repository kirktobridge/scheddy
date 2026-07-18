# Project Journal

Reverse-chronological record of major changes, for lookback — the story of
the project, not the commit log. One entry per shipped chunk of work (a
backlog item, a redesign, a process change), written at product altitude:
*what changed and why*, in 1–3 sentences. Git history holds the details.

Maintained by the **ship** skill's close-out step; work that lands outside
`ship` gets an entry too (see CLAUDE.md → Workflow). The entry format is
enforced by [tests/docsSchema.test.ts](../tests/docsSchema.test.ts).

Entry format:

```markdown
## YYYY-MM-DD — Short title
Refs: B-nn, plan-N (omit line if none)

What changed and why, 1–3 sentences.
```

---

## 2026-07-18 — Executable schema for structured docs

BACKLOG.md and JOURNAL.md formats are now enforced by a vitest suite
(tests/docsSchema.test.ts) that validates IDs, priority/effort values, plan
links against real files, status markers, and journal entry headings/order.
Since `npm test` runs on every change, doc drift now fails the same gate as
code regressions.

## 2026-07-17 — Lifecycle skill suite + this journal

Added the **backlog** skill (idea capture, triage, grooming, status
conventions) and the **ship** skill (plan → implement → verify → doc
close-out → commit), completing the development-lifecycle coverage so
sessions can be driven purely by ideas and "do B-nn". Started this journal
as part of ship's close-out step.

## 2026-07-06 — Process foundation
Refs: B-01…B-23, plans 1–13

Full codebase review produced the backlog (14 improvement items) and a
vision-track brainstorm added 9 more, each grouped into plan docs.
Restructured CLAUDE.md, wrote ARCHITECTURE.md, and added the **verify** and
**visual-check** project skills. The concierge plan (B-23) was repointed
from a cloud API to a local model.

## 2026-06-25 — Desktop-first layout overhaul

A week of layout work (June 24–25) made desktop the primary experience:
day-detail left rail + metrics right rail, auto-hiding top nav, wheel-paged
months with the whole month always visible, and depth styling (shadows on
availability fills and top-pick stars). Desktop became the default
media-query branch; mobile was left frozen.

## 2026-06-17 — Initial build burst

The recorded history starts here (June 16–17): rapid iteration on the Free
page (metrics placement, day cards, relationship controls scoped to the
displayed month), the Scheduler taking shape as the calendar-plus-metrics
main view, and Settings gaining graphical controls for every CSS design
token with curated font stacks.
