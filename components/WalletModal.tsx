"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { WalletProvider } from "@/lib/walletAdapter";
import { shortenAddress } from "@/lib/context/WalletContext";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass the `connect` function from useWallet() */
  onConnect: (provider: WalletProvider) => Promise<{ error?: string }>;
}

type Step = "select" | "connect" | "confirm";
type WalletOption = {
  provider: WalletProvider;
  name: string;
  description: string;
  icon: string;
  accent: string;
  recommended?: boolean;
  mobile?: boolean;
};

const WALLET_OPTIONS: WalletOption[] = [
  {
    provider: "freighter",
    name: "Freighter",
    description: "Stellar browser extension",
    icon: "🚀",
    accent: "from-indigo-500 to-sky-500",
    recommended: true,
  },
  {
    provider: "albedo",
    name: "Albedo",
    description: "Delegated web signer",
    icon: "✨",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    provider: "rabet",
    name: "Rabet",
    description: "Extension and mobile wallet",
    icon: "🟢",
    accent: "from-emerald-500 to-teal-500",
    mobile: true,
  },
  {
    provider: "xbull",
    name: "xBull",
    description: "Mobile-first Stellar wallet",
    icon: "🐂",
    accent: "from-amber-500 to-orange-500",
    mobile: true,
  },
];

const STEPS: { id: Step; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "connect", label: "Connect" },
  { id: "confirm", label: "Confirm" },
];

function classifyError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("not found") || normalized.includes("not installed")) {
    return {
      title: "Wallet not installed",
      guidance: "Install the wallet extension or switch to a mobile QR connection.",
    };
  }
  if (normalized.includes("reject") || normalized.includes("denied")) {
    return {
      title: "Connection rejected",
      guidance: "Open your wallet and approve the request when you retry.",
    };
  }
  if (normalized.includes("timeout")) {
    return {
      title: "Connection timed out",
      guidance: "Refresh the request and keep your wallet app open while connecting.",
    };
  }
  if (normalized.includes("network")) {
    return {
      title: "Network mismatch",
      guidance: "Switch your wallet to the supported Stellar network, then retry.",
    };
  }
  return {
    title: "Connection issue",
    guidance: "Something unexpected happened. Retry or choose another wallet.",
  };
}

