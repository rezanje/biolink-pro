'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Gift, Play } from 'lucide-react'
import { youtubeEmbedUrl } from '@/lib/gift.mjs'
import { normalizeUrl } from '@/lib/redirect-mode.mjs'

export type GiftContent = {
    url?: string | null
    message?: string | null
    from?: string | null
}

// Layar kejutan. Dipakai dua kali: saat jam kado pertama di-tap (dengan ajakan
// mengaktifkan kartu), dan saat kadonya dibuka lagi sebagai kenangan dari
// dashboard (tanpa ajakan itu).
export default function GiftView({
    gift, onClaim, memory,
}: {
    gift: GiftContent
    onClaim?: () => void
    memory?: boolean
}) {
    const [opened, setOpened] = useState(Boolean(memory))
    // Video baru boleh jalan sendiri kalau penerima yang menekan tombolnya —
    // itu izin dari browser untuk memutar beserta suaranya.
    const [autoplay, setAutoplay] = useState(false)
    const embed = youtubeEmbedUrl(gift.url, { autoplay })

    return (
        <div className="min-h-screen bg-canvas font-kabut text-ink">
            <div className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-5 py-10">
                {!opened ? (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-card bg-surface p-8 text-center shadow-card"
                    >
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink">
                            <Gift className="h-7 w-7" strokeWidth={1.7} />
                        </span>
                        <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em]">Ada kejutan buat kamu</h1>
                        {gift.from && (
                            <p className="mt-2 text-[13px] text-ink-2">dari {gift.from}</p>
                        )}
                        <button
                            onClick={() => { setAutoplay(true); setOpened(true) }}
                            className="mt-7 w-full rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                        >
                            Buka kejutannya
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {memory && (
                            <p className="mb-3 text-center text-[10px] uppercase tracking-[0.14em] text-ink-2">
                                Kenangan kado
                            </p>
                        )}

                        {gift.message && (
                            <div className="rounded-card bg-surface p-6 text-center shadow-card">
                                <p className="text-[15px] leading-relaxed">{gift.message}</p>
                                {gift.from && (
                                    <p className="mt-4 text-[12.5px] text-ink-2">— {gift.from}</p>
                                )}
                            </div>
                        )}

                        {gift.url && <div className={gift.message ? 'mt-3' : ''}>
                            {embed ? (
                                <div className="overflow-hidden rounded-card bg-ink shadow-card">
                                    <iframe
                                        src={embed}
                                        title="Kejutan"
                                        className="aspect-video w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <a
                                    href={normalizeUrl(gift.url || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 rounded-card bg-surface p-6 text-[14px] font-medium shadow-card"
                                >
                                    <Play className="h-4 w-4" strokeWidth={1.8} />
                                    Buka kejutannya
                                    <ExternalLink className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.8} />
                                </a>
                            )}
                        </div>}

                        {onClaim && (
                            <div className="mt-7 rounded-card bg-surface p-6 text-center shadow-card">
                                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Jam ini sekarang punya kamu</h2>
                                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                                    Aktifkan biar jamnya bisa dipakai jadi kartu nama digital — sekali tap, orang langsung
                                    lihat profil kamu. Kadonya tetap tersimpan.
                                </p>
                                <button
                                    onClick={onClaim}
                                    className="mt-5 w-full rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                                >
                                    Aktifkan kartu ini
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    )
}
