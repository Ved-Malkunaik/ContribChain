'use client'

import { useState, useEffect } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
  useSwitchChain,
} from 'wagmi'
import { formatEther } from 'viem'
import {
  Wallet,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  Layers,
  ArrowRightLeft,
  X,
  Sparkles,
} from 'lucide-react'
import { mstTestnet, explorerUrl, currencySymbol } from '@/lib/contract'
import { useIdentity } from '@/lib/use-platform'

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const identity = useIdentity()
  const { connectors, connect, isPending: isConnectPending, error: connectError, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchPending } = useSwitchChain()

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
    chainId: mstTestnet.id,
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isWrongNetwork = isConnected && chainId !== mstTestnet.id

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatBalance = () => {
    if (isBalanceLoading) return 'Loading...'
    if (!balanceData) return `0.0000 ${currencySymbol}`
    return `${formatEther(balanceData.value).replace(/^(\d+\.\d{4})\d*$/, '$1')} ${currencySymbol}`
  }

  // Detect injected web3 wallet (BridgeKey, MetaMask, or any EIP-1193 provider)
  const hasInjectedWallet = typeof window !== 'undefined' && Boolean(
    (window as unknown as { ethereum?: unknown }).ethereum || connectors.length > 0
  )

  // Not connected state
  if (!mounted || !isConnected) {
    return (
      <div className="relative">
        <button
          id="connect-wallet-nav-btn"
          onClick={() => {
            if (!mounted) return
            reset()
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 h-11 sm:h-12 px-5 bg-[#28282a] hover:bg-[#323234] text-[#c8c8c8] hover:text-white font-medium text-xs sm:text-[13.5px] rounded-full transition-all shadow-[0_4px_14px_rgba(0,0,0,0.16)] active:scale-95 cursor-pointer"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Connect Wallet</span>
        </button>

        {/* Connect Modal */}
        {mounted && isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#111113] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left">
              <button
                id="close-connect-wallet-modal-btn"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
                  <p className="text-xs text-neutral-400">MST Blockchain · BridgeKey & Injected</p>
                </div>
              </div>

              {/* Recommended BridgeKey Callout */}
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>BridgeKey Wallet (Recommended)</span>
                </div>
                <p className="text-neutral-300 leading-relaxed text-[11.5px]">
                  BridgeKey is the official non-custodial wallet for MST Blockchain. Connect to manage testnet bounties and sign transactions seamlessly.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href="https://chromewebstore.google.com/detail/bridgekey/bfjojdcfenehemjgjlepdjomkpginlkg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-medium underline"
                  >
                    Install Extension <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-neutral-500">·</span>
                  <a
                    href="https://faucet.mstblockchain.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-neutral-300 hover:text-white font-medium underline"
                  >
                    Claim tMSTC Faucet <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {!hasInjectedWallet && (
                <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <p className="font-semibold mb-1">No Web3 Wallet Detected</p>
                    <p className="text-neutral-300 mb-2">
                      Please install the BridgeKey extension or MetaMask to interact with ContribChain escrow on MST Testnet.
                    </p>
                    <a
                      href="https://bridgekey.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-neutral-300 hover:text-white font-medium underline"
                    >
                      Visit BridgeKey.io <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {connectError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p className="font-semibold mb-0.5">Connection Failed</p>
                    <p className="text-neutral-300">{connectError.message || 'Connection was rejected or timed out.'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 mb-6">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => {
                      connect({ connector, chainId: mstTestnet.id })
                    }}
                    disabled={isConnectPending || isConnecting}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-white/10 bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/25 transition-all text-left text-sm font-medium text-white group disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
                        {connector.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium">{connector.name}</div>
                        <div className="text-xs text-neutral-400">
                          {connector.name.toLowerCase().includes('bridgekey')
                            ? 'Official MST Blockchain wallet'
                            : 'Injected EIP-1193 wallet (BridgeKey / MetaMask)'}
                        </div>
                      </div>
                    </div>
                    {isConnectPending ? (
                      <span className="text-xs text-indigo-300 animate-pulse">Connecting...</span>
                    ) : (
                      <span className="text-xs text-neutral-400 group-hover:text-neutral-300">Connect &rarr;</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10 text-[11px] text-neutral-400 flex items-center justify-between">
                <span>Network: MST Testnet ({mstTestnet.id})</span>
                <span className="text-neutral-500">Non-custodial</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Connected state
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Network Badge */}
        {isWrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: mstTestnet.id })}
            disabled={isSwitchPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full transition-colors cursor-pointer"
            title="Click to switch to MST Testnet"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{isSwitchPending ? 'Switching...' : 'Switch to MST Testnet'}</span>
            <ArrowRightLeft className="w-3 h-3 text-amber-400 ml-0.5" />
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>MST Testnet</span>
          </div>
        )}

        {/* Address and dropdown trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[#1c1c1f] border border-white/10 hover:border-white/20 text-white rounded-2xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <div className="flex flex-col text-left leading-tight">
            <span className="font-mono text-white text-xs">{address ? formatAddress(address) : ''}</span>
            {identity.session?.githubUsername && !identity.session.githubId?.startsWith('wallet:') ? (
              <span className="text-[11px] text-neutral-400 font-sans">
                @{identity.session.githubUsername}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400/80 font-sans">BridgeKey Active</span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
        </button>
      </div>

      {/* Account Dropdown */}
      {isDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-72 bg-[#111113] border border-white/10 rounded-3xl p-4 shadow-2xl animate-in fade-in duration-150 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-neutral-300 font-mono text-xs">
                  {address ? address.slice(2, 4).toUpperCase() : '0x'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">BridgeKey Wallet</div>
                  <div className="text-[11px] font-mono text-neutral-300">{address ? formatAddress(address) : ''}</div>
                  {identity.session?.githubUsername && !identity.session.githubId?.startsWith('wallet:') ? (
                    <div className="text-[11px] text-neutral-400 flex items-center gap-0.5 mt-0.5 font-sans">
                      <span className="text-indigo-400">@</span>
                      <span>{identity.session.githubUsername}</span>
                    </div>
                  ) : (
                    <div className="text-[10.5px] text-emerald-400 mt-0.5">Wallet ready</div>
                  )}
                </div>
              </div>
              <button
                onClick={copyAddress}
                className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                title="Copy full address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!identity.session?.authenticated || identity.session.githubId?.startsWith('wallet:') ? (
              <div className="py-3 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">BridgeKey Wallet:</span>
                  <span className="text-emerald-400 font-medium">Ready for actions ✓</span>
                </div>
                <form action="/api/auth/signin" method="get">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <span>Link GitHub (Optional) &rarr;</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="py-3 border-b border-white/10 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Identity Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Linked GitHub:</span>
                  <span className="text-white font-mono">@{identity.session?.githubUsername}</span>
                </div>
              </div>
            )}
            {identity.error && <p role="alert" className="py-2 text-[11px] text-rose-300">{identity.error}</p>}

            {/* Balance info */}
            <div className="py-3 border-b border-white/10 space-y-1">
              <div className="text-[11px] text-neutral-400">MST Testnet Balance</div>
              <div className="text-base font-semibold text-white font-mono">{formatBalance()}</div>
            </div>

            {/* Links and Actions */}
            <div className="pt-2 space-y-1 text-xs">
              <a
                href={`${explorerUrl}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  View on MSTScan
                </span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </a>

              <a
                href="https://faucet.mstblockchain.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-xl text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Claim Testnet Faucet ($tMSTC)
                </span>
                <ExternalLink className="w-3 h-3 text-indigo-400" />
              </a>

              {isWrongNetwork && (
                <button
                  onClick={() => {
                    switchChain({ chainId: mstTestnet.id })
                    setIsDropdownOpen(false)
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    Switch to MST Testnet
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  disconnect()
                  setIsDropdownOpen(false)
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
