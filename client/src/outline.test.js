import { describe, it, expect } from 'vitest'
import {
  buildFenceMask,
  classifyLines,
  subtreeRange,
  indentRange,
  shiftHeadingSubtree,
  moveSection,
  handleOutlineKey,
  continueList,
} from './outline'

const lines = (s) => s.split('\n')

// Fake keyboard events for handleOutlineKey
const tab = { key: 'Tab' }
const shiftTab = { key: 'Tab', shiftKey: true }
const cmdUp = { key: 'ArrowUp', metaKey: true }
const cmdDown = { key: 'ArrowDown', metaKey: true }

describe('L1 — classification', () => {
  it('classifies heading levels', () => {
    expect(classifyLines(['## Title'])[0]).toEqual({ type: 'heading', level: 2, indent: 0 })
  })

  it('classifies unordered and ordered list items', () => {
    expect(classifyLines(['  - item'])[0]).toMatchObject({ type: 'list', ordered: false, indent: 2 })
    expect(classifyLines(['3. item'])[0]).toMatchObject({ type: 'list', ordered: true, indent: 0 })
  })

  it('classifies plain and blank lines', () => {
    expect(classifyLines(['plain text'])[0]).toEqual({ type: 'plain', indent: 0 })
    expect(classifyLines(['   '])[0]).toEqual({ type: 'blank' })
  })

  it('keeps 1-3 space indented headings as headings', () => {
    expect(classifyLines(['   # Title'])[0]).toMatchObject({ type: 'heading', level: 1 })
  })

  it('does not treat # inside a fenced code block as a heading', () => {
    const src = lines('```\n# not a heading\n```')
    expect(buildFenceMask(src)).toEqual([true, true, true])
    expect(classifyLines(src)[1].type).toBe('plain')
  })

  it('keeps an unbalanced (unclosed) fence open to end of file', () => {
    const src = lines('```\n# inside\n## still inside')
    expect(buildFenceMask(src)).toEqual([true, true, true])
    expect(classifyLines(src)[2].type).toBe('plain')
  })

  it('does not let a ~~~ line close a backtick fence', () => {
    const src = lines('```\n~~~\n# still inside\n```')
    expect(buildFenceMask(src)).toEqual([true, true, true, true])
    expect(classifyLines(src)[2].type).toBe('plain')
  })
})

describe('L2 — subtree range', () => {
  it('heading range stops at the next same-or-higher heading', () => {
    const infos = classifyLines(lines('## A\n### B\n## C'))
    expect(subtreeRange(infos, 0)).toEqual([0, 1])
  })

  it('list range includes deeper-indented children', () => {
    const infos = classifyLines(lines('- a\n  - b\n- c'))
    expect(subtreeRange(infos, 0)).toEqual([0, 1])
  })

  it('plain line has no subtree', () => {
    const infos = classifyLines(lines('plain'))
    expect(subtreeRange(infos, 0)).toEqual([0, 0])
  })
})

describe('L3 — transforms', () => {
  it('indentRange adds and removes 2 spaces', () => {
    expect(indentRange(['- a'], 0, 0, 2)).toEqual(['  - a'])
    expect(indentRange(['  - a'], 0, 0, -2)).toEqual(['- a'])
  })

  it('indentRange aborts outdent at column 0', () => {
    expect(indentRange(['- a'], 0, 0, -2)).toBeNull()
  })

  it('shiftHeadingSubtree demotes a heading and its sub-headings', () => {
    const src = lines('## A\n### B')
    const infos = classifyLines(src)
    expect(shiftHeadingSubtree(src, infos, 0, 1, 1)).toEqual(['### A', '#### B'])
  })

  it('shiftHeadingSubtree aborts at the h1/h6 cap', () => {
    const infos = classifyLines(['# A'])
    expect(shiftHeadingSubtree(['# A'], infos, 0, 0, -1)).toBeNull()
    const infos6 = classifyLines(['###### A'])
    expect(shiftHeadingSubtree(['###### A'], infos6, 0, 0, 1)).toBeNull()
  })

  it('moveSection swaps a heading section with its next sibling', () => {
    const src = lines('## A\ntext\n## B\nmore')
    const infos = classifyLines(src)
    const res = moveSection(src, infos, 0, 'down')
    expect(res.lines).toEqual(['## B', 'more', '## A', 'text'])
  })

  it('moveSection returns null when there is no sibling', () => {
    const src = lines('# Parent\n## Only')
    const infos = classifyLines(src)
    expect(moveSection(src, infos, 1, 'down')).toBeNull()
  })
})

