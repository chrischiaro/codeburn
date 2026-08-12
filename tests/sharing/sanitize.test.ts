import { describe, it, expect } from 'vitest'

import { sanitizeForSharing } from '../../src/sharing/sanitize.js'
import type { MenubarPayload } from '../../src/menubar-json.js'

function fixture(): MenubarPayload {
  return {
    generated: 'now',
    current: {
      label: 'June',
      cost: 100,
      calls: 5,
      sessions: 2,
      oneShotRate: 1,
      inputTokens: 10,
      outputTokens: 20,
      cacheHitPercent: 90,
      codexCredits: 0,
      topActivities: [{ name: 'Coding', cost: 50, savingsUSD: 0, turns: 3, oneShotRate: 1 }],
      topModels: [{ name: 'Opus', cost: 80, savingsUSD: 0, savingsBaselineModel: '', calls: 4 }],
      providers: { claude: 100 },
      topProjects: [
        { name: 'secret-project', cost: 100, savingsUSD: 0, sessions: 2, avgCostPerSession: 50, sessionDetails: [] },
      ],
      tools: [{ name: 'Bash', calls: 9 }],
      topSessions: [{ project: 'secret-project', cost: 100, savingsUSD: 0, calls: 5, date: '2026-06-01' }],
      pullRequests: {
        rows: [{
          url: 'https://github.com/secret-org/secret-repo/pull/123',
          label: 'secret-org/secret-repo#123',
          cost: 10,
          savingsUSD: 0,
          sessions: 1,
          calls: 2,
          firstStarted: '2026-06-01T00:00:00.000Z',
          lastEnded: '2026-06-01T01:00:00.000Z',
          approx: false,
          models: ['Opus'],
        }],
        distinctCost: 10,
        distinctSessions: 1,
        attributedCost: 10,
        unattributedCost: 0,
      },
      byBranch: [
        { branch: 'secret-branch-name', cost: 10, calls: 2, sessions: 1 },
      ],
    },
    claudeConfigs: {
      selectedId: 'a',
      options: [
        { id: 'a', label: 'Default', path: '/Users/secret-user/.claude' },
        { id: 'b', label: 'Work', path: '/Users/secret-user/work/.claude' },
      ],
    },
    history: {
      daily: [],
      timeline: {
        bucketMinutes: 15,
        modelSeries: [{ id: 'model_0', label: 'claude-opus-4-6' }],
        sessionSeries: [{ id: 'session_0', label: 'secret-project · abc123…cdef (claude)' }],
        points: [{
          timestamp: '2026-06-01T10:00:00.000Z',
          cost: 5,
          tokens: 150,
          models: [{ seriesId: 'model_0', cost: 5, tokens: 150 }],
          sessions: [{ seriesId: 'session_0', cost: 5, tokens: 150 }],
        }],
      },
    },
  } as unknown as MenubarPayload
}

describe('sanitizeForSharing', () => {
  it('strips project names and session detail but keeps aggregates', () => {
    const clean = sanitizeForSharing(fixture())
    expect(clean.current.topProjects).toEqual([])
    expect(clean.current.topSessions).toEqual([])
    expect(clean.current.cost).toBe(100)
    expect(clean.current.topModels[0]!.name).toBe('Opus')
    expect(clean.current.providers).toEqual({ claude: 100 })
    expect(clean.history.timeline?.sessionSeries).toEqual([])
    expect(clean.history.timeline?.points[0]!.sessions).toEqual([])
    expect(clean.history.timeline?.modelSeries).toHaveLength(1)
    expect(clean.history.timeline?.points[0]!.models).toHaveLength(1)
  })

  it('strips pull requests, branch names, and claude config paths', () => {
    const clean = sanitizeForSharing(fixture())
    expect(clean.current.pullRequests).toBeUndefined()
    expect(clean.current.byBranch).toBeUndefined()
    expect(clean.claudeConfigs).toBeUndefined()
  })

  it('leaks no project name, repo, branch, or local path anywhere in the shared payload', () => {
    const clean = sanitizeForSharing(fixture())
    const json = JSON.stringify(clean)
    expect(json).not.toContain('secret-project')
    expect(json).not.toContain('secret-org')
    expect(json).not.toContain('secret-repo')
    expect(json).not.toContain('secret-branch-name')
    expect(json).not.toContain('secret-user')
  })
})
