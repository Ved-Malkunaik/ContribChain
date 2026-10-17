import { authHandler } from '@/lib/server/auth'
async function handler(request: Request) {
  try { return await authHandler(request) }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Authentication unavailable'}, {status: 503}) }
}
export { handler as GET, handler as POST }
