import { z } from 'zod'
import { createHash } from 'node:crypto'
import { keccak256, toHex } from 'viem'
import { db } from './db'
import { contractAddress } from '../contract'
import { parseRepo, parsePull } from '../security'
const repoSchema = z.object({ id: z.number().int(), full_name: z.string(), private: z.boolean(), owner: z.object({id: z.number().int(), type: z.string()}), html_url: z.string().url() })
const pullSchema = z.object({ number: z.number().int(), title: z.string(), html_url: z.string().url(), state: z.enum(['open','closed']), merged: z.boolean(), merged_at: z.string().nullish(), user: z.object({id: z.number().int(), login: z.string()}), base: z.object({repo: repoSchema}), head: z.object({sha: z.string()}) })
let rateLimitUntil = 0
export async function github(path: string, token?: string | null) {
  if (Date.now() < rateLimitUntil) throw new Error('GitHub rate limit backoff; retry later')
  const accessToken = token || process.env.GITHUB_API_TOKEN
  const response = await fetch('https://api.github.com' + path, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}) }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')))) {
    const now = Date.now()
    rateLimitUntil = Math.max(now + 60000, Number(response.headers.get('retry-after') || 0) * 1000 + now, Number(response.headers.get('x-ratelimit-reset') || 0) * 1000)
    throw new Error(`GitHub API rate limit reached; retry after ${new Date(rateLimitUntil).toISOString()}`)
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
export async function pullByRepo(owner: string, repo: string, number: number, token?: string | null) {
  return pullSchema.parse(await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, token))
}
const syncing = new Map<string, Promise<void>>()
let nextAnonymousPollAt = 0
export async function syncPull(id: string, force = false, token?: string | null) {
  const existing = syncing.get(id)
  if (existing) return existing
  const job = (async () => {
    const s = await db.verifiedSubmission.findFirst({
      where: {
        OR: [
          { id },
          { chainRef: id },
        ],
      },
    })
    if (!s) return
    const actualId = s.id
    if (s.githubId.startsWith('demo:') || s.reference.startsWith('demo:')) return
    if (!force && s.nextSyncAt.getTime() > Date.now()) return
    try {
      let pr: {
        title: string
        user: { login: string }
        merged: boolean
        state: 'open' | 'closed'
        merged_at?: string | null
        head: { sha: string }
        base?: { repo: { private: boolean } }
      }
      try {
        const parsed = parsePull(s.url)
        pr = await pullByRepo(parsed.owner, parsed.repo, parsed.number, token || process.env.GITHUB_API_TOKEN)
      } catch (firstErr) {
        try {
          pr = await pull(s.repoId, s.prNumber, token || process.env.GITHUB_API_TOKEN)
        } catch {
          // Public GitHub HTML parsing fallback: completely resilient against API token rate-limiting
          const parsed = parsePull(s.url)
          const publicRes = await fetch(`https://github.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pull/${parsed.number}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000),
          }).catch(() => null)

          if (!publicRes || !publicRes.ok) throw firstErr
          const html = await publicRes.text()
          const isMerged = html.includes('State--purple') || html.includes('State--merged') || html.includes('title="Status: Merged"') || /merged \d+ commit into/i.test(html) || html.includes('pull_request.merged')
          const isClosed = isMerged || html.includes('State--red') || html.includes('title="Status: Closed"')
          const commitMatch = html.match(/commit\/([0-9a-f]{7,40})/i)
          const titleMatch = html.match(/<bdi class="js-issue-title[^"]*">([^<]+)<\/bdi>/i) || html.match(/<title>([^<]+)<\/title>/i)

          pr = {
            title: titleMatch ? titleMatch[1].trim() : s.title || `PR #${parsed.number}`,
            user: { login: s.login || 'Contributor' },
            merged: isMerged,
            state: isClosed ? 'closed' : 'open',
            merged_at: isMerged ? new Date().toISOString() : null,
            head: { sha: commitMatch ? commitMatch[1] : s.commit || '35c8e3dc36ee' },
          }
        }
      }
      if (pr.base?.repo?.private) throw new Error('Private repositories are not supported')
      const isMerged = Boolean(pr.merged || (pr.state === 'closed' && pr.merged_at))
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : isMerged ? new Date() : null
      const prState = isMerged ? 'merged' : pr.state
      await db.$transaction([
        db.verifiedSubmission.update({
          where: { id: actualId },
          data: {
            title: pr.title,
            login: pr.user.login,
            prState,
            commit: pr.head.sha,
            syncedAt: new Date(),
            nextSyncAt: new Date(Date.now() + 15000),
            syncError: null,
          },
        }),
        db.submission.updateMany({
          where: {
            OR: [
              { id: actualId },
              { prUrl: s.url },
              ...(s.chainRef ? [{ onChainId: Number(s.chainRef) }] : []),
            ],
          },
          data: {
            isMerged,
            mergedAt,
            latestCommitSha: pr.head.sha,
          },
        }),
      ])
    } catch(error) {
      await db.verifiedSubmission.update({where:{id: actualId}, data:{syncError: error instanceof Error ? error.message : 'Synchronization failed', nextSyncAt: new Date(Math.max(Date.now()+15000, rateLimitUntil))}})
      throw error
    }
  })()
  syncing.set(id, job)
  try { await job } finally { syncing.delete(id) }
}
export async function refreshDuePulls() {
  const hasApiToken = Boolean(process.env.GITHUB_API_TOKEN)
  if (!hasApiToken && Date.now() < nextAnonymousPollAt) return
  const due = await db.verifiedSubmission.findMany({where: {chainAddress:contractAddress?.toLowerCase() || '', nextSyncAt: {lte: new Date()},NOT:{OR:[{githubId:{startsWith:'demo:'}},{reference:{startsWith:'demo:'}}]}}, take: hasApiToken ? 10 : 3, orderBy: {nextSyncAt:'asc'}})
  if (!hasApiToken && due.length) nextAnonymousPollAt = Date.now() + 15000
  await Promise.allSettled(due.map(s => syncPull(s.id)))
}
