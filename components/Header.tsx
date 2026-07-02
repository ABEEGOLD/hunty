"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, Copy, LogOut, Menu, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Coin from "./icons/Coin";
import { useIsMounted } from "@/hooks/useIsMounted";
import { useWallet } from "@/lib/context/WalletContext";
import { WalletBottomSheet } from "./WalletBottomSheet";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";

const NAV_ITEMS = [
  { label: "Play", href: "/" },
  { label: "Create", href: "/hunty" },
  { label: "Leaderboard", href: "/?tab=leaderboard" },
  { label: "Help", href: "/help" },
];

export function Header({ balance = "0" }: { balance?: string }) {
  const mounted = useIsMounted();
  const { connected, displayKey, publicKey, connect, disconnect, walletProvider } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [publicKey]);

  const handleDisconnect = useCallback(() => {
    setDropdownOpen(false);
    disconnect();
  }, [disconnect]);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-2xl font-black bg-gradient-to-br from-[#2F2FFF] to-[#E87785] bg-clip-text text-transparent"
          aria-label="Hunty home"
        >
          Hunty
        </Link>

        <nav className="order-3 flex w-full flex-wrap gap-2 text-sm font-semibold md:order-none md:w-auto md:flex-1 md:justify-center">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#3737A4] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-blue-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#3737A4] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-blue-300"
          >
            <Search className="h-5 w-5" />
          </button>
          <LanguageSelector />
          <ThemeToggle />

          {mounted && connected ? (
            <div className="relative" ref={dropdownRef}>
              <Button
                onClick={() => setDropdownOpen((current) => !current)}
                className="flex items-center gap-2 rounded-xl border-2 border-transparent bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:opacity-90 dark:bg-slate-900 dark:text-white"
                style={{
                  background:
                    "linear-gradient(var(--background), var(--background)) padding-box, linear-gradient(to right, #0C0C4F, #4A4AFF) border-box",
                }}
              >
                <Coin />
                <span>{balance}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropdownOpen && "rotate-180")} />
              </Button>

              {dropdownOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950">
                  <div className="bg-gradient-to-r from-[#0C0C4F] to-[#4A4AFF] px-4 py-3 text-white">
                    <p className="text-xs text-blue-200">Connected wallet</p>
                    <p className="text-[11px] uppercase tracking-wide text-blue-200/80">{walletProvider ?? "freighter"}</p>
                    <p className="break-all font-mono text-xs">{publicKey}</p>
                  </div>
                  <div className="flex flex-col gap-1 p-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-label="Copy wallet address"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-slate-400" />}
                      <span>{copied ? "Copied!" : "Copy address"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Disconnect wallet</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Button
              onClick={() => setModalOpen(true)}
              className="rounded-xl bg-[#0C0C4F] px-4 py-2 text-sm font-black text-white hover:bg-slate-700"
            >
              Connect Wallet
            </Button>
          )}

          <button
            type="button"
            aria-label="Open menu"
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      <WalletBottomSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={(provider) => connect(provider)}
      />
    </header>
  );
}
