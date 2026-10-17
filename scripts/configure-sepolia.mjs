import fs from 'node:fs/promises'
import { createPublicClient, http, isHash } from 'viem'
import { sepolia } from 'viem/chains'

const hash = process.argv[2]
if (!hash || !isHash(hash)) throw new Error('Provide the deployment transaction hash, starting with 0x and containing 64 hex digits.')
const root = new URL('../', import.meta.url)
const artifact = JSON.parse(await fs.readFile(new URL('public/sepolia-deployment.json', root), 'utf8'))
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com', { timeout: 20000, retryCount: 1 }) })
if (await client.getChainId() !== sepolia.id) throw new Error('RPC is not Ethereum Sepolia; configuration was not changed.')
const [receipt, transaction] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash })])
if (receipt.status !== 'success' || !receipt.contractAddress || transaction.to || transaction.value !== 0n) throw new Error('Expected a successful zero-value contract creation on Sepolia; configuration was not changed.')
if (transaction.input.toLowerCase() !== artifact.bytecode.toLowerCase()) throw new Error('Deployment input differs from the compiled ContribChain contract; configuration was not changed.')
const code = await client.getCode({ address: receipt.contractAddress })
if (code?.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new Error('Deployed runtime bytecode does not match ContribChain; configuration was not changed.')
const envPath = new URL('.env', root)
let env = await fs.readFile(envPath, 'utf8')
for (const [key, value] of Object.entries({ NEXT_PUBLIC_BOUNTY_ADDRESS: receipt.contractAddress, NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK: receipt.blockNumber.toString(), NEXT_PUBLIC_CONTRACT_ADDRESS: receipt.contractAddress, NEXT_PUBLIC_DEPLOYMENT_BLOCK: receipt.blockNumber.toString() })) {
  const pattern = new RegExp('^' + key + '=.*$', 'm')
  env = pattern.test(env) ? env.replace(pattern, key + '="' + value + '"') : env.trimEnd() + '\n' + key + '="' + value + '"\n'
}
await fs.writeFile(envPath, env)
const deployment = { chainId: sepolia.id, contractAddress: receipt.contractAddress, deploymentBlock: receipt.blockNumber.toString(), transactionHash: hash, deployer: transaction.from, bytecodeHash: artifact.bytecodeHash, verifiedAt: new Date().toISOString() }
await fs.mkdir(new URL('deployments/', root), { recursive: true })
await fs.writeFile(new URL('deployments/sepolia.json', root), JSON.stringify(deployment, null, 2) + '\n')
console.log(JSON.stringify(deployment, null, 2))
console.log('Verified deployment and configured .env. Restart Next.js to activate it.')
