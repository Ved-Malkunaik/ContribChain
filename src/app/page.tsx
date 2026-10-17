'use client'

import { formatEther, parseEther } from 'viem'
import { useFeed } from '@/lib/use-platform'
import { FeedStatus } from '@/components/PlatformStatus'
import Link from 'next/link'

export default function HomePage() {
  const {data}=useFeed()
  const stats={time:data.projects.length,uptime:data.opportunities.filter(o=>o.state==='Open').length,runtime:data.submissions.filter(s=>s.status==='Paid').length,context:formatEther(data.opportunities.reduce((sum,o)=>sum+parseEther(o.remainingEscrowEth),0n))}

  return (
    <div className="relative w-full flex-1 flex flex-col justify-between">
      {/* 1. Full-bleed background video with moving matrix particles */}
      <div className="fixed inset-0 w-full h-full overflow-hidden bg-black z-0 pointer-events-none">
        <video
          className="absolute inset-0 w-full h-full object-cover"
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
        {/* Subtle overlay gradient to ensure readability */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      </div>

      {/* 2. Hero Region (Single-viewport full-height center stage) */}
      <section className="relative z-10 w-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center px-4 sm:px-6 max-w-5xl mx-auto py-12">
        {/* Trust Row: 3 overlapping avatar rings + trust pill */}
        <div className="inline-flex items-center mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#28282a] border border-white/40 p-[5px] grid place-items-center relative z-[1] hover:-translate-y-0.5 transition-transform">
            <div className="w-full h-full rounded-full bg-white grid place-items-center text-[#111] text-xs">
              <i className="fa-brands fa-microsoft" />
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
            <span>Ethereum Sepolia · Testnet only</span>
          </div>
        </div>

        {/* Headline: Exact two lines in retro dot-matrix BubbledotICG-FinePos font */}
        <h1 className="font-display font-normal text-white text-[32px] sm:text-[54px] md:text-[76px] lg:text-[84px] tracking-[-0.04em] leading-[1.08] sm:leading-[1.12] uppercase select-none mb-5 max-w-4xl">
          <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100">
            Contribute Code
          </span>
          <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300">
            Earn Sepolia ETH
          </span>
        </h1>

        {/* Subhead */}
        <p className="max-w-md sm:max-w-lg mx-auto text-[#d0d0d0]/80 text-[14px] sm:text-[16px] leading-relaxed mb-8 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-500 font-normal">
          Discover funded open-source opportunities. Submit a pull request and earn
          Sepolia ETH after publisher approval, GitHub merge, and payment confirmation.
        </p>

        {/* CTA Button */}
        <div className="animate-in fade-in zoom-in-95 duration-700 delay-700 flex flex-col sm:flex-row items-center gap-3">
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
        </div>

        <div className="w-full max-w-2xl mt-10"><FeedStatus /></div>
        {/* 3. Stats Footer (Exact 4 metrics) */}
        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pt-16 sm:pt-20 text-center">
          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">
              &lt;
            </div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">
              {stats.time}
            </div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">
              Registered Projects
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">
              %
            </div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">
              {stats.uptime}
            </div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">
              Open Opportunities
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">
              *
            </div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">
              {stats.runtime}
            </div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">
              Confirmed Payments
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-display text-white text-2xl sm:text-3xl leading-none mb-1">
              #
            </div>
            <div className="font-semibold text-white text-xl sm:text-2xl tracking-tight font-mono">
              {stats.context} ETH
            </div>
            <div className="text-[#8e8e8e] text-xs sm:text-[12.5px] mt-0.5">
              Locked Escrow
            </div>
          </div>
        </div>
      </section>

      {/* 4. Escrow Workflow Section */}
      <section className="relative z-10 w-full py-20 bg-black/85 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/70 text-xs font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
              <span>Decentralized Escrow Lifecycle</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Transparent, Escrow-Backed Bounties
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#8e8e98]">
              Connecting GitHub open-source repositories with funded Ethereum Sepolia bounties.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                01
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Fund Escrow</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Publisher specifies task acceptance criteria and deposits the full Sepolia ETH reward upfront into smart contract escrow.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                02
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Contribute & Link PR</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Contributor links MetaMask with verified GitHub, creates a pull request, and submits it to the opportunity.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                03
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Review & Approve</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                Publisher reviews submissions and selects the winning PR on-chain. Approval fixes the selected contributor wallet.
              </p>
            </div>

            <div className="cc-card">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 text-white/70 flex items-center justify-center font-bold text-xs mb-3">
                04
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Merge & Release</h3>
              <p className="text-xs text-[#8e8e98] leading-relaxed">
                After the PR is merged on GitHub, the publisher executes <code className="text-white">releaseReward</code> to transfer funds.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
