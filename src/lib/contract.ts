import { isAddress, type Address, defineChain } from 'viem'
export { bountyAbi } from './generated/bounty-abi'
export { CONTRIB_CHAIN_ESCROW_ABI } from '@/contracts/ContribChainEscrowABI'

export const MAINNET_ESCROW: Address = '0x71B4e7686b45A60a7c294F865C424560dc0a2BE0'
export const TESTNET_ESCROW: Address = '0x1f3E1E9Bfe08153c5b3bA7311BB2d74415419a01'

export function getMainnetRpcUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_MSTC_RPC_URL,
    process.env.MSTC_RPC_URL,
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
    process.env.MAINNET_RPC_URL,
    process.env.NEXT_PUBLIC_MST_RPC_URL,
    process.env.MST_RPC_URL,
  ]
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed && !trimmed.toLowerCase().includes('testnet') && !trimmed.includes('91562037')) {
      return trimmed
    }
  }
  return 'https://mariorpc.mstblockchain.com/'
}

export function getTestnetRpcUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_TESTNET_RPC_URL,
    process.env.TESTNET_RPC_URL,
    process.env.NEXT_PUBLIC_MST_RPC_URL,
    process.env.MST_RPC_URL,
  ]
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed && (trimmed.toLowerCase().includes('testnet') || trimmed.includes('91562037'))) {
      return trimmed
    }
  }
  return 'https://testnetrpc.mstblockchain.com'
}

// Active chain resolution: defaults to MST Mainnet (Chain ID: 4646)
export const isMainnet =
  process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ||
  process.env.NEXT_PUBLIC_MSTC_CHAIN_ID === '4646' ||
  process.env.NEXT_PUBLIC_MST_CHAIN_ID === '4646' ||
  Boolean(process.env.NEXT_PUBLIC_MSTC_RPC_URL) ||
  Boolean(process.env.MSTC_RPC_URL) ||
  process.env.NEXT_PUBLIC_NETWORK !== 'testnet'

export function getActiveRpcUrl(): string {
  return isMainnet ? getMainnetRpcUrl() : getTestnetRpcUrl()
}

export const mstTestnet = defineChain({
  id: 91562037,
  name: 'MST Testnet',
  nativeCurrency: { name: 'tMSTC', symbol: 'tMSTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [getTestnetRpcUrl()],
    },
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
    default: {
      http: [getMainnetRpcUrl()],
    },
  },
  blockExplorers: {
    default: { name: 'MSTScan', url: 'https://mstscan.com' },
  },
})

export const activeChain = isMainnet ? mstMainnet : mstTestnet
export const chainId = activeChain.id
export const networkName = activeChain.name
export const currencySymbol = (process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || activeChain.nativeCurrency.symbol) as string
export const explorerUrl = (
  process.env.NEXT_PUBLIC_MST_EXPLORER_URL ||
  (isMainnet ? 'https://mstscan.com' : 'https://testnet.mstscan.com')
).replace(/\/$/, '')

export function resolveContractAddress(mainnet: boolean): Address {
  const envAddress = (
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_BOUNTY_ADDRESS ||
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS
  )?.trim()

  if (mainnet) {
    if (!envAddress || envAddress.toLowerCase() === TESTNET_ESCROW.toLowerCase()) {
      return MAINNET_ESCROW
    }
    return isAddress(envAddress) && !/^0x0{40}$/i.test(envAddress) ? (envAddress as Address) : MAINNET_ESCROW
  } else {
    if (!envAddress || envAddress.toLowerCase() === MAINNET_ESCROW.toLowerCase()) {
      return TESTNET_ESCROW
    }
    return isAddress(envAddress) && !/^0x0{40}$/i.test(envAddress) ? (envAddress as Address) : TESTNET_ESCROW
  }
}

export const contractAddress: Address = resolveContractAddress(isMainnet)

export const deploymentBlock =
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ||
  process.env.NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK ||
  '0'
