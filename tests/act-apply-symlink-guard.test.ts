import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAction } from '../src/act/apply.js'
import { journalPath } from '../src/act/journal.js'
import { existsSync } from 'node:fs'

const roots: string[] = []

async function makeRoot(): Promise<{ actionsDir: string; files: string }> {
  const root = await mkdtemp(join(tmpdir(), 'codeburn-act-symlink-'))
  roots.push(root)
  const files = join(root, 'files')
  await mkdir(files, { recursive: true })
  return { actionsDir: join(root, 'actions'), files }
}

afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true })
})

// A cloned repo can commit a config path (e.g. .claude/settings.json) as a
// symlink pointing outside the project. Since writeFile follows symlinks,
// runAction must refuse rather than clobber whatever the link points at.
describe('runAction symlink guard', () => {
  it('refuses to write through a symlinked edit target, leaving the real target untouched', async () => {
    const { actionsDir, files } = await makeRoot()
    const outside = join(files, 'outside.txt')
    await writeFile(outside, 'secret')
    const link = join(files, 'settings.json')
    await symlink(outside, link)

    await expect(runAction({
      kind: 'guard-install',
      description: 'test',
      changes: [{ op: 'edit', path: link, content: 'clobbered' }],
    }, actionsDir)).rejects.toThrow(/symlink/)

    expect(await readFile(outside, 'utf-8')).toBe('secret')
    expect(existsSync(journalPath(actionsDir))).toBe(false)
  })

  it('refuses to write through a symlinked create target', async () => {
    const { actionsDir, files } = await makeRoot()
    const outside = join(files, 'outside2.txt')
    await writeFile(outside, 'secret2')
    const link = join(files, 'new.json')
    await symlink(outside, link)

    await expect(runAction({
      kind: 'guard-install',
      description: 'test',
      changes: [{ op: 'create', path: link, content: 'clobbered' }],
    }, actionsDir)).rejects.toThrow(/symlink/)

    expect(await readFile(outside, 'utf-8')).toBe('secret2')
  })

  it('still applies normal edits and creates to real files', async () => {
    const { actionsDir, files } = await makeRoot()
    const real = join(files, 'real.json')
    await writeFile(real, 'old')

    const rec = await runAction({
      kind: 'guard-install',
      description: 'test',
      changes: [{ op: 'edit', path: real, content: 'new' }],
    }, actionsDir)

    expect(rec.status).toBe('applied')
    expect(await readFile(real, 'utf-8')).toBe('new')
  })
})
