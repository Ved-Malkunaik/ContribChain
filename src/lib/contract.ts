import { isAddress, type Address } from 'viem'
export { bountyAbi } from './generated/bounty-abi'
export const chainId = 11155111 as const
const configured = process.env.NEXT_PUBLIC_BOUNTY_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
export const contractAddress: Address | undefined = configured && isAddress(configured) && !/^0x0{40}$/i.test(configured) ? (configured as Address) : undefined
export const deploymentBlock = process.env.NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK || process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK
