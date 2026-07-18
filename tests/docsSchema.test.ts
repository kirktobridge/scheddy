import { describe, expect, it } from 'vitest'
import { isValid, parseISO } from 'date-fns'
import backlogRaw from '../docs/BACKLOG.md?raw'
import journalRaw from '../docs/JOURNAL.md?raw'

// Schema guard for the structured docs that the backlog/ship skills read and
// edit. If you deliberately evolve a format, change it here in the same commit.

const planFiles = Object.keys(import.meta.glob('../docs/plans/*.md')).map(
  (p) => p.replace('../docs/', ''),
)

/** Split a markdown table line into trimmed cell contents. */
function cells(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim())
}

/** Remove fenced code blocks so format examples don't parse as entries. */
function stripFences(md: string): string {
  return md.replace(/^```[\s\S]*?^```$/gm, '')
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function expectValidDate(s: string, context: string) {
  expect(s, context).toMatch(DATE)
  expect(isValid(parseISO(s)), `${context}: ${s} is not a real date`).toBe(true)
}

describe('BACKLOG.md schema', () => {
  const lines = backlogRaw.split('\n')
  const headerRows = lines.filter((l) => l.startsWith('| ID '))
  const itemRows = lines.filter((l) => /^\| B-\d/.test(l))

  it('has the two item tables with expected columns', () => {
    expect(headerRows.length).toBe(2)
    for (const h of headerRows) {
      const cols = cells(h)
      expect(cols.slice(0, 5)).toEqual(['ID', 'Title', 'Priority', 'Effort', 'Plan'])
      if (cols.length === 6) expect(cols[5]).toBe('Status')
      expect(cols.length).toBeLessThanOrEqual(6)
    }
  })

  it('parses at least the original 23 items', () => {
    expect(itemRows.length).toBeGreaterThanOrEqual(23)
  })

  it('every item row is well-formed', () => {
    const seen = new Set<string>()
    for (const row of itemRows) {
      const [id, title, priority, effort, plan, status] = cells(row)
      expect(id, row).toMatch(/^B-\d{2}$/)
      expect(seen.has(id), `duplicate id ${id}`).toBe(false)
      seen.add(id)
      expect(title, `${id}: empty title`).not.toBe('')
      expect(priority, id).toMatch(/^P[123]$/)
      expect(effort, id).toMatch(/^[SML]$/)

      const link = plan.match(/^\[Plan \d+\]\((plans\/plan-\d+-[a-z0-9-]+\.md)\)$/)
      expect(link, `${id}: plan cell "${plan}" must be [Plan N](plans/plan-N-slug.md)`).not.toBeNull()
      expect(planFiles, `${id}: linked plan file missing`).toContain(link![1])

      if (status !== undefined && status !== '') {
        const shipped = status.match(/^✅ (\d{4}-\d{2}-\d{2})$/)
        const dropped = status.startsWith('✂️')
        expect(shipped !== null || dropped, `${id}: status "${status}" must be blank, "✅ YYYY-MM-DD", or start with ✂️`).toBe(true)
        if (shipped) expectValidDate(shipped[1], `${id} status`)
      }
    }
  })
})

describe('JOURNAL.md schema', () => {
  const body = stripFences(journalRaw)
  const lines = body.split('\n')
  const headings = lines.filter((l) => l.startsWith('## '))

  it('has entries and each heading is "## YYYY-MM-DD — Title"', () => {
    expect(headings.length).toBeGreaterThanOrEqual(4)
    for (const h of headings) {
      const m = h.match(/^## (\d{4}-\d{2}-\d{2}) — .+$/)
      expect(m, `bad journal heading: "${h}"`).not.toBeNull()
      expectValidDate(m![1], h)
    }
  })

  it('entries are in reverse-chronological order', () => {
    const dates = headings.map((h) => h.slice(3, 13))
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] <= dates[i - 1], `entry ${dates[i]} appears below newer ${dates[i - 1]}`).toBe(true)
    }
  })

  it('Refs lines only appear directly under an entry heading', () => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('Refs:')) {
        expect(lines[i - 1]?.startsWith('## '), `stray Refs line: "${lines[i]}"`).toBe(true)
      }
    }
  })
})
