import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { Header } from "@/components/Header"

const sections = [
  {
    title: "Use of Hunty",
    body: "Hunty lets creators publish scavenger hunts and lets players participate with connected Stellar wallets. You are responsible for the hunts you create, the content you submit, and the wallet actions you approve.",
  },
  {
    title: "Wallets and rewards",
    body: "Transactions are confirmed on Stellar and cannot be reversed by Hunty after you approve them in your wallet. Always review wallet prompts, recipient addresses, reward amounts, and network fees before signing.",
  },
  {
    title: "Creator content",
    body: "Creators should only publish lawful, safe, and accurate hunt content. Hunty may hide or remove hunts that appear fraudulent, abusive, unsafe, or otherwise harmful to players or the platform.",
  },
  {
    title: "No financial advice",
    body: "Hunty is a game and creator tool. Nothing in the app is financial, legal, tax, or investment advice.",
  },
]

export default function TermsPage() {
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
            <ShieldCheck className="h-4 w-4" />
            Terms
          </div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white md:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400 md:text-lg">
            These terms summarize the expectations for using Hunty as a player
            or creator. They are written to keep gameplay fair, wallet actions
            clear, and community content trustworthy.
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
