import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'contribchain-webhook-'))
const filename = join(directory, 'test.db')
process.env.DATABASE_URL = 'file:' + filename.replace(/\\/g, '/')
process.env.APP_URL = 'http://localhost:3000'
process.env.GITHUB_WEBHOOK_SECRET = 'webhook-test-secret'

const sqlite = new DatabaseSync(filename)
for (const migration of [
  '202610170001_init',
  '202610170002_session_generation',
  '202610170003_deployment_scope',
  '202610170004_user_custom_fields',
  '202610290005_platform_records',
  '202610290006_unified_identity',
]) {
  sqlite.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'))
}
sqlite.close()

const { db } = await import('../src/lib/server/db.ts')
const { contractAddress } = await import('../src/lib/contract.ts')
const { POST } = await import('../src/app/api/webhooks/github/route.ts')
const originalFetch = globalThis.fetch
let githubRequests = 0
let merged = true
const repo = { id: 123, full_name: 'publisher/demo', private: false, owner: { id: 101, type: 'User' }, html_url: 'https://github.com/publisher/demo' }
globalThis.fetch = (async () => {
  githubRequests += 1
  return Response.json({
    number: 1,
    title: 'Verified PR',
    html_url: 'https://github.com/publisher/demo/pull/1',
    state: merged ? 'closed' : 'open',
    merged,
    merged_at: merged ? '2026-10-28T12:00:00Z' : null,
    user: { id: 202, login: 'contributor' },
    base: { repo },
    head: { sha: 'current-commit' },
  })
}) as typeof fetch

after(async () => {
  globalThis.fetch = originalFetch
  await db.$disconnect()
  rmSync(directory, { recursive: true, force: true })
})

async function deliver(deliveryId: string, repositoryId = 123, pullNumber = 1, validSignature = true) {
  const body = JSON.stringify({ action: 'synchronize', repository: { id: repositoryId }, pull_request: { number: pullNumber } })
  const signature = 'sha256=' + createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!).update(body).digest('hex')
  return POST(new Request('http://localhost:3000/api/webhooks/github', {
    method: 'POST',
    headers: {
      'x-github-delivery': deliveryId,
      'x-github-event': 'pull_request',
      'x-hub-signature-256': validSignature ? signature : 'sha256=invalid',
    },
    body,
  }))
}

test('GitHub webhook rejects invalid signatures and ignores unmatched repositories', async () => {
  assert.equal((await deliver('invalid', 123, 1, false)).status, 401)
  const wrongRepo = await deliver('wrong-repository', 999)
  assert.equal(wrongRepo.status, 200)
  assert.equal((await wrongRepo.json()).matchedSubmissionsCount, 0)
  assert.equal(githubRequests, 0)
})

test('GitHub webhook refreshes REST truth once per delivery and ignores duplicate delivery IDs', async () => {
  const now = new Date(Date.now() - 60_000)
  await db.verifiedSubmission.create({
    data: {
      id: 'verified-pr',
      opportunityId: '1',
      wallet: '0x' + '11'.repeat(20),
      githubId: '202',
      repoId: '123',
      prNumber: 1,
      reference: '123:1',
      url: 'https://github.com/publisher/demo/pull/1',
      title: 'Old title',
      login: 'contributor',
      notes: '',
      prState: 'open',
      commit: 'old-commit',
      syncedAt: now,
      nextSyncAt: now,
      chainRef: '1',
      chainAddress: contractAddress!.toLowerCase(),
    },
  })
  const first = await deliver('delivery-once')
  assert.equal(first.status, 200)
  assert.equal((await db.verifiedSubmission.findUniqueOrThrow({ where: { id: 'verified-pr' } })).prState, 'merged')
  const callsAfterFirst = githubRequests
  assert.equal((await deliver('delivery-once')).status, 200)
  assert.equal(githubRequests, callsAfterFirst)

  merged = false
  assert.equal((await deliver('delivery-older-event')).status, 200)
  assert.equal((await db.verifiedSubmission.findUniqueOrThrow({ where: { id: 'verified-pr' } })).prState, 'open')
})
