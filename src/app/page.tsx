'use client'

import { useState, useRef, useEffect } from 'react'
import Link from "next/link"
import { LegalLinks } from "@/components/legal/LegalLinks"
import { motion, useScroll, useTransform } from "framer-motion"
import {
  ArrowRight,
  Zap,
  Palette,
  BarChart3,
  Smartphone,
  Share2,
  ExternalLink,
  Instagram,
  Twitter,
  MessageCircle,
  LayoutDashboard
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Buy NFC Watch', href: 'https://gentanala.com', external: true },
  { label: 'Features', href: '#features', external: false },
  { label: 'Sign In', href: '/login', external: false },
]

const FEATURES = [
  {
    icon: Zap,
    title: 'NFC Instant Share',
    desc: 'Sentuh smartphone siapapun — langsung terhubung. Tanpa download, tanpa ketik.',
  },
  {
    icon: Palette,
    title: 'Custom Profile',
    desc: 'Desain profil digital Anda sendiri. Pilih tema, warna, dan tampilkan kepribadian Anda.',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    desc: 'Lacak siapa yang melihat profil Anda, berapa link yang diklik, dan insight lainnya.',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }
  })
}

export default function HomePage() {
  const [activeNav, setActiveNav] = useState(1) // default to 'Features'
  const navRef = useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const heroRef = useRef<HTMLDivElement>(null)

  // Update sliding pill position
  useEffect(() => {
    if (!navRef.current) return
    const buttons = navRef.current.querySelectorAll<HTMLButtonElement>('[data-nav-btn]')
    const btn = buttons[activeNav]
    if (btn) {
      setPillStyle({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      })
    }
  }, [activeNav])

  // Handle nav click
  const handleNavClick = (index: number) => {
    setActiveNav(index)
    const item = NAV_ITEMS[index]
    if (item.external) {
      window.open(item.href, '_blank')
    } else if (item.href.startsWith('#')) {
      const el = document.querySelector(item.href)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.location.href = item.href
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f0ec] text-zinc-900 overflow-x-hidden selection:bg-cyan-100 selection:text-cyan-700">

      {/* ─── NAVIGATION (Desktop Only) ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 hidden md:flex items-center justify-between px-10 py-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="Gentanala"
            className="h-9 w-auto object-contain brightness-0"
          />
        </Link>

        {/* Liquid Glass Nav Pill — Center */}
        <div
          ref={navRef}
          className="flex items-center relative rounded-full px-1.5 py-1.5"
          style={{
            background: 'linear-gradient(165deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.10) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            border: '1.5px solid rgba(255,255,255,0.55)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05), inset 0 1.5px 3px rgba(255,255,255,0.70), inset 0 -1px 2px rgba(0,0,0,0.02)',
          }}
        >
          {/* Sliding pill indicator — transparent glass */}
          <motion.div
            className="absolute top-1.5 bottom-1.5 rounded-full z-0"
            animate={{ left: pillStyle.left, width: pillStyle.width }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.08)',
            }}
          />
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item.label}
              data-nav-btn
              onClick={() => handleNavClick(i)}
              className={`relative z-10 px-5 py-2.5 text-[13px] font-semibold tracking-wide transition-colors duration-300 rounded-full whitespace-nowrap ${activeNav === i ? 'text-white' : 'text-zinc-600 hover:text-zinc-900'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dashboard button — Right */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold tracking-wide transition-all hover:scale-105 active:scale-95 shrink-0"
          style={{
            background: 'linear-gradient(165deg, rgba(255,255,255,0.60) 0%, rgba(255,255,255,0.25) 100%)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1.5px solid rgba(255,255,255,0.55)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05), inset 0 1.5px 3px rgba(255,255,255,0.75)',
          }}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
      </nav>

      {/* Mobile Nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 py-2.5"
        style={{
          background: 'rgba(240,240,236,0.92)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="Gentanala" className="h-5 w-auto brightness-0" />
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="https://gentanala.com"
            target="_blank"
            className="text-[10px] font-bold text-zinc-700 px-2.5 py-1.5 rounded-full uppercase tracking-wide"
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            Buy
          </Link>
          <Link
            href="/login"
            className="text-[10px] font-bold text-white px-2.5 py-1.5 rounded-full uppercase tracking-wide"
            style={{
              background: 'rgba(20,20,20,0.85)',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="text-zinc-600 p-1.5 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>


      {/* ─── HERO BANNER (STICKY) ─── */}
      <div ref={heroRef} className="sticky top-0 w-full h-[60vh] md:h-screen z-0">
        <img
          src="https://damgyhadhnirwabekbvs.supabase.co/storage/v1/object/public/public-assets/7a9c1211-b7bf-4f1d-8da5-57c3ea8e9072/banner%20home%20page%20nfc%20web.jpg"
          alt="Gentanala NFC Watch"
          className="w-full h-full object-cover bg-[#f0f0ec]"
          style={{ objectPosition: 'center 30%' }}
        />
        {/* Fade gradient responsive */}
        <div className="absolute bottom-0 left-0 right-0 h-[35%] md:h-[30%] bg-gradient-to-t from-[#f0f0ec] via-[#f0f0ec]/50 to-transparent" />
      </div>


      {/* ─── CONTENT OVERLAY (scrolls OVER the hero) ─── */}
      <div className="relative z-10">

        {/* ─── §3 HEADLINE + TAGLINE ─── */}
        <section className="relative px-6 pt-20 pb-16 -mt-[30vh]"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, #f0f0ec 25%)',
          }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="text-[13px] font-medium text-zinc-500 mb-6 tracking-widest uppercase"
            >
              The Art of Digital Networking
            </motion.p>

            <motion.h1
              custom={1} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="text-5xl md:text-8xl font-black text-zinc-900 leading-[1.05] tracking-tight mb-8"
            >
              Make Your Move,<br />
              <span className="italic font-normal" style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}>
                Memorable
              </span>
            </motion.h1>

            <motion.p
              custom={2} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="text-zinc-500 text-[15px] md:text-[17px] leading-relaxed max-w-2xl mx-auto mb-12 font-medium"
            >
              Bagikan kontak, karya, dan media sosial Anda dengan satu sentuhan NFC.
              Identitas digital yang modern, elegan, dan sepenuhnya milik Anda.
            </motion.p>


            {/* ─── §4 CTA BUTTONS ─── */}
            <motion.div
              custom={3} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Link
                href="https://gentanala.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-4 rounded-full text-white text-[13px] font-bold uppercase tracking-widest transition-all active:scale-95 hover:scale-[1.03] w-full sm:w-auto flex items-center justify-center gap-3"
                style={{
                  background: 'rgba(20, 20, 20, 0.85)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                }}
              >
                Buy NFC Watch <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="px-10 py-4 rounded-full text-zinc-700 text-[13px] font-bold uppercase tracking-widest transition-all active:scale-95 hover:scale-[1.03] w-full sm:w-auto text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(0,0,0,0.08)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.60)',
                }}
              >
                Sign In to Profile
              </Link>
            </motion.div>
          </div>
        </section>


        {/* ─── §5 THREE FEATURE CARDS ─── */}
        <section id="features" className="relative z-10 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-4">What Makes It Special</p>
              <h2 className="text-4xl md:text-6xl font-black text-zinc-900">
                Built for{' '}
                <span className="italic font-normal" style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}>
                  Professionals
                </span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.7 }}
                  className="lg-card p-8 md:p-10 group hover:scale-[1.02] transition-transform duration-500"
                >
                  <div className="relative z-[2]">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/40"
                      style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6)' }}
                    >
                      <feat.icon className="w-7 h-7 text-zinc-800" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 mb-3 uppercase tracking-wider">{feat.title}</h3>
                    <p className="text-zinc-500 text-[15px] leading-relaxed font-medium">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>


        {/* ─── §6 PROFILE MOCKUP SECTION ─── */}
        <section className="relative z-10 py-24 px-6 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-16">

              {/* Live Phone Mockup — scrollable iframe */}
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="md:w-1/2 flex justify-center"
              >
                <div className="relative w-[280px] h-[580px]">
                  {/* Phone frame */}
                  <div className="absolute inset-0 rounded-[44px] bg-zinc-900 shadow-[0_25px_60px_rgba(0,0,0,0.3)] overflow-hidden"
                    style={{ border: '8px solid #1a1a1a' }}
                  >
                    {/* Dynamic Island */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-black rounded-full z-20" />

                    {/* Live iframe — scaled to match inner frame */}
                    <div className="w-full h-full" style={{ overflow: 'hidden' }}>
                      <iframe
                        src="/rezanje"
                        title="Gentanala Profile Demo"
                        className="border-0"
                        style={{
                          width: '390px',
                          height: '844px',
                          pointerEvents: 'auto',
                          transform: 'scale(0.677)',  // 264px inner / 390px viewport
                          transformOrigin: 'top left',
                        }}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Description side */}
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="md:w-1/2"
              >
                <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-4">Your Digital Identity</p>
                <h2 className="text-4xl md:text-5xl font-black text-zinc-900 mb-6 leading-tight">
                  One Profile,<br />
                  <span className="italic font-normal" style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    Infinite Reach
                  </span>
                </h2>
                <p className="text-zinc-500 text-[16px] leading-relaxed font-medium mb-8">
                  Profil Gentanala bukan sekadar link-in-bio. Ini adalah identitas digital premium yang siap mewakili Anda di setiap pertemuan — lengkap dengan galeri, dokumen, dan analitik.
                </p>

                <div className="space-y-5">
                  {[
                    { icon: Smartphone, text: 'Tap & Share — Langsung terhubung via NFC' },
                    { icon: Palette, text: 'Custom Theme — Dark, Light, atau Liquid Glass' },
                    { icon: Share2, text: 'Share QR Code — Bagikan tanpa batas jarak' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="lg-social w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-zinc-700" style={{ position: 'relative', zIndex: 2 }} />
                      </div>
                      <p className="text-zinc-700 text-[15px] font-medium">{item.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>


        {/* ─── §7 CLOSING CTA ─── */}
        <section className="relative z-10 py-32 px-6 text-center overflow-hidden">
          {/* Subtle background aura */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-200/20 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-7xl font-black text-zinc-900 mb-6 leading-tight"
            >
              Your Network.<br />
              <span className="italic font-normal" style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}>
                Your Legacy.
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-zinc-500 text-[16px] md:text-[18px] leading-relaxed font-medium mb-12 max-w-xl mx-auto"
            >
              Mulai perjalanan networking digital Anda hari ini. Buat kesan pertama yang tak terlupakan.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link
                href="https://gentanala.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-12 py-5 rounded-full text-white text-[13px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'rgba(20, 20, 20, 0.85)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              >
                Start Your Journey <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>


        {/* ─── §8 FOOTER ─── */}
        <footer className="relative z-10 py-16 px-8 border-t border-zinc-200/60 bg-[#f0f0ec]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
            <div>
              <img src="/logo.png" alt="Gentanala" className="h-8 w-auto brightness-0 mb-4" />
              <p className="text-zinc-400 text-sm font-medium">Redefining modern networking.</p>
            </div>
            <div className="flex gap-12">
              <div className="flex flex-col gap-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Product</span>
                <Link href="https://gentanala.com" target="_blank" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">Buy NFC Watch</Link>
                <Link href="/login" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">Sign In</Link>
                <Link href="/dashboard" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">Dashboard</Link>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Social</span>
                <div className="flex gap-4 text-zinc-400">
                  <Instagram className="w-5 h-5 hover:text-pink-500 cursor-pointer transition-colors" />
                  <Twitter className="w-5 h-5 hover:text-blue-400 cursor-pointer transition-colors" />
                  <MessageCircle className="w-5 h-5 hover:text-green-500 cursor-pointer transition-colors" />
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-zinc-200/40">
            <div className="mb-5"><LegalLinks /></div>
            <p className="text-[12px] font-medium text-zinc-300 uppercase tracking-widest">
              © 2026 Gentanala Studio. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
