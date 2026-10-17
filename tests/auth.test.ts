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
sqlite.close()
const {db}=await import('../src/lib/server/db.ts')
const {GET,POST}=await import('../src/app/api/platform/[...path]/route.ts')
after(async()=>{await db.$disconnect();rmSync(directory,{recursive:true,force:true})})
async function session() {
  const token=crypto.randomUUID()
  const user=await db.user.create({data:{name:'test-user',accounts:{create:{provider:'github',type:'oauth',providerAccountId:crypto.randomUUID(),access_token:'test-only-token-never-exposed'}}}})
  const session=await db.session.create({data:{sessionToken:token,userId:user.id,expires:new Date(Date.now()+60000)}})
  return {token,session}
}
async function request(path:string,body?:unknown,token?:string,origin='http://localhost:3000') {
  const request=new Request('http://localhost:3000/api/platform/'+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',cookie:token?'contribchain.session-token='+token:''},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const result=await (body===undefined?GET:POST)(request,{params:Promise.resolve({path:path.split('/')})})
  return {status:result.status,body:await result.json()}
}
test('session response excludes GitHub tokens and database session tokens',async()=>{
  const s=await session(), response=await request('session',undefined,s.token)
  assert.equal(response.body.authenticated,true)
  assert.ok(!JSON.stringify(response.body).includes('test-only-token'))
  assert.ok(!JSON.stringify(response.body).includes(s.token))
})
test('real signature links wallet and cannot be replayed',async()=>{
  const s=await session(), account=privateKeyToAccount(generatePrivateKey())
  const c=await request('wallet/challenge',{address:account.address},s.token)
  assert.equal(c.status,200)
  const signature=await account.signMessage({message:c.body.message})
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},s.token)).status,200)
  assert.equal((await request('session',undefined,s.token)).body.wallet,account.address.toLowerCase())
  assert.equal((await request('wallet/verify',{id:c.body.id,signature},s.token)).status,400)
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
  const c=await request('wallet/challenge',{address:account.address},s.token)
  assert.equal((await request('wallet/verify',{id:c.body.id,signature:await other.signMessage({message:c.body.message})},s.token)).status,400)
  assert.equal((await request('projects/prepare',{},s.token)).status,400)
  assert.equal((await request('projects/prepare',{})).status,400)
})
