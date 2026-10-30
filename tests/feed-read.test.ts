import assert from 'node:assert/strict'
import test from 'node:test'
import { readFeedCollection, FeedReadError } from '../src/lib/server/feed-read.ts'

test('feed reads preserve database errors instead of treating them as empty data', async () => {
  const databaseError = new Error('database unavailable')
  await assert.rejects(
    readFeedCollection('projects', async () => { throw databaseError }),
    error => error instanceof FeedReadError && error.collection === 'projects' && error.cause === databaseError,
  )
})

test('feed reads return successful database results unchanged', async () => {
  const rows = [{ id: 'project-1' }]
  assert.equal(await readFeedCollection('projects', async () => rows), rows)
})
