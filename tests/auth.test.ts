import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
const directory=mkdtempSync(join(tmpdir(),'contribchain-test-'))
const filename=join(directory,'test.db')
process.env.DATABASE_URL='file:'+filename.replace(/\\/g,'/')
process.env.APP_URL='http://localhost:3000'
const sqlite=new DatabaseSync(filename)
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610170001_init/migration.sql',import.meta.url),'utf8'))
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610170002_session_generation/migration.sql',import.meta.url),'utf8'))
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610170003_deployment_scope/migration.sql',import.meta.url),'utf8'))
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610170004_user_custom_fields/migration.sql',import.meta.url),'utf8'))
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610290005_platform_records/migration.sql',import.meta.url),'utf8'))
sqlite.exec(readFileSync(new URL('../prisma/migrations/202610290006_unified_identity/migration.sql',import.meta.url),'utf8'))
sqlite.close()
const {db}=await import('../src/lib/server/db.ts')
const {appOrigin,authConfig,requireWallet,currentSession}=await import('../src/lib/server/auth.ts')
const {GET,POST}=await import('../src/app/api/platform/[...path]/route.ts')
after(async()=>{await db.$disconnect();rmSync(directory,{recursive:true,force:true})})
async function session() {
  const token=crypto.randomUUID()
  const githubId=crypto.randomUUID()
  const user=await db.user.create({data:{name:'test-user',githubId,githubUsername:'octocat',accounts:{create:{provider:'github',type:'oauth',providerAccountId:githubId,access_token:'test-only-token-never-exposed'}}}})
  const session=await db.session.create({data:{sessionToken:token,userId:user.id,expires:new Date(Date.now()+60000)}})
  return {token,session,user,githubId}
}
async function request(path:string,body?:unknown,token?:string,origin='http://localhost:3000') {
  const request=new Request('http://localhost:3000/api/platform/'+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',cookie:token?'contribchain.session-token='+token:''},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const result=await (body===undefined?GET:POST)(request,{params:Promise.resolve({path:path.split('/')})})
  return {status:result.status,body:await result.json()}
}
test('session response excludes GitHub tokens and database session tokens',async()=>{
  const s=await session(), response=await request('session',undefined,s.token)
  assert.equal(response.body.authenticated,true)
  assert.equal(response.body.githubUsername,'octocat')
  assert.ok(!JSON.stringify(response.body).includes('test-only-token'))
  assert.ok(!JSON.stringify(response.body).includes(s.token))
})
test('protected wallet sessions require a matching verified GitHub wallet link',async()=>{
  const s=await session(), account=privateKeyToAccount(generatePrivateKey()), wallet=account.address.toLowerCase()
  await db.session.update({where:{id:s.session.id},data:{wallet}})
  const requestWithWallet=new Request('http://localhost:3000/api/platform/projects/prepare',{method:'POST',headers:{origin:'http://localhost:3000',cookie:'contribchain.session-token='+s.token,'x-wallet-address':wallet}})
  await assert.rejects(()=>requireWallet(requestWithWallet),/verified GitHub and wallet identity/)
  await db.walletLink.create({data:{address:wallet,userId:s.user.id,githubId:s.githubId}})
  assert.equal((await requireWallet(requestWithWallet)).wallet,wallet)
})
test('auth configuration requires real server-side credentials',()=>{
  const names=['AUTH_SECRET','GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET'] as const
  const previous=names.map(name=>process.env[name])
  for(const name of names) delete process.env[name]
  assert.throws(()=>authConfig(),/AUTH_SECRET/)
  names.forEach((name,index)=>{
    if(previous[index]===undefined) delete process.env[name]
    else process.env[name]=previous[index]
  })
})
test('application origin uses the configured public URL when APP_URL is absent',()=>{
  const previousApp=process.env.APP_URL, previousPublic=process.env.NEXT_PUBLIC_APP_URL
  delete process.env.APP_URL
  process.env.NEXT_PUBLIC_APP_URL='https://contribchain.example'
  assert.equal(appOrigin(),'https://contribchain.example')
  if(previousApp===undefined) delete process.env.APP_URL
  else process.env.APP_URL=previousApp
  if(previousPublic===undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL=previousPublic
})
test('local demo mode never turns a wallet address into a GitHub-authenticated session',async()=>{
  const previousDemo=process.env.DEMO_MODE
  process.env.DEMO_MODE='true'
  const request=new Request('http://localhost:3000/api/platform/session',{headers:{'x-wallet-address':'0x0000000000000000000000000000000000000001'}})
  assert.equal(await currentSession(request),null)
  if(previousDemo===undefined) delete process.env.DEMO_MODE
  else process.env.DEMO_MODE=previousDemo
})
test('real signature links wallet and cannot be replayed',async()=>{
  const s=await session(), account=privateKeyToAccount(generatePrivateKey())
  const c=await request('wallet/challenge',{address:account.address},s.token)
  assert.equal(c.status,200)
  const signature=await account.signMessage({message:c.body.message})
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},s.token)).status,200)
  const linkedSession=(await request('session',undefined,s.token)).body
  assert.equal(linkedSession.wallet,account.address.toLowerCase())
  assert.equal(linkedSession.walletVerified,true)
  assert.equal((await db.user.findUniqueOrThrow({where:{id:s.session.userId}})).walletAddress,account.address.toLowerCase())
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},s.token)).status,400)
})
test('a wallet already linked to another GitHub profile cannot be claimed',async()=>{
  const owner=await session(), claimant=await session(), account=privateKeyToAccount(generatePrivateKey()),wallet=account.address.toLowerCase()
  await db.walletLink.create({data:{address:wallet,userId:owner.user.id,githubId:owner.githubId}})
  const challenge=await request('wallet/challenge',{address:wallet},claimant.token)
  const signature=await account.signMessage({message:challenge.body.message})
  assert.equal((await request('wallet/verify',{id:challenge.body.id,signature},claimant.token)).status,400)
  assert.equal((await db.walletLink.findUniqueOrThrow({where:{address:wallet}})).userId,owner.user.id)
})
test('GitHub verification safely claims a matching legacy wallet-only profile',async()=>{
  const account=privateKeyToAccount(generatePrivateKey()),wallet=account.address.toLowerCase()
  const legacy=await db.user.create({data:{name:'Legacy wallet user',walletAddress:wallet}})
  const s=await session()
  const challenge=await request('wallet/challenge',{address:wallet},s.token)
  const signature=await account.signMessage({message:challenge.body.message})
  assert.equal((await request('wallet/verify',{id:challenge.body.id,signature},s.token)).status,200)
  const profile=await db.user.findUniqueOrThrow({where:{id:legacy.id},include:{accounts:true}})
  assert.equal(profile.githubId,s.githubId)
  assert.equal(profile.walletAddress,wallet)
  assert.equal(profile.accounts.find(item=>item.provider==='github')?.providerAccountId,s.githubId)
  assert.equal((await db.session.findUniqueOrThrow({where:{id:s.session.id}})).userId,legacy.id)
})
test('challenge cannot cross sessions or survive expiry or wallet clear',async()=>{
  const a=await session(),b=await session(),account=privateKeyToAccount(generatePrivateKey())
  const c=await request('wallet/challenge',{address:account.address},a.token)
  const signature=await account.signMessage({message:c.body.message})
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},b.token)).status,400)
  await db.challenge.update({where:{id:c.body.id},data:{expires:new Date(0)}})
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},a.token)).status,400)
  const next=await request('wallet/challenge',{address:account.address},a.token)
  await request('wallet/clear',{},a.token)
  assert.equal((await request('wallet/verify',{id:next.body.id,signature:await account.signMessage({message:next.body.message})},a.token)).status,400)
})
test('rejects spoofed origin, unsigned identity and unauthenticated writes',async()=>{
  const s=await session(),account=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey())
  assert.equal((await request('wallet/challenge',{address:account.address},s.token,'https://evil.test')).status,400)
  assert.equal((await request('wallet/challenge',{address:account.address},s.token,'https://evil-localhost.com')).status,400)
  const c=await request('wallet/challenge',{address:account.address},s.token)
  assert.equal((await request('wallet/verify',{id:c.body.id,signature:await other.signMessage({message:c.body.message})},s.token)).status,400)
  assert.equal((await request('projects/prepare',{},s.token)).status,400)
  assert.equal((await request('projects/prepare',{})).status,400)
})
