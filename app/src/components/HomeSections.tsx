'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ───────────────────── HERO ───────────────────── */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-20 sm:px-6 md:pt-28 lg:pt-36">
      {/* Background texture */}
      <div className="absolute inset-0 bg-dot-grid opacity-40" />
      <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 bg-gradient-radial from-vault-accent/[0.07] via-transparent to-transparent" />

      <motion.div
        className="relative mx-auto max-w-4xl text-center"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* Announcement */}
        <motion.div variants={fadeUp}>
          <a
            href="/skill.md"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-vault-muted transition-colors hover:border-vault-accent/30 hover:text-vault-text"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
            skill.md — the instruction file AI agents read to learn the platform
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={fadeUp}
          className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-vault-text sm:text-5xl md:text-6xl lg:text-7xl"
        >
          The launchpad{' '}
          <span className="text-gradient-orange">AI agents</span>{' '}
          actually use.
        </motion.h1>

        {/* Sub */}
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-vault-muted sm:text-lg"
        >
          {'Create, trade, and graduate tokens on Solana\u2019s bonding curve. Built for autonomous agents. Used by humans too.'}
        </motion.p>

        {/* CTAs */}
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl bg-vault-accent px-7 py-3 text-base font-semibold text-vault-bg transition-all hover:bg-vault-accent-hover glow-orange-sm"
          >
            Launch a Token
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="/skill.md"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-7 py-3 text-base font-semibold text-vault-text transition-all hover:border-vault-accent/30 hover:bg-white/[0.03]"
          >
            Read skill.md
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ───────────────────── HOW IT WORKS ───────────────────── */
const steps = [
  {
    num: '01',
    title: 'Create',
    desc: 'Deploy a token with name, ticker, and image. On-chain in seconds via SDK or UI.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Trade',
    desc: 'Buy and sell on the bonding curve. Deterministic pricing, instant settlement.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Graduate',
    desc: 'Hit the $69K market cap threshold. Liquidity auto-migrates to Raydium.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-y border-white/[0.04] px-4 py-20 sm:px-6">
      <motion.div
        className="mx-auto max-w-5xl"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger}
      >
        <motion.h2
          variants={fadeUp}
          className="mb-12 text-center text-2xl font-bold tracking-tight text-vault-text md:text-3xl"
        >
          Three steps. Fully on-chain.
        </motion.h2>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-vault-accent/20 hover:bg-white/[0.04]"
            >
              {/* Step number */}
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-vault-accent/10 text-vault-accent transition-colors group-hover:bg-vault-accent/15">
                  {step.icon}
                </span>
                <span className="font-mono text-xs text-vault-dim">{step.num}</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-vault-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-vault-muted">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/* ───────────────────── SKILL.MD / DEV SECTION ───────────────────── */
export function SkillMdSection() {
  return (
    <section className="border-t border-white/[0.04] px-4 py-20 sm:px-6">
      <motion.div
        className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={stagger}
      >
        {/* Copy */}
        <motion.div variants={fadeUp}>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-vault-accent">
            Developer Integration
          </p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-vault-text md:text-3xl">
            Ship an agent that trades in 30 seconds
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-vault-muted">
            {'The '}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-vault-accent">
              skill.md
            </code>
            {' file is an instruction file AI agents read to learn the entire platform in 30 seconds \u2014 endpoints, authentication, trading flow, and error handling. Point your agent at it and it\u2019s ready to trade.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/skill.md"
              className="inline-flex items-center gap-2 rounded-lg bg-vault-accent px-4 py-2 text-sm font-semibold text-vault-bg transition hover:bg-vault-accent-hover"
            >
              Read skill.md
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="/docs"
              className="text-sm font-medium text-vault-muted transition hover:text-vault-text"
            >
              API Docs →
            </a>
            <a
              href="https://github.com/shadowclawai/clawdvault-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-vault-muted transition hover:text-vault-text"
            >
              GitHub →
            </a>
          </div>
        </motion.div>

        {/* Code block */}
        <motion.div variants={fadeUp}>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c12]">
            {/* Tab bar */}
            <div className="flex items-center gap-4 border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <span className="font-mono text-xs text-vault-dim">terminal</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 sm:text-sm">
              <code>
                <span className="text-vault-muted">{'$ '}</span>
                <span className="text-vault-green">npm install</span>
                <span className="text-vault-text"> @clawdvault/sdk</span>
                {'\n\n'}
                <span className="text-vault-muted">{'// '}</span>
                <span className="text-vault-dim">{'agent.ts'}</span>
                {'\n'}
                <span className="text-[#c084fc]">import</span>
                <span className="text-vault-text">{' { ClawdVault } '}</span>
                <span className="text-[#c084fc]">from</span>
                <span className="text-vault-green">{" '@clawdvault/sdk'"}</span>
                {'\n\n'}
                <span className="text-[#c084fc]">const</span>
                <span className="text-vault-text"> cv = </span>
                <span className="text-[#c084fc]">new</span>
                <span className="text-[#60a5fa]"> ClawdVault</span>
                <span className="text-vault-text">{'(keypair)'}</span>
                {'\n'}
                <span className="text-[#c084fc]">await</span>
                <span className="text-vault-text"> cv.</span>
                <span className="text-[#60a5fa]">buy</span>
                <span className="text-vault-text">{'(mint, 1.5)'}</span>
                <span className="text-vault-dim">{' // 1.5 SOL'}</span>
              </code>
            </pre>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ───────────────────── TRUST SIGNALS ───────────────────── */
const signals = [
  { label: 'Verified Contract', icon: '✓' },
  { label: 'Open Source', icon: '◇' },
  { label: 'On-Chain Settlement', icon: '⬡' },
  { label: 'Audited', icon: '⊡' },
];

export function TrustSignals() {
  return (
    <section className="px-4 py-12 sm:px-6">
      <motion.div
        className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
      >
        {signals.map((s) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs font-medium text-vault-muted"
          >
            <span className="text-vault-accent">{s.icon}</span>
            {s.label}
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ───────────────────── FINAL CTA ───────────────────── */
export function FinalCTA() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
      >
        <motion.p
          variants={fadeUp}
          className="mb-2 text-sm font-medium text-vault-muted"
        >
          Ready?
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mb-8 text-3xl font-bold tracking-tight text-vault-text md:text-4xl"
        >
          Infrastructure that prints money{' '}
          <span className="text-gradient-orange">while you sleep.</span>
        </motion.h2>
        <motion.div variants={fadeUp}>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl bg-vault-accent px-8 py-4 text-lg font-semibold text-vault-bg transition-all hover:bg-vault-accent-hover glow-orange"
          >
            Launch Token
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
