'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import {
  ShieldCheck,
} from 'lucide-react'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Explore dApps', href: '/explore' },
    { name: 'Contributors', href: '/contributors' },
    { name: 'Publisher Hub', href: '/publisher' },
  ]

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path === '/explore' && ['/explore','/projects','/opportunities'].some(route=>pathname.startsWith(route))) return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  return (
    <header className="sticky top-0 z-40 w-full pt-5 pb-3 px-4 sm:px-6 lg:px-8 flex justify-center pointer-events-none bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      <div className="w-full max-w-[1180px] flex items-center justify-between gap-3 sm:gap-5 pointer-events-auto">
        {/* Circular Logo Button */}
        <Link
          href="/"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.16)] grid place-items-center shrink-0 hover:scale-105 transition-transform"
          aria-label="Home"
        >
          <Image
            src="/assets/contribChainlogo.webp"
            alt=""
            width="52"
            height="52"
            className="w-[72%] h-[72%] object-fit-contain block"
          />
        </Link>

        {/* Desktop Nav Pill (White) */}
        <nav
          className="hidden md:flex flex-1 max-w-[480px] h-11 sm:h-12 bg-white rounded-full px-2 shadow-[0_4px_14px_rgba(0,0,0,0.16)] items-center justify-around"
          aria-label="Primary navigation"
        >
          {navLinks.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative px-3.5 py-1.5 text-xs sm:text-[13.5px] font-medium tracking-tight text-[#2e2e2e] transition-opacity ${
                  active ? 'opacity-100 font-semibold' : 'opacity-50 hover:opacity-80'
                }`}
              >
                <span>{link.name}</span>
                {active && (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-black shadow-[-5px_0_0_#000,5px_0_0_#000]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right Action: Connect Wallet in Dark Pill */}
        <div className="cc-wallet-ui flex items-center gap-2">
          <ConnectWalletButton />

          {/* Mobile Burger Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-full bg-[#28282a] border-none shadow-[0_4px_14px_rgba(0,0,0,0.16)] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span
              className={`block w-[18px] h-[1.5px] bg-white rounded-sm transition-transform duration-200 ${
                mobileMenuOpen ? 'translate-y-[5.5px] rotate-45 !bg-white' : ''
              }`}
            />
            <span
              className={`block w-[18px] h-[1.5px] bg-white rounded-sm transition-opacity duration-200 ${
                mobileMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-[18px] h-[1.5px] bg-white rounded-sm transition-transform duration-200 ${
                mobileMenuOpen ? '-translate-y-[5.5px] -rotate-45 !bg-white' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Sheet */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-40 pointer-events-auto"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm bg-white rounded-[24px] p-5 shadow-2xl z-50 pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200 text-left">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">ContribChain</span>
              <span className="text-emerald-600 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Sepolia Escrow
              </span>
            </div>

            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative px-4 py-2.5 rounded-xl text-sm font-medium text-slate-800 transition-colors ${
                      active ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>{link.name}</span>
                    {active && (
                      <span className="inline-block ml-2 w-1.5 h-1.5 rounded-full bg-black align-middle" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
