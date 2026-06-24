import Link from "next/link"
import { ArrowLeft, LockKeyhole } from "lucide-react"

import { Header } from "@/components/Header"

const sections = [
  {
    title: "Information you provide",
    body: "Hunty may process hunt details, clues, creator-provided metadata, profile information, and support messages that you submit while using the app.",
  },
  {
    title: "Wallet information",
    body: "When you connect a wallet, Hunty uses your public wallet address to show balances, associate gameplay activity, and prepare Stellar transactions. Hunty never asks for or stores your private keys.",
  },
  {
    title: "Usage data",
    body: "The app may collect basic product analytics and technical diagnostics so the team can understand feature usage, improve reliability, and troubleshoot errors.",
  },
  {
    title: "Your choices",
    body: "You can disconnect your wallet at any time. Avoid submitting sensitive personal information in hunt descriptions, clues, answers, or creator content.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-100 bg-purple-100 to-[#f9f9ff] pb-[75px] dark:from-slate-900 dark:bg-slate-900 dark:to-slate-800">
      <Header />

      <div className="mx-auto max-w-[1100px] rounded-4xl bg-white px-6 py-10 dark:bg-slate-900 sm:px-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-[#3737A4] dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Arcade
        </Link>

        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3737A4]/20 bg-[#3737A4]/10 px-3 py-1.5 text-sm font-semibold text-[#3737A4] dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200">
            <LockKeyhole className="h-4 w-4" />
            Privacy
          </div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400 md:text-lg">
            This policy explains the data Hunty uses to run hunts, connect
            wallets, and improve the product while keeping private wallet
            credentials out of scope.
          </p>
        </div>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950"
            >
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
