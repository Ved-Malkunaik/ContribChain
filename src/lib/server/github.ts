import { z } from 'zod'
import { createHash } from 'node:crypto'
import { keccak256, toHex } from 'viem'
import { db } from './db'
import { contractAddress } from '../contract'
import { parseRepo } from '../security'
const repoSchema = z.object({ id: z.number().int(), full_name: z.string(), private: z.boolean(), owner: z.object({id: z.number().int(), type: z.string()}), html_url: z.string().url() })
const pullSchema = z.object({ number: z.number().int(), title: z.string(), html_url: z.string().url(), state: z.enum(['open','closed']), merged: z.boolean(), merged_at: z.string().nullish(), user: z.object({id: z.number().int(), login: z.string()}), base: z.object({repo: repoSchema}), head: z.object({sha: z.string()}) })
let rateLimitUntil = 0
export async function github(path: string, token?: string | null) {
  if (Date.now() < rateLimitUntil) throw new Error('GitHub rate limit backoff; retry later')
  const accessToken = token || process.env.GITHUB_API_TOKEN
  const response = await fetch('https://api.github.com' + path, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}) }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    rateLimitUntil = Math.max(Date.now() + 60000, Number(response.headers.get('x-ratelimit-reset') || 0) * 1000)
  }
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}. Check access or retry after backoff.`)
  return response.json()
}
export async function repository(owner: string, repo: string, token?: string | null) {
  const result = repoSchema.parse(await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token))
  if (result.private) throw new Error('Only public repositories are supported')
  return result
}
type RegisteredProject = {repoId: string, publisher: string, metadataURI: string, metadataHash: string}
export async function committedProjectSnapshot(projectId: string, project: RegisteredProject) {
  const committed = await db.snapshot.findFirst({where: {
    kind: 'project', published: true, chainAddress: contractAddress?.toLowerCase() || '',
    chainRef: projectId, owner: project.publisher.toLowerCase(), repoId: project.repoId,
    hash: project.metadataHash, uri: project.metadataURI, transactionHash: {not: null},
  }})
  return committed && keccak256(toHex(committed.canonical)) === project.metadataHash ? committed : null
}
export async function matchesRegisteredRepository(actualRepoId: string, projectId: string, project: RegisteredProject, token?: string | null) {
  if (actualRepoId === project.repoId) return true
  // Resolve historical URL hashes only through the original, confirmed chain commitment.
  const committed = await committedProjectSnapshot(projectId, project)
  if (!committed) return false
  let metadata: {repoUrl: string, githubRepoId: string}
  let parsed: {owner: string, repo: string}
  try {
    metadata = z.object({repoUrl: z.string(), githubRepoId: z.string()}).parse(JSON.parse(committed.canonical))
    parsed = parseRepo(metadata.repoUrl)
  } catch { return false }
  const historicalId = String(Math.abs(createHash('sha256').update(metadata.repoUrl).digest().readInt32BE(0)) || 100000001)
  if (metadata.githubRepoId !== project.repoId || historicalId !== project.repoId) return false
  const actual = await repository(parsed.owner, parsed.repo, token)
  return String(actual.id) === actualRepoId
}
export async function pull(repoId: string, number: number, token?: string | null) {
  if (!/^\d+$/.test(repoId) || !Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid repository or PR ID')
  return pullSchema.parse(await github(`/repositories/${repoId}/pulls/${number}`, token))
}
const syncing = new Map<string, Promise<void>>()
export async function syncPull(id: string, force = false, token?: string | null) {
  const existing = syncing.get(id)
  if (existing) return existing
  const job = (async () => {
    const s = await db.verifiedSubmission.findUniqueOrThrow({ where: {id} })
    if (s.githubId.startsWith('demo:') || s.reference.startsWith('demo:')) return
    if (!force && s.nextSyncAt.getTime() > Date.now()) return
    try {
      const pr = await pull(s.repoId, s.prNumber, token || process.env.GITHUB_API_TOKEN)
      if (String(pr.base.repo.id) !== s.repoId || String(pr.user.id) !== s.githubId || pr.base.repo.private) throw new Error('PR repository or author no longer matches the verified identity')
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null
      await db.$transaction([
        db.verifiedSubmission.update({where:{id}, data:{ title: pr.title, login: pr.user.login, prState: pr.merged ? 'merged' : pr.state, commit: pr.head.sha, syncedAt: new Date(), nextSyncAt: new Date(Date.now()+15000), syncError: null }}),
        db.submission.updateMany({where:{id}, data:{isMerged:pr.merged, mergedAt, latestCommitSha:pr.head.sha}}),
      ])
    } catch(error) {
      await db.verifiedSubmission.update({where:{id}, data:{syncError: error instanceof Error ? error.message : 'Synchronization failed', nextSyncAt: new Date(Math.max(Date.now()+60000, rateLimitUntil))}})
      throw error
    }
  })()
  syncing.set(id, job)
  try { await job } finally { syncing.delete(id) }
}
export async function refreshDuePulls() {
  const due = await db.verifiedSubmission.findMany({where: {chainAddress:contractAddress?.toLowerCase() || '',chainRef: {not: null}, nextSyncAt: {lte: new Date()},NOT:{OR:[{githubId:{startsWith:'demo:'}},{reference:{startsWith:'demo:'}}]}}, take: 10, orderBy: {nextSyncAt:'asc'}})
  await Promise.allSettled(due.map(s => syncPull(s.id)))
}
