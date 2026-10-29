export function retiredRouteResponse() {
  return Response.json(
    { error: 'This legacy endpoint is retired. Use the authenticated ContribChain platform workflow.' },
    { status: 410, headers: { 'cache-control': 'no-store' } },
  )
}
