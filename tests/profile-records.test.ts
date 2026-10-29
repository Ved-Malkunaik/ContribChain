import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'contribchain-profile-records-'))
const filename = join(directory, 'test.db')
process.env.DATABASE_URL = 'file:' + filename.replace(/\\/g, '/')
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
after(async () => {
  await db.$disconnect()
  rmSync(directory, { recursive: true, force: true })
})

test('project, opportunity, and contribution records reference their verified user profiles', async () => {
  const publisher = await db.user.create({
    data: {
      name: 'Publisher',
      githubId: 'github-publisher',
      githubUsername: 'publisher',
      walletAddress: '0x0000000000000000000000000000000000000001',
      accounts: { create: { provider: 'github', type: 'oauth', providerAccountId: 'github-publisher' } },
    },
  })
  const contributor = await db.user.create({
    data: {
      name: 'Contributor',
      githubId: 'github-contributor',
      githubUsername: 'contributor',
      walletAddress: '0x0000000000000000000000000000000000000002',
      accounts: { create: { provider: 'github', type: 'oauth', providerAccountId: 'github-contributor' } },
    },
  })
  const project = await db.project.create({
    data: {
      id: 'project-profile-link',
      publisherUserId: publisher.id,
      publisherAddress: publisher.walletAddress!,
      name: 'Project',
      shortDescription: 'Short',
      detailedDescription: 'Details',
      category: 'Tools',
      technologies: '[]',
      repoId: '123',
      repoUrl: 'https://github.com/publisher/project',
      liveDappUrl: 'https://project.example',
    },
  })
  const opportunity = await db.opportunity.create({
    data: {
      id: 'opportunity-profile-link',
      projectId: project.id,
      publisherUserId: publisher.id,
      publisherAddress: publisher.walletAddress!,
      title: 'Task',
      taskType: 'feature',
      description: 'Description',
      acceptanceCriteria: 'Criteria',
      difficulty: 'Beginner',
      requiredSkills: '[]',
      rewardEth: '1',
      rewardWei: '1000000000000000000',
      deadline: new Date(Date.now() + 86400000),
    },
  })
  await db.submission.create({
    data: {
      id: 'submission-profile-link',
      opportunityId: opportunity.id,
      contributorUserId: contributor.id,
      contributorAddress: contributor.walletAddress!,
      githubUsername: contributor.githubUsername,
      githubUserId: contributor.githubId,
      prUrl: 'https://github.com/publisher/project/pull/1',
      prNumber: 1,
      repoOwner: 'publisher',
      repoName: 'project',
    },
  })

  const saved = await db.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { publisher: true, opportunities: { include: { publisher: true, submissions: { include: { contributor: true } } } } },
  })
  assert.equal(saved.publisher?.githubId, 'github-publisher')
  assert.equal(saved.opportunities[0].publisher?.id, publisher.id)
  assert.equal(saved.opportunities[0].submissions[0].contributor?.githubUsername, 'contributor')
})
