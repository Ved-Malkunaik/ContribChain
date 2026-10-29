import { isAddress, type Address, defineChain } from 'viem'
export { bountyAbi } from './generated/bounty-abi'
export { CONTRIB_CHAIN_ESCROW_ABI } from '@/contracts/ContribChainEscrowABI'

export const mstTestnet = defineChain({
  id: 91562037,
  name: 'MST Testnet',
  nativeCurrency: { name: 'tMSTC', symbol: 'tMSTC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MST_RPC_URL || process.env.MST_RPC_URL || 'https://testnetrpc.mstblockchain.com'] },
  },
  blockExplorers: {
    default: { name: 'MSTScan', url: 'https://testnet.mstscan.com' },
  },
  testnet: true,
})

export const mstMainnet = defineChain({
  id: 4646,
  name: 'MST Mainnet',
  nativeCurrency: { name: 'MSTC', symbol: 'MSTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mariorpc.mstblockchain.com/'] },
  },
  blockExplorers: {
    default: { name: 'MSTScan', url: 'https://mstscan.com' },
  },
})

export const chainId = 91562037 as const
export const currencySymbol = 'tMSTC' as const
export const explorerUrl = (process.env.NEXT_PUBLIC_MST_EXPLORER_URL || 'https://testnet.mstscan.com').replace(/\/$/, '')

const configured =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_BOUNTY_ADDRESS ||
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  '0x1f3E1E9Bfe08153c5b3bA7311BB2d74415419a01'

export const contractAddress: Address | undefined =
  configured && isAddress(configured) && !/^0x0{40}$/i.test(configured)
    ? (configured as Address)
    : ('0x1f3E1E9Bfe08153c5b3bA7311BB2d74415419a01' as Address)

export const deploymentBlock =
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ||
  process.env.NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK ||
  '0'
