import { z } from 'zod'
import { db } from '@/lib/server/db'
import { syncPull } from '@/lib/server/github'
import { verifyWebhook } from '@/lib/security'
import { contractAddress } from '@/lib/contract'

const pullEvent = z.object({
  repository: z.object({ id: z.number().int().positive().safe() }),
  pull_request: z.object({ number: z.number().int().positive().safe() }),
})

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'GitHub webhook secret is not configured' }, { status: 503 })
  const deliveryId = request.headers.get('x-github-delivery')
  if (!deliveryId) return Response.json({ error: 'Missing X-GitHub-Delivery header' }, { status: 400 })
  const raw = await request.text()
  if (!verifyWebhook(raw, request.headers.get('x-hub-signature-256'), secret)) {
    return Response.json({ error: 'Invalid webhook HMAC signature' }, { status: 401 })
  }

  const event = request.headers.get('x-github-event')
  let details: z.infer<typeof pullEvent> | undefined
  if (event === 'pull_request') {
    try { details = pullEvent.parse(JSON.parse(raw)) }
    catch { return Response.json({ error: 'Invalid pull request event' }, { status: 400 }) }
  }

  try {
    try {
      await db.webhookDelivery.create({ data: { id: deliveryId, status: 'processing' } })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
      const previous = await db.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } })
      if (previous.status === 'processed' || previous.status === 'ignored') {
        return Response.json({ status: 'already_processed', deliveryId })
      }
      // Retry failed or interrupted deliveries, but never process one simultaneously twice.
      const claimed = await db.webhookDelivery.updateMany({
        where: { id: deliveryId, OR: [{ status: 'failed' }, { status: 'processing', receivedAt: { lt: new Date(Date.now() - 120000) } }] },
        data: { status: 'processing', receivedAt: new Date() },
      })
      if (claimed.count !== 1) return Response.json({ error: 'Delivery is being processed; retry later' }, { status: 503 })
    }

    try {
      let matchedSubmissionsCount = 0
      if (details) {
        const submissions = await db.verifiedSubmission.findMany({ where: {
          chainAddress: contractAddress?.toLowerCase() || '', chainRef: { not: null },
          repoId: String(details.repository.id), prNumber: details.pull_request.number,
        } })
        // Events trigger a refresh. Event merge/author fields never replace authoritative REST truth.
        await Promise.all(submissions.map(submission => syncPull(submission.id, true)))
        matchedSubmissionsCount = submissions.length
      }
      await db.webhookDelivery.update({ where: { id: deliveryId }, data: { status: details ? 'processed' : 'ignored' } })
      return Response.json({ status: details ? 'processed' : 'ignored_event', deliveryId, matchedSubmissionsCount })
    } catch (error) {
      await db.webhookDelivery.update({ where: { id: deliveryId }, data: { status: 'failed' } })
      throw error
    }
  } catch (error) {
    console.error('GitHub webhook processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'Failed to refresh PR from GitHub; retry delivery' }, { status: 503 })
  }
}
