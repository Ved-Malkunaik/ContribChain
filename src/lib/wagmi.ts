import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mstMainnet, mstTestnet, isMainnet, getMainnetRpcUrl, getTestnetRpcUrl } from './contract'

export const config = createConfig({
  chains: isMainnet ? [mstMainnet, mstTestnet] : [mstTestnet, mstMainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [mstMainnet.id]: http(getMainnetRpcUrl()),
    [mstTestnet.id]: http(getTestnetRpcUrl()),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
