import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opportunityInput, submissionInput } from '../src/lib/server/validation.ts'

const opportunity = {
  projectId: 'clxprojectmetadataid123456789',
  title: 'Fix it', taskType: 'feature', description: 'Details', acceptanceCriteria: 'Done',
  difficulty: 'beginner', requiredSkills: 'TypeScript', rewardEth: '0.01', deadlineDays: '1',
}

test('off-chain project IDs are accepted when preparing a funded opportunity', () => {
  assert.equal(opportunityInput.parse(opportunity).projectId, opportunity.projectId)
})

test('off-chain opportunity IDs are accepted for PR submissions', () => {
  const input = { opportunityId: 'clxopportunitymetadataid123456', prUrl: 'https://github.com/owner/repo/pull/1' }
  assert.equal(submissionInput.parse(input).opportunityId, input.opportunityId)
  assert.equal(submissionInput.parse({ ...input, prUrl: '  https://github.com/owner/repo/pull/1/files?diff=split  ' }).prUrl, 'https://github.com/owner/repo/pull/1/files?diff=split')
})
