import { isAddress, type Address, defineChain } from 'viem'
export { bountyAbi } from './generated/bounty-abi'
export { CONTRIB_CHAIN_ESCROW_ABI } from '@/contracts/ContribChainEscrowABI'

export const mstTestnet = defineChain({
  id: 91562037,
  name: 'MST Testnet',
  nativeCurrency: { name: 'tMSTC', symbol: 'tMSTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_TESTNET_RPC_URL ||
        process.env.TESTNET_RPC_URL ||
        'https://testnetrpc.mstblockchain.com',
      ],
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
      http: [
        process.env.NEXT_PUBLIC_MSTC_RPC_URL ||
        process.env.MSTC_RPC_URL ||
        process.env.NEXT_PUBLIC_MST_RPC_URL ||
        process.env.MST_RPC_URL ||
        'https://mariorpc.mstblockchain.com/',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'MSTScan', url: 'https://mstscan.com' },
  },
})

// Active chain resolution: defaults to MST Mainnet
export const isMainnet =
  process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ||
  process.env.NEXT_PUBLIC_MST_CHAIN_ID === '4646' ||
  process.env.NEXT_PUBLIC_MSTC_CHAIN_ID === '4646' ||
  Boolean(process.env.NEXT_PUBLIC_MSTC_RPC_URL) ||
  Boolean(process.env.MSTC_RPC_URL) ||
  process.env.NEXT_PUBLIC_NETWORK !== 'testnet'

export const activeChain = isMainnet ? mstMainnet : mstTestnet
export const chainId = activeChain.id
export const networkName = activeChain.name
export const currencySymbol = (process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || activeChain.nativeCurrency.symbol) as string
export const explorerUrl = (
  process.env.NEXT_PUBLIC_MST_EXPLORER_URL ||
  (isMainnet ? 'https://mstscan.com' : 'https://testnet.mstscan.com')
).replace(/\/$/, '')

const MAINNET_ESCROW = '0x71B4e7686b45A60a7c294F865C424560dc0a2BE0'
const TESTNET_ESCROW = '0x1f3E1E9Bfe08153c5b3bA7311BB2d74415419a01'

const defaultEscrow = isMainnet ? MAINNET_ESCROW : TESTNET_ESCROW

const configured =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_BOUNTY_ADDRESS ||
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  defaultEscrow

export const contractAddress: Address =
  configured && isAddress(configured) && !/^0x0{40}$/i.test(configured)
    ? (configured as Address)
    : (defaultEscrow as Address)

export const deploymentBlock =
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ||
  process.env.NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK ||
  '0'
