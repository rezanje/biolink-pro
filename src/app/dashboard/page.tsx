'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    ArrowUpRight, BarChart3, Check, Edit, ExternalLink, Eye, Gift, Languages, Leaf, Link2,
    Plus, QrCode, Smartphone, TreeDeciduous, User, Wind, Zap,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { PWAHint } from '@/components/dashboard/PWAHint'
import { activeRedirectUrl, readShortcuts } from '@/lib/redirect-mode.mjs'
import PetSprite from '@/components/pet/PetSprite'
import { PET_FEATURE_ENABLED, petDisplayName, selectPetCharacter } from '@/lib/pet/pet-selection.mjs'
import AnimatedNumber from '@/components/motion/AnimatedNumber'
import { useUiLanguage } from '@/components/UiLanguageProvider'

type LinkRow = { id?: string; title?: string; url?: string; is_active?: boolean }
type DashProfile = {
    id: string
    slug: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    tier?: 'FREE' | 'PREMIUM' | 'B2B'
    links?: LinkRow[] | null
    social_links?: LinkRow[] | null
    theme?: { links?: LinkRow[]; shortcuts?: { url?: string; title?: string }[] } | null
    company?: { name: string; logo_url: string | null } | null
}

function Skeleton() {
    return (
        <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">
            <div className="h-9 w-56 rounded-full bg-track" />
            <div className="mt-6 h-[88px] rounded-card bg-track" />
            <div className="mt-3 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-[84px] rounded-card-sm bg-track" />)}
            </div>
            <div className="mt-6 h-[190px] rounded-card bg-track" />
        </div>
    )
}

/** Angka besar + satuan + catatan kecil — pola yang dipakai kartu Green Impact. */
function Impact({
    icon: Icon, tone, label, value, unit, locale, decimals = 0,
}: {
    icon: typeof Leaf
    tone: string
    label: string
    value: number
    unit: string
    locale: string
    decimals?: number
}) {
    return (
        <div className="flex flex-col items-center px-2 text-center">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </span>
            <p className="mt-2.5 text-[10px] font-medium uppercase leading-tight tracking-wider text-ink-2">{label}</p>
            <p className="mt-1.5 flex items-baseline gap-1">
                <span className="text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={value} locale={locale} decimals={decimals} /></span>
                <span className="text-[11.5px] text-ink-3">{unit}</span>
            </p>
        </div>
    )
}