describe('L3 — handleOutlineKey dispatcher', () => {
  it('Tab on a heading demotes it', () => {
    const res = handleOutlineKey('## Title', 4, 4, tab)
    expect(res.content).toBe('### Title')
  })

  it('Shift+Tab at h1 is a no-op', () => {
    expect(handleOutlineKey('# Title', 3, 3, shiftTab)).toBeNull()
  })

  it('Tab on a list item indents it with its children', () => {
    const res = handleOutlineKey('- a\n  - b', 1, 1, tab)
    expect(res.content).toBe('  - a\n    - b')
  })

  it('Cmd+Down on a heading swaps it with the next section', () => {
    const res = handleOutlineKey('## A\n## B', 0, 0, cmdDown)
    expect(res.content).toBe('## B\n## A')
  })

  it('Cmd+Up on the first line is a no-op', () => {
    expect(handleOutlineKey('## A\n## B', 1, 1, cmdUp)).toBeNull()
  })

  it('multi-line Tab applies the per-line context rule', () => {
    // selection spans a heading line and a list line
    const content = '## H\n- item'
    const res = handleOutlineKey(content, 0, content.length, tab)
    expect(res.content).toBe('### H\n  - item')
  })

  it('multi-line Tab over a 3-line heading+list+plain selection', () => {
    const content = '## H\n- item\nplain'
    const res = handleOutlineKey(content, 0, content.length, tab)
    expect(res.content).toBe('### H\n  - item\n  plain')
  })

  it('Cmd+Down on a list item swaps it with the next sibling', () => {
    const res = handleOutlineKey('- a\n- b', 0, 0, cmdDown)
    expect(res.content).toBe('- b\n- a')
  })

  it('Cmd+Up on a list item carries its nested children', () => {
    // move "- b" (with child "  - b1") above sibling "- a"
    const content = '- a\n- b\n  - b1'
    const res = handleOutlineKey(content, 4, 4, cmdUp)
    expect(res.content).toBe('- b\n  - b1\n- a')
  })

  it('returns null for non-outline keys', () => {
    expect(handleOutlineKey('abc', 0, 0, { key: 'a' })).toBeNull()
  })
})

describe('L3 — continueList (Enter list continuation)', () => {
  it('continues an unordered list item', () => {
    expect(continueList('- item', 6, 6).content).toBe('- item\n- ')
  })

  it('continues an ordered list item with the next number', () => {
    expect(continueList('1. item', 7, 7).content).toBe('1. item\n2. ')
  })

  it('continues a task list item, reset to unchecked', () => {
    expect(continueList('- [ ] task', 10, 10).content).toBe('- [ ] task\n- [ ] ')
    expect(continueList('- [x] done', 10, 10).content).toBe('- [x] done\n- [ ] ')
  })

  it('preserves indentation of a nested list item', () => {
    expect(continueList('  - item', 8, 8).content).toBe('  - item\n  - ')
  })

  it('ends the list when Enter is pressed on an empty item', () => {
    expect(continueList('- ', 2, 2).content).toBe('')
    expect(continueList('  - [ ] ', 8, 8).content).toBe('')
  })

  it('splits the line and carries the marker when the cursor is mid-content', () => {
    const res = continueList('- hello world', 8, 8)
    expect(res.content).toBe('- hello \n- world')
    expect(res.selStart).toBe(11) // just after the new "- " marker
  })

  it('returns null on a non-list line', () => {
    expect(continueList('plain text', 5, 5)).toBeNull()
  })

  it('returns null when there is a selection', () => {
    expect(continueList('- item', 2, 5)).toBeNull()
  })

  it('returns null for a list-like line inside a fenced code block', () => {
    const src = '```\n- not a list\n```'
    expect(continueList(src, 16, 16)).toBeNull()
  })
})
