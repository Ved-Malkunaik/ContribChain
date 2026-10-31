import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mstMainnet, mstTestnet, isMainnet } from './contract'

export const config = createConfig({
  chains: isMainnet ? [mstMainnet, mstTestnet] : [mstTestnet, mstMainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [mstMainnet.id]: http(
      process.env.NEXT_PUBLIC_MSTC_RPC_URL ||
      process.env.MSTC_RPC_URL ||
      process.env.NEXT_PUBLIC_MST_RPC_URL ||
      process.env.MST_RPC_URL ||
      'https://mariorpc.mstblockchain.com/'
    ),
    [mstTestnet.id]: http(
      process.env.NEXT_PUBLIC_TESTNET_RPC_URL ||
      'https://testnetrpc.mstblockchain.com'
    ),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
