import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mstTestnet } from './contract'

export const config = createConfig({
  chains: [mstTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [mstTestnet.id]: http(
      process.env.NEXT_PUBLIC_MST_RPC_URL ||
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
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