export default function DashboardPage() {
    const { t, locale } = useUiLanguage()
    const numberLocale = locale === 'id' ? 'id-ID' : locale === 'zh-CN' ? 'zh-CN' : 'en-US'
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<DashProfile | null>(null)
    const [viewCount, setViewCount] = useState(0)
    const [linkClicks, setLinkClicks] = useState(0)
    const [showPWAHint, setShowPWAHint] = useState(false)
    const [copied, setCopied] = useState(false)

    // Dibaca sekali saat state pertama dibentuk, bukan di dalam effect. Menulis
    // state langsung di badan effect memicu render berantai.
    const [showClaimSuccess] = useState(() => {
        if (typeof window === 'undefined') return false
        return new URLSearchParams(window.location.search).get('claim_success') === 'true'
    })

    // Kado yang menempel di jam milik user — kejutan pertama tetap bisa dibuka lagi.
    const [giftUuid, setGiftUuid] = useState<string | null>(null)

    useEffect(() => {
        if (showClaimSuccess) window.history.replaceState({}, '', '/dashboard')

        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: dbProfile } = await supabase
                .from('profiles')
                .select('*, company:companies(name, logo_url)')
                .eq('user_id', user.id)
                .single()

            if (!dbProfile) {
                setLoading(false)
                return
            }
            setProfile(dbProfile as DashProfile)

            const [views, clicks] = await Promise.all([
                supabase.from('analytics').select('*', { count: 'exact', head: true })
                    .eq('profile_id', dbProfile.id).eq('event_type', 'view'),
                supabase.from('analytics').select('*', { count: 'exact', head: true })
                    .eq('profile_id', dbProfile.id).eq('event_type', 'click'),
            ])

            setViewCount(views.count || 0)
            setLinkClicks(clicks.count || 0)

            const { data: gifted } = await supabase
                .from('serial_numbers')
                .select('serial_uuid')
                .eq('owner_id', user.id)
                .eq('gift_enabled', true)
                .not('gift_url', 'is', null)
                .limit(1)
                .maybeSingle()
            setGiftUuid(gifted?.serial_uuid || null)

            setLoading(false)
        }

        load()
    }, [router])

    const downloadQr = () => {
        const svg = document.getElementById('dashboard-qr')
        if (!svg) return
        const data = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx?.drawImage(img, 0, 0)
            const a = document.createElement('a')
            a.download = `qrcode-${profile?.slug}.png`
            a.href = canvas.toDataURL('image/png')
            a.click()
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
    }

    if (loading) return <Skeleton />

    if (!profile) {
        return (
            <div className="flex min-h-screen items-center justify-center px-5 text-center">
                <p className="text-sm text-ink-2">{t('No profile yet. Claim your card first.')}</p>
            </div>
        )
    }

    const theme = profile.theme || {}
    const liveUrl = activeRedirectUrl(theme)
    const shortcuts = readShortcuts(theme) as { url?: string; title?: string }[]
    const live = liveUrl ? shortcuts.find((s) => s.url === liveUrl) : null

    const links: LinkRow[] = (profile.social_links?.length ? profile.social_links : profile.links) || []
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${profile.slug}` : `/${profile.slug}`
    const shareHost = typeof window !== 'undefined' ? `${window.location.host}/${profile.slug}` : `/${profile.slug}`
    const isB2B = profile.tier === 'B2B' && profile.company
    const co2 = viewCount * 10

    const quickActions = [
        {
            icon: User,
            label: t('Edit Profile'),
            desc: t('Update your photo, name, and bio'),
            href: '/dashboard/profile',
            preview: (
                <div className="flex items-center gap-2.5">
                    {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white" />
                    ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-avatar text-[14px] font-semibold text-avatar-ink">
                            {profile.display_name?.[0]?.toUpperCase() || 'U'}
                        </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                        {profile.display_name || t('No name yet')}
                    </span>
                </div>
            ),
        },
        {
            icon: Link2,
            label: t('Manage Links'),
            desc: t('Add and organize your social links'),
            href: '/dashboard/profile#profile-links',
            preview: links.length ? (
                <div className="grid gap-1">
                    {links.slice(0, 3).map((l, i) => (
                        <span key={l.id ?? i} className="flex items-center gap-1.5 truncate text-[11px] text-ink-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" />
                            <span className="truncate">{l.title || t('Untitled')}</span>
                        </span>
                    ))}
                    {links.length > 3 && (
                <span className="text-[11px] text-ink-3">+{links.length - 3} more</span>
                    )}
                </div>
            ) : (
                <span className="text-[11px] text-ink-3">{t('No links yet')}</span>
            ),
        },
        {
            icon: copied ? Check : ExternalLink,
            label: copied ? t('Link copied') : t('Copy Profile Link'),
            desc: t('Share your card URL'),
            onClick: () => {
                navigator.clipboard.writeText(shareUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            },
            preview: (
                <span
                    className="inline-block max-w-full break-all rounded-lg bg-fill-subtle px-2 py-1.5 text-[10.5px] leading-snug text-ink-2"
                    style={{ fontFamily: 'var(--font-mono)' }}
                >
                    {shareHost}
                </span>
            ),
        },
        {
            icon: Eye,
            label: t('View Public Profile'),
            desc: t('See your card as visitors do'),
            href: `/${profile.slug}`,
            external: true,
            preview: (
                <span className="inline-block rounded-lg bg-white p-1.5 shadow-row">
                    <QRCodeSVG value={shareUrl} size={44} level="L" includeMargin={false} />
                </span>
            ),
        },
    ]

    // Kotak Asisten dibedakan dari empat aksi lain: melebar dua kolom dan
    // menampilkan pet-nya langsung sebagai pratinjau hidup.
    const petCharacter = PET_FEATURE_ENABLED ? selectPetCharacter(profile) : null

    return (
        <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">

            {showClaimSuccess && (
                <div className="mb-5 flex items-center gap-3 rounded-card-sm bg-surface p-4 shadow-row">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft">
                        <Check className="h-[18px] w-[18px] text-success-soft-ink" strokeWidth={2} />
                    </span>
        <p className="text-[14px] font-medium">{t('Card claimed. Welcome! 🎉')}</p>
                </div>
            )}

            {/* SAPAAN */}
            <header>
                {isB2B ? (
                    <div className="flex items-center gap-4">
                        {profile.company?.logo_url ? (
                            <img src={profile.company.logo_url} alt="" className="h-14 w-14 object-contain" />
                        ) : (
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fill-subtle text-[20px] font-semibold">
                                {profile.company?.name?.[0]}
                            </span>
                        )}
                        <div className="min-w-0">
                            <h1 className="truncate text-[26px] font-semibold tracking-[-0.03em]">
                                {t('Dashboard')} {profile.company?.name}
                            </h1>
                            <p className="mt-1 text-[13px] text-ink-2">{t('Welcome, {name}', { name: profile.display_name || '' })}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">
                            {t('Welcome, {name}! 👋', { name: profile.display_name || t('there') })}
                        </h1>
                        <p className="mt-1.5 text-[13px] text-ink-2">
                            {t('Manage your digital business card profile here')}
                        </p>
                    </>
                )}

                <button
                    onClick={() => setShowPWAHint(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-2"
                >
                    <Smartphone className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {t('Want faster access?')}{' '}
                    <span className="font-semibold text-ink underline">{t('Add to your phone')}</span>
                </button>
            </header>

            {/* PROFIL ANDA */}
            <section className="mt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Your Profile')}</h2>
                    <Link href="/dashboard/profile" className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
                        <Edit className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {t('Edit Profile')}
                    </Link>
                </div>

                <div className="mt-4 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-start gap-5">
                        {profile.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt=""
                                className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white"
                            />
                        ) : (
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-avatar text-[22px] font-semibold text-avatar-ink">
                                {profile.display_name?.[0]?.toUpperCase() || 'U'}
                            </span>
                        )}
                        <div className="min-w-0 flex-1">
                            <h3 className="text-[19px] font-semibold tracking-[-0.02em]">
                                {profile.display_name || t('No name yet')}
                            </h3>
                            {profile.bio && (
                                <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">{profile.bio}</p>
                            )}
                            <Link
                                href={`/${profile.slug}`}
                                target="_blank"
                                className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink"
                            >
                                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                                <span className="truncate">{shareHost}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* KENANGAN KADO — muncul cuma kalau jamnya datang sebagai hadiah */}
            {giftUuid && (
                <Link
                    href={`/kado/${giftUuid}`}
                    className="mt-3 flex items-center gap-3.5 rounded-card-sm bg-surface p-4 shadow-row transition-transform active:scale-[0.99]"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink">
                        <Gift className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-medium leading-tight">{t('Gift Memory')}</p>
                        <p className="mt-0.5 text-[12px] text-ink-2">{t('Revisit the surprise that came with your watch')}</p>
                    </div>
                    <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-ink-3" strokeWidth={2} />
                </Link>
            )}

            {/* Shortcut aktif — diatur di /switch */}
            <Link
                href="/switch"
                className="mt-6 flex items-center gap-3.5 rounded-card-sm bg-ink p-4 text-white shadow-ink transition-transform active:scale-[0.99]"
            >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14]">
                    <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                    <p
                        className="text-[10px] uppercase tracking-[0.14em] text-white/55"
                        style={{ fontFamily: 'var(--font-mono)' }}
                    >
                        {t('YOUR SHORTCUT')}
                    </p>
                    <p className="mt-1 truncate text-[15px] font-medium">
                        {live ? live.title || t('Link Shortcut') : t('Digital Business Card')}
                    </p>
                </div>
                <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-white/60" strokeWidth={2} />
            </Link>

            {profile.tier !== 'FREE' && (
                <Link
                    href="/dashboard/interpreter"
                    className="mt-3 flex items-center gap-3.5 rounded-card-sm bg-surface p-4 shadow-row transition-transform active:scale-[0.99]"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-ink-2">
                        <Languages className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1"><p className="text-[14.5px] font-medium leading-tight">{t('Live Interpreter')}</p><p className="mt-0.5 text-[12px] text-ink-2">{t('Speak across languages, one sentence at a time')}</p></div>
                    <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-ink-3" strokeWidth={2} />
                </Link>
            )}

            {/* TIGA ANGKA — satu kartu, tiga kolom */}
            <section className="mt-3 grid grid-cols-3 divide-x divide-ink/[0.08] rounded-card-sm bg-surface px-2 py-4 shadow-row">
                <div className="flex flex-col items-center px-2">
                    <Eye className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
                    <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={viewCount} locale={numberLocale} /></p>
                    <p className="mt-1.5 text-center text-[11.5px] text-ink-2">{t('Profile Views')}</p>
                </div>

                <div className="flex flex-col items-center px-2">
                    <Link2 className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
                    <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={links.length} locale={numberLocale} /></p>
                    <p className="mt-1.5 text-center text-[11.5px] text-ink-2">{t('Total Links')}</p>
                </div>

                <div className="flex flex-col items-center px-2">
                    <BarChart3 className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
                    {profile.tier === 'FREE' ? (
                        <>
                            <div className="mt-2 flex items-center gap-1.5">
                                <span className="select-none text-[22px] font-semibold leading-none text-ink-3 blur-sm">123</span>
                                <span className="rounded-full bg-coral-soft px-1.5 py-0.5 text-[9px] font-semibold text-coral-soft-ink">
                                    PREMIUM
                                </span>
                            </div>
                            <p className="mt-1.5 text-center text-[11.5px] text-ink-3">{t('Link Clicks')}</p>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={linkClicks} locale={numberLocale} /></p>
                            <p className="mt-1.5 text-center text-[11.5px] text-ink-2">{t('Link Clicks')}</p>
                        </>
                    )}
                </div>
            </section>

            {/* GREEN IMPACT */}
            <section className="mt-7">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft">
                        <Leaf className="h-[18px] w-[18px] text-success-soft-ink" strokeWidth={1.8} />
                    </span>
                    <div>
                        <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Gentanala Green Impact')}</h2>
                            <p className="text-[12.5px] text-ink-2">{t('Your contribution to the environment')}</p>
                    </div>
                </div>

                <div className="mt-4 rounded-card-sm bg-surface px-2 py-4 shadow-row">
                    <div className="grid grid-cols-3 divide-x divide-ink/[0.08]">
                        <Impact
                            icon={BarChart3}
                            tone="bg-success-soft text-success-soft-ink"
                            label={t('Paper Saved')}
                            value={viewCount}
                            locale={numberLocale}
                            unit={t('sheets')}
                        />
                        <Impact
                            icon={Wind}
                            tone="bg-fill-subtle text-ink-2"
                            label={t('Carbon Emissions Prevented')}
                            value={co2 >= 1000 ? co2 / 1000 : co2}
                            decimals={co2 >= 1000 ? 2 : 0}
                            locale={numberLocale}
                            unit={co2 >= 1000 ? 'kg' : 'gram'}
                        />
                        <Impact
                            icon={TreeDeciduous}
                            tone="bg-coral-soft text-coral-soft-ink"
                            label={t('Trees Protected')}
                            value={viewCount / 10000}
                            decimals={4}
                            locale={numberLocale}
                            unit={t('trees')}
                        />
                    </div>
                    <p className="mt-4 border-t border-ink/[0.08] px-2 pt-3 text-[10px] italic leading-relaxed text-ink-3">
                        {t('*1 profile view = 1 paper business card · 10 g CO₂ per card · 10,000 cards = 1 mature tree')}
                    </p>
                </div>
            </section>

            <div className="mt-7 grid gap-7 lg:grid-cols-2">

                {/* AKSI CEPAT */}
                <section>
                    <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Quick Actions')}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                        {quickActions.map((a) => {
                            const inner = (
                                <>
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle">
                                        <a.icon className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
                                    </span>
                                    <div className="my-2 min-w-0 max-w-full overflow-hidden">{a.preview}</div>
                                    <div className="mt-auto min-w-0 max-w-full">
                                        <p className="truncate text-[14px] font-medium leading-tight">{a.label}</p>
                                        <p className="mt-0.5 truncate text-[11.5px] text-ink-2">{a.desc}</p>
                                    </div>
                                </>
                            )
                            const cls = 'flex aspect-square flex-col items-start justify-between overflow-hidden rounded-card-sm bg-surface p-4 text-left shadow-row transition-transform active:scale-[0.99]'
                            return a.href ? (
                                <Link
                                    key={a.label}
                                    href={a.href}
                                    target={a.external ? '_blank' : undefined}
                                    className={cls}
                                >
                                    {inner}
                                </Link>
                            ) : (
                                <button key={a.label} onClick={a.onClick} className={cls}>{inner}</button>
                            )
                        })}
                        {/* Kotak Asisten — melebar dua kolom, pet-nya jadi pratinjau hidup */}
                        {petCharacter && (
                            <Link
                                href="/dashboard/ai-assistant"
                                className="col-span-2 flex items-center gap-4 rounded-card-sm bg-surface p-4 text-left shadow-row transition-transform active:scale-[0.99]"
                            >
                                <PetSprite characterId={petCharacter.id} clip="idle" size={56} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-medium leading-tight">{t('Assistant')}</p>
                                    <p className="mt-0.5 truncate text-[11.5px] text-ink-2">
                                        {petDisplayName(profile)} {t('is ready to greet your visitors')}
                                    </p>
                                </div>
                                <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-ink-3" strokeWidth={2} />
                            </Link>
                        )}
                    </div>
                </section>

                {/* LINK ANDA */}
                <section>
                    <div className="flex items-center justify-between">
                        <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Your Links')}</h2>
                        <Link href="/dashboard/profile#profile-links" className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                            {t('Add Link')}
                        </Link>
                    </div>

                    {links.length ? (
                        <div className="mt-4 grid gap-2.5">
                            {links.slice(0, 5).map((l, i) => (
                                <div
                                    key={l.id ?? i}
                                    className="flex items-center justify-between gap-3 rounded-row bg-surface p-3.5 shadow-row"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fill-subtle">
                                            <Link2 className="h-4 w-4 text-ink-2" strokeWidth={1.8} />
                                        </span>
                                <span className="truncate text-[14px] font-medium">{l.title || t('Untitled')}</span>
                                    </div>
                                    <ExternalLink className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                </div>
                            ))}
                            {links.length > 5 && (
                                <p className="mt-1 text-center text-[11.5px] text-ink-3">
                                    {t('View all links in Manage Links')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-card border border-dashed border-ink/15 bg-surface/60 p-10 text-center">
                            <Link2 className="mx-auto mb-3 h-10 w-10 text-ink-3" strokeWidth={1.5} />
                            <h3 className="text-[15px] font-medium">{t('No links yet')}</h3>
                            <p className="mt-1.5 text-[12.5px] text-ink-2">{t('Add social media and custom links to your card')}</p>
                            <Link
                                href="/dashboard/profile#profile-links"
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white"
                            >
                                <Plus className="h-4 w-4" strokeWidth={2} />
                                {t('Add Your First Link')}
                            </Link>
                        </div>
                    )}
                </section>

                {/* QR CODE */}
                <section>
                    <div className="flex items-center gap-2">
                        <QrCode className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
                        <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Profile QR Code')}</h2>
                    </div>

                    <div className="mt-4 flex flex-col items-center rounded-card bg-surface p-5 shadow-card">
                        <div className="rounded-2xl bg-white p-4 shadow-row">
                            <QRCodeSVG id="dashboard-qr" value={shareUrl} size={168} level="H" includeMargin={false} />
                        </div>
                        <p className="mt-5 px-4 text-center text-[12.5px] text-ink-2">
                            {t('Scan to instantly view your digital business card')}
                        </p>
                        <button
                            onClick={downloadQr}
                            className="mt-5 w-full rounded-full bg-fill-subtle py-3 text-[13px] font-medium text-ink transition-colors hover:bg-track"
                        >
                            {t('Download QR Code')}
                        </button>
                    </div>
                </section>
            </div>

            <PWAHint isOpen={showPWAHint} onClose={() => setShowPWAHint(false)} />
        </div>
    )
}
