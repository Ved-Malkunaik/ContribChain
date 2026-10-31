import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { contractAddress, explorerUrl, networkName, chainId, currencySymbol } from '@/lib/contract'

export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#050506] text-[#7d7d86]">
      <div className="max-w-[1240px] mx-auto px-6 sm:px-8 pt-12 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr] gap-10 pb-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 text-white mb-4">
              <span className="w-8 h-8 rounded-full bg-white grid place-items-center">
                <Image src="/assets/contribChainlogo.webp" alt="" width={23} height={23} />
              </span>
              <span className="font-medium text-lg tracking-tight">ContribChain</span>
            </Link>
            <p className="max-w-sm text-xs leading-7">
              Build in the open. Fund meaningful work. Reward contributions through transparent {networkName} escrow.
            </p>
            <details className="mt-4 text-[10px] leading-6 max-w-md">
              <summary className="cursor-pointer text-[#a5a5ae]">How trust and escrow work</summary>
              <p className="mt-2">
                Approval reserves the reward; the publisher confirms a separate release transaction. ContribChain checks GitHub merge state before preparing payment, while the contract enforces escrow ownership and the single winner.
              </p>
            </details>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[.16em] text-[#c2c2ca] mb-5">The platform</h4>
            <nav className="flex flex-col gap-3 text-xs">
              <Link href="/explore" className="hover:text-white">Explore dApps</Link>
              <Link href="/contributors" className="hover:text-white">Contributors Hub</Link>
              <Link href="/publisher" className="hover:text-white">Publisher Hub</Link>
              <Link href="/publisher/projects/new" className="hover:text-white">Register a project</Link>
            </nav>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[.16em] text-[#c2c2ca] mb-5">On-chain, on {networkName}</h4>
            <p className="cc-badge mb-4" data-tone="success">
              <span />{networkName} · {chainId}
            </p>
            <p className="text-xs leading-7">
              Native {currencySymbol}<br />Single-winner escrow
            </p>
            <a
              href={`${explorerUrl}/${contractAddress ? 'address/' + contractAddress : ''}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#c2c2ca] mt-4 hover:text-white"
            >
              {contractAddress ? 'View escrow contract' : 'MSTScan'}
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4 text-[10px] text-[#585862]">
          <span>© 2026 ContribChain. Built for open-source contributors.</span>
          <span>{networkName} · Hackathon MVP</span>
        </div>
      </div>
    </footer>
  )
}