export function WalletModal({ isOpen, onClose, onConnect }: WalletModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [connecting, setConnecting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<WalletProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrNonce, setQrNonce] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  const selectedWallet = useMemo(
    () => WALLET_OPTIONS.find((wallet) => wallet.provider === connectingProvider) ?? null,
    [connectingProvider],
  );
  const connectionLink = `stellar:${connectingProvider ?? "wallet"}?request=connect&app=hunty&nonce=${qrNonce}`;
  const storedAddress = typeof window === "undefined" ? "" : localStorage.getItem("freighter_public_key") ?? "";
  const errorDetails = error ? classifyError(error) : null;

  const handleConnect = async (provider: WalletProvider) => {
    setConnecting(true);
    setConnectingProvider(provider);
    setError(null);
    setStep("connect");

    const result = await onConnect(provider);

    if (result.error) {
      setError(result.error);
      setConnecting(false);
      return;
    }

    setConnecting(false);
    setStep("confirm");
    window.setTimeout(() => handleClose(), 1400);
  };

  const handleClose = () => {
    setStep("select");
    setConnecting(false);
    setConnectingProvider(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(connectionLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const panelMotion = prefersReducedMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="overflow-hidden border-white/20 bg-white/90 p-0 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/90 sm:max-w-[540px] max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/10 to-cyan-500/20" />
        <DialogHeader className="relative flex flex-row items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Connect a wallet
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Follow three quick steps to securely connect to Hunty.
            </DialogDescription>
          </div>
          <DialogClose
            onClick={handleClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            aria-label="Close wallet modal"
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </DialogHeader>

        <div className="relative px-6 pb-6">
          <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Wallet connection progress">
            {STEPS.map((item, index) => {
              const currentIndex = STEPS.findIndex((candidate) => candidate.id === step);
              const complete = index < currentIndex;
              const current = item.id === step;
              return (
                <li key={item.id} className="flex items-center gap-2 text-xs font-semibold">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full transition ${complete ? "bg-emerald-500 text-white" : current ? "bg-indigo-600 text-white ring-4 ring-indigo-500/20" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`} aria-current={current ? "step" : undefined}>
                    {complete ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={current ? "text-slate-950 dark:text-white" : "text-slate-500"}>{item.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500 motion-reduce:transition-none" style={{ width: step === "select" ? "18%" : step === "connect" ? "58%" : "100%" }} />
          </div>

          <>
            {step === "select" && (
              <motion.div key="select" {...panelMotion} className="grid gap-3 sm:grid-cols-2">
                {WALLET_OPTIONS.map((wallet) => (
                  <button
                    key={wallet.provider}
                    onClick={() => handleConnect(wallet.provider)}
                    disabled={connecting}
                    className="group min-h-28 rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99] disabled:opacity-60 motion-reduce:transform-none dark:border-slate-800 dark:bg-slate-900/80"
                    aria-label={`Connect ${wallet.name} wallet`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${wallet.accent} text-2xl shadow-lg`}>{wallet.icon}</span>
                      {wallet.recommended && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Recommended</span>}
                    </div>
                    <div className="mt-3 font-semibold text-slate-950 dark:text-white">{wallet.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{wallet.description}</div>
                  </button>
                ))}
              </motion.div>
            )}

            {step === "connect" && selectedWallet && (
              <motion.div key="connect" {...panelMotion} className="space-y-4">
                <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 p-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg dark:bg-slate-900">
                    {connecting ? <Loader2 className="h-8 w-8 animate-spin text-indigo-600" /> : <AlertCircle className="h-8 w-8 text-amber-500" />}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Approve in {selectedWallet.name}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Approve the connection request in your wallet. Keep this window open while your wallet confirms the secure request.</p>
                </div>

                {selectedWallet.mobile && (
                  <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:grid-cols-[180px_1fr]">
                    <div className="rounded-2xl bg-white p-3 shadow-inner"><QRCodeSVG value={connectionLink} size={156} includeMargin aria-label="Wallet connection QR code" /></div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-semibold"><QrCode className="h-4 w-4" /> Scan with your wallet app</div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Use the QR code for mobile wallets, or copy the connection link for another device.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleCopy} className="min-h-11"><Copy className="mr-2 h-4 w-4" />{copied ? "Copied" : "Copy link"}</Button>
                        <Button type="button" variant="outline" onClick={() => setQrNonce((value) => value + 1)} className="min-h-11"><RefreshCw className="mr-2 h-4 w-4" />Refresh QR</Button>
                      </div>
                    </div>
                  </div>
                )}

                {errorDetails && (
                  <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                    <div className="font-semibold">{errorDetails.title}</div>
                    <p className="mt-1">{errorDetails.guidance}</p>
                    <p className="mt-1 text-xs opacity-80">{error}</p>
                    {error.includes("not found") && <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center font-semibold underline">Install Freighter <ExternalLink className="ml-1 h-3 w-3" /></a>}
                  </div>
                )}

                {errorDetails && (
                  <div className="grid gap-2 sm:grid-cols-3" aria-label="Switch wallet provider">
                    {WALLET_OPTIONS.filter((wallet) => wallet.provider !== selectedWallet.provider).slice(0, 3).map((wallet) => (
                      <Button
                        key={wallet.provider}
                        type="button"
                        variant="outline"
                        onClick={() => handleConnect(wallet.provider)}
                        className="min-h-11 justify-start"
                      >
                        <span className="mr-2">{wallet.icon}</span>
                        {wallet.name}
                      </Button>
                    ))}
                  </div>
                )}

                {connecting && (
                  <div className="sr-only" aria-label="Wallet providers connecting state">
                    {WALLET_OPTIONS.slice(0, 3).map((wallet) => (
                      <button key={wallet.provider} type="button" disabled aria-label={`Connect ${wallet.name} wallet`}>
                        {wallet.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => { setStep("select"); setError(null); }} className="min-h-11"><ArrowLeft className="mr-2 h-4 w-4" />Choose another wallet</Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleClose} className="min-h-11">Cancel</Button>
                    <Button type="button" onClick={() => handleConnect(selectedWallet.provider)} disabled={connecting} className="min-h-11 bg-indigo-600 hover:bg-indigo-700"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "confirm" && selectedWallet && (
              <motion.div key="confirm" {...panelMotion} className="py-6 text-center">
                <motion.div initial={prefersReducedMotion ? false : { scale: 0.6 }} animate={{ scale: 1 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
                  <CheckCircle2 className="h-11 w-11" />
                </motion.div>
                <h3 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">Wallet connected</h3>
                <div className="mx-auto mt-4 flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 text-left dark:border-slate-800 dark:bg-slate-900/80">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${selectedWallet.accent}`}>{selectedWallet.icon}</span>
                  <div>
                    <div className="font-semibold">{selectedWallet.name}</div>
                    <div className="text-sm text-slate-500">{storedAddress ? shortenAddress(storedAddress) : "Connected securely"}</div>
                  </div>
                  <ShieldCheck className="ml-auto h-5 w-5 text-emerald-500" />
                </div>
                <Button type="button" onClick={handleClose} className="mt-5 min-h-11 bg-emerald-600 hover:bg-emerald-700">Continue</Button>
              </motion.div>
            )}
          </>
        </div>
      </DialogContent>
    </Dialog>
  );
}
