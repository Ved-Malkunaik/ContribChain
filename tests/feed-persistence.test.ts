import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'contribchain-feed-'))
const databaseUrl = `file:${join(directory, 'shared.db').replace(/\\/g, '/')}`
process.env.DATABASE_URL = databaseUrl
process.env.MST_RPC_URL = 'http://127.0.0.1:1'
process.env.NEXT_PUBLIC_MST_RPC_URL = 'http://127.0.0.1:1'

const { db } = await import('../src/lib/server/db.ts')
const { feed } = await import('../src/lib/server/feed.ts')
const { PrismaClient } = await import('@prisma/client')
const secondInstance = new PrismaClient({ datasourceUrl: databaseUrl })

after(async () => {
  await secondInstance.$disconnect()
  await db.$disconnect()
  rmSync(directory, { recursive: true, force: true })
})

test('project and opportunity stay in the feed after a contributor submits from another instance', async () => {
  const project = await db.project.create({
    data: {
      id: 'feed-persistence-project',
      publisherAddress: '0x0000000000000000000000000000000000000001',
      name: 'Persistent project',
      shortDescription: 'Project summary',
      detailedDescription: 'Project details',
      category: 'Tooling',
      technologies: JSON.stringify(['TypeScript']),
      repoId: '123456',
      repoUrl: 'https://github.com/publisher/project',
      liveDappUrl: 'https://example.com',
    },
  })
  const opportunity = await db.opportunity.create({
    data: {
      id: 'feed-persistence-opportunity',
      projectId: project.id,
      publisherAddress: project.publisherAddress,
      title: 'Persistent opportunity',
      taskType: 'feature',
      description: 'Implement a feature',
      acceptanceCriteria: 'The feature works',
      difficulty: 'beginner',
      requiredSkills: JSON.stringify(['TypeScript']),
      rewardEth: '0.1',
      rewardWei: '100000000000000000',
      deadline: new Date(Date.now() + 86400000),
    },
  })

  const initialFeed = await feed()
  assert.ok(initialFeed.projects.some(item => item.id === project.id))
  assert.ok(initialFeed.opportunities.some(item => item.id === opportunity.id))

  await secondInstance.submission.create({
    data: {
      id: 'feed-persistence-submission',
      opportunityId: opportunity.id,
      contributorAddress: '0x0000000000000000000000000000000000000002',
      prUrl: 'https://github.com/publisher/project/pull/1',
      prNumber: 1,
      repoOwner: 'publisher',
      repoName: 'project',
    },
  })

  const refreshedFeed = await feed()
  assert.ok(refreshedFeed.projects.some(item => item.id === project.id))
  assert.ok(refreshedFeed.opportunities.some(item => item.id === opportunity.id))
  assert.ok(refreshedFeed.submissions.some(item => item.id === 'feed-persistence-submission'))
})
