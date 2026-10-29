import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('identity migration backfills project and contribution profile links without dropping legacy records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'contribchain-identity-migration-'))
  const filename = join(directory, 'test.db')
  const sqlite = new DatabaseSync(filename)
  try {
    for (const migration of [
      '202610170001_init',
      '202610170002_session_generation',
      '202610170003_deployment_scope',
      '202610170004_user_custom_fields',
      '202610290005_platform_records',
    ]) {
      sqlite.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'))
    }

    sqlite.exec(`
      INSERT INTO "User" ("id", "walletAddress", "githubId", "githubUsername") VALUES
        ('publisher-user', '0xpublisher', 'gh-publisher', 'publisher'),
        ('contributor-user', '0xcontributor', 'gh-contributor', 'contributor');
      INSERT INTO "WalletLink" ("address", "userId", "githubId") VALUES
        ('0xpublisher', 'publisher-user', 'gh-publisher'),
        ('0xcontributor', 'contributor-user', 'gh-contributor');
      INSERT INTO "Project" ("id", "publisherAddress", "name", "shortDescription", "detailedDescription", "category", "technologies", "repoId", "repoUrl", "liveDappUrl", "updatedAt")
        VALUES ('project-1', '0xpublisher', 'Project', 'Short', 'Details', 'Tools', '[]', '1', 'https://github.com/publisher/repo', 'https://example.test', CURRENT_TIMESTAMP);
      INSERT INTO "Opportunity" ("id", "projectId", "publisherAddress", "title", "taskType", "description", "acceptanceCriteria", "difficulty", "requiredSkills", "rewardEth", "rewardWei", "deadline", "updatedAt")
        VALUES ('opportunity-1', 'project-1', '0xpublisher', 'Task', 'feature', 'Description', 'Criteria', 'Beginner', '[]', '1', '1000000000000000000', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "Submission" ("id", "opportunityId", "contributorAddress", "prUrl", "prNumber", "repoOwner", "repoName", "updatedAt")
        VALUES ('submission-1', 'opportunity-1', '0xcontributor', 'https://github.com/publisher/repo/pull/1', 1, 'publisher', 'repo', CURRENT_TIMESTAMP);
    `)

    sqlite.exec(readFileSync(new URL('../prisma/migrations/202610290006_unified_identity/migration.sql', import.meta.url), 'utf8'))

    assert.equal(sqlite.prepare('SELECT "publisherUserId" FROM "Project" WHERE "id" = ?').get('project-1')?.publisherUserId, 'publisher-user')
    assert.equal(sqlite.prepare('SELECT "publisherUserId" FROM "Opportunity" WHERE "id" = ?').get('opportunity-1')?.publisherUserId, 'publisher-user')
    assert.equal(sqlite.prepare('SELECT "contributorUserId" FROM "Submission" WHERE "id" = ?').get('submission-1')?.contributorUserId, 'contributor-user')
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM "Submission"').get()?.count, 1)
  } finally {
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
