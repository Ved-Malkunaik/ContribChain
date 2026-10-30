'use client'

import { formatEther, parseEther } from 'viem'
import Link from 'next/link'
import { useFeed } from '@/lib/use-platform'
import { FeedStatus } from '@/components/PlatformStatus'
import { currencySymbol } from '@/lib/contract'

export default function HomePage() {
  const { data } = useFeed()
  const stats = {
    time: data.projects.length,
    uptime: data.opportunities.filter(o => o.state === 'Open').length,
    runtime: data.submissions.filter(s => s.status === 'Paid').length,
    context: formatEther(data.opportunities.reduce((sum, o) => sum + parseEther(o.remainingEscrowEth || '0'), 0n)),
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-x-hidden bg-[#000000]">
      {/* Exact Moving Video Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <video
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          autoPlay
          muted
          loop
          playsInline
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
        {/* Soft radial and ambient overlays for crisp text contrast */}
        <div className="absolute inset-0 bg-black/45 pointer-events-none" />
        <div className="absolute inset-0 bg-radial from-transparent via-black/55 to-[#000000] pointer-events-none" />
      </div>

      {/* Main Hero Content Area */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto w-full">
        {/* 1. Ecosystem Pill / Network Badge */}
        <div className="flex items-center justify-center mb-8 sm:mb-10 animate-in fade-in slide-in-from-top-2 duration-700">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#28282a] border border-white/40 p-[5px] grid place-items-center relative z-[1] hover:-translate-y-0.5 transition-transform">
            <div className="w-full h-full rounded-full bg-white grid place-items-center text-[#111] text-xs">
              <i className="fa-brands fa-apple" />
            </div>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#28282a] border border-white/40 p-[5px] grid place-items-center relative -ml-4 z-[2] hover:-translate-y-1 transition-transform">
            <div className="w-full h-full rounded-full bg-white grid place-items-center text-[#111] text-xs">
              <i className="fa-brands fa-amazon" />
            </div>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#28282a] border border-white/40 p-[5px] grid place-items-center relative -ml-4 z-[4] hover:-translate-y-0.5 transition-transform">
            <div className="w-full h-full rounded-full bg-white grid place-items-center text-[#111] text-xs">
              <i className="fa-brands fa-google" />
            </div>
          </div>
          <div className="h-9 sm:h-10 bg-[#28282a] border border-white/40 rounded-full inline-flex items-center -ml-4 pl-6 pr-4 sm:pr-5 text-[#c4c2c3] font-medium text-xs sm:text-[13px] whitespace-nowrap relative z-[3]">
            <span>MST Blockchain · MST Testnet</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display font-normal text-white text-[32px] sm:text-[54px] md:text-[76px] lg:text-[84px] tracking-[-0.04em] leading-[1.08] sm:leading-[1.12] uppercase select-none mb-5 max-w-4xl">
          <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100">
            Contribute Code
          </span>
          <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300">
            Earn Rewards
          </span>
        </h1>

        {/* Subhead */}
        <p className="max-w-md sm:max-w-lg mx-auto text-[#d0d0d0]/80 text-[14px] sm:text-[16px] leading-relaxed mb-8 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-500 font-normal">
          CODE . CONTRIBUTE . EARN.
        </p>

        {/* CTA Buttons */}
        <div className="animate-in fade-in zoom-in-95 duration-700 delay-700 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/explore"
            className="inline-block bg-white text-black font-semibold text-xs sm:text-sm px-7 py-3.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_22px_rgba(255,255,255,0.32),0_0_44px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_30px_rgba(255,255,255,0.45),0_0_60px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 hover:scale-[1.02] transition-all"
          >
            Get Started
          </Link>
          <Link
            href="/publisher/projects/new"
            className="inline-block bg-[#28282a] text-[#c8c8c8] hover:text-white font-medium text-xs sm:text-sm px-6 py-3.5 rounded-full border border-white/20 hover:border-white/40 transition-all"
          >
            Publish Bounty
          </Link>
          <a
            href="#prerequisites"
            className="inline-flex items-center gap-1.5 bg-white/5 text-white/80 hover:text-white text-xs sm:text-sm px-5 py-3.5 rounded-full border border-white/10 hover:border-white/25 transition-all"
          >
            <span>Prerequisites</span>
            <span className="text-[10px]">↓</span>
          </a>
        </div>

        <div className="w-full max-w-2xl mt-10">
          <FeedStatus />
        </div>

        {/* 3. Stats Footer */}
        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pt-16 sm:pt-20 text-center">
          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">&lt;</div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">{stats.time}</div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">Registered Projects</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">%</div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">{stats.uptime}</div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">Open Opportunities</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">*</div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">{stats.runtime}</div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">Confirmed Payments</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">#</div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">
              {stats.context} {currencySymbol}
            </div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">Locked Escrow</div>
          </div>
        </div>
      </section>

      {/* 4. Prerequisites Section */}
      <section id="prerequisites" className="relative z-10 w-full py-20 bg-black/80 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70 text-xs font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Getting Started</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              What you&apos;ll need to use the dApp
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8e8e98]">
              Set up your environment in two quick steps to participate as a contributor or publisher.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Prerequisite 1: BridgeKey Wallet */}
            <div className="cc-card relative group p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-[#141417] to-[#0e0e10] border border-white/15 hover:border-white/30 transition-all duration-300">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-lg">
                  <i className="fa-solid fa-wallet" />
                </div>
                <span className="cc-badge" data-tone="success">
                  <span /> Required Extension
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                BridgeKey Wallet Chrome Extension
              </h3>
              <p className="text-xs sm:text-sm text-[#99999f] leading-relaxed mb-6">
                Install the official BridgeKey browser extension to authenticate with cryptographic signatures, link your wallet to ContribChain, and send escrow release transactions securely on MST Testnet.
              </p>
              <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-[#71717a]">Chrome, Brave &amp; Edge</span>
                <a
                  href="https://bridgekey.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 rounded-full transition-colors"
                >
                  <span>Install BridgeKey</span>
                  <span className="text-[11px]">↗</span>
                </a>
              </div>
            </div>

            {/* Prerequisite 2: Test Faucet */}
            <div className="cc-card relative group p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-[#141417] to-[#0e0e10] border border-white/15 hover:border-white/30 transition-all duration-300">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-lg">
                  <i className="fa-solid fa-faucet-drip" />
                </div>
                <span className="cc-badge" data-tone="warning">
                  <span /> Free Test Tokens
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Test Faucet in that Wallet
              </h3>
              <p className="text-xs sm:text-sm text-[#99999f] leading-relaxed mb-6">
                Fund your wallet address with free testnet MSTC (tMSTC) tokens via the official MSTScan faucet. Use testnet tokens to fund bounty escrows, interact with smart contracts, and claim development payouts.
              </p>
              <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-[#71717a]">MST Testnet · Chain ID 91562037</span>
                <a
                  href="https://testnet.mstscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 rounded-full transition-colors"
                >
                  <span>Claim tMSTC Faucet</span>
                  <span className="text-[11px]">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Key Features Section */}
      <section id="features" className="relative z-10 w-full py-20 bg-[#070708]/90 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70 text-xs font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Core Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Key Features
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8e8e98]">
              Automating open-source funding with non-custodial smart contracts and real-time GitHub status synchronization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Smart Contract-Based Bounty Escrow */}
            <div className="cc-card relative group p-6 rounded-2xl bg-gradient-to-b from-[#121214] to-[#0c0c0e] border border-white/15 hover:border-white/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white text-xs mb-4">
                01
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                Smart Contract-Based Bounty Escrow
              </h3>
              <p className="text-xs sm:text-sm text-[#99999f] leading-relaxed mb-5">
                Rewards are funded in advance and held securely by the Solidity smart contract on MST Testnet until the publisher authorizes payment. Contributor payouts are guaranteed and tamper-proof.
              </p>
              <div className="mt-auto pt-3 border-t border-white/10 text-[11px] text-[#71717a] flex items-center gap-1.5">
                <i className="fa-solid fa-lock text-[10px] text-white/60" />
                <span>Non-custodial smart contract escrow</span>
              </div>
            </div>

            {/* Feature 2: Real-time identification of GitHub PR */}
            <div className="cc-card relative group p-6 rounded-2xl bg-gradient-to-b from-[#121214] to-[#0c0c0e] border border-white/15 hover:border-white/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white text-xs mb-4">
                02
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                Real-time identification of GitHub PR
              </h3>
              <p className="text-xs sm:text-sm text-[#99999f] leading-relaxed mb-5">
                Integrates the GitHub REST API and event webhooks to track pull request lifecycle, commits, approvals, and merged status in real time, automatically updating progress on ContribChain.
              </p>
              <div className="mt-auto pt-3 border-t border-white/10 text-[11px] text-[#71717a] flex items-center gap-1.5">
                <i className="fa-solid fa-code-pull-request text-[10px] text-white/60" />
                <span>Instant status sync via GitHub API</span>
              </div>
            </div>

            {/* Feature 3: GitHub-Integrated Contribution Marketplace */}
            <div className="cc-card relative group p-6 rounded-2xl bg-gradient-to-b from-[#121214] to-[#0c0c0e] border border-white/15 hover:border-white/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white text-xs mb-4">
                03
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                GitHub-Integrated Contribution Marketplace
              </h3>
              <p className="text-xs sm:text-sm text-[#99999f] leading-relaxed mb-5">
                Organizations publish verified open-source projects, list specific bugs or feature improvements, and attach fixed token rewards for transparent, permissionless global developer participation.
              </p>
              <div className="mt-auto pt-3 border-t border-white/10 text-[11px] text-[#71717a] flex items-center gap-1.5">
                <i className="fa-brands fa-github text-[10px] text-white/60" />
                <span>Direct repository issue &amp; PR binding</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Escrow Workflow Section */}
      <section id="workflow" className="relative z-10 w-full py-20 bg-black/85 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70 text-xs font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
              <span>MST Blockchain Escrow Lifecycle</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Transparent, Escrow-Backed Bounties
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8e8e98]">
              Connecting GitHub open-source repositories with funded bounties on MST Blockchain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                01
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Fund Escrow</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Publisher specifies task acceptance criteria and deposits the full {currencySymbol} reward upfront into smart contract escrow.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                02
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Contribute &amp; Link PR</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Contributor connects BridgeKey wallet, creates a pull request, and submits its reference on-chain.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                03
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Review &amp; Approve</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Publisher reviews submissions and approves the winning contribution on-chain, reserving the escrow.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                04
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Merge &amp; Release</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                After the PR is merged on GitHub, publisher executes <code className="text-white">releaseReward</code> to transfer {currencySymbol} directly to the winner.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
