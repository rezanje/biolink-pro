'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bookmark, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiLanguage } from '@/components/UiLanguageProvider'

type CardPreview = { slug: string; display_name: string | null; company: string | null; job_title: string | null; avatar_url: string | null }

type SavedProfile = {
    profile_id: string
    created_at: string
    profile: CardPreview | null
}

type SavedProfileRow = Omit<SavedProfile, 'profile'> & { profile: CardPreview | CardPreview[] | null }

export default function SavedCardsPage() {
    const { t } = useUiLanguage()
    const supabase = createClient()
    const [cards, setCards] = useState<SavedProfile[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { window.location.assign('/login?next=/dashboard/saved'); return }
            const { data } = await supabase.from('saved_profiles').select('profile_id,created_at,profile:profiles(slug,display_name,company,job_title,avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false })
            const rows = (data || []) as unknown as SavedProfileRow[]
            setCards(rows.map(({ profile, ...card }) => ({ ...card, profile: Array.isArray(profile) ? profile[0] || null : profile })))
            setLoading(false)
        }
        void load()
    }, [supabase])

    const remove = async (profileId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('profile_id', profileId)
        if (!error) setCards(current => current.filter(card => card.profile_id !== profileId))
    }

    return <div className="mx-auto max-w-md px-5 pb-[150px] pt-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[12px] text-ink-2"><ArrowLeft className="h-4 w-4" />{t('Back to dashboard')}</Link>
        <header className="mt-5"><h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t('Saved Cards')}</h1><p className="mt-1.5 text-[13px] text-ink-2">{t('Business cards you want to keep close.')}</p></header>
        {loading ? <div className="flex h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div> : !cards.length ? <section className="mt-5 rounded-card bg-surface p-6 text-center shadow-card"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-fill-subtle"><Bookmark className="h-5 w-5 text-ink-2" /></span><h2 className="mt-4 text-[17px] font-semibold">{t('No saved cards yet')}</h2><p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t('Bookmark a public Gentanala card and it will appear here.')}</p></section> : <section className="mt-5 space-y-3">{cards.map(card => card.profile && <article key={card.profile_id} className="flex items-center gap-3 rounded-card-sm bg-surface p-3 shadow-row"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill-subtle text-[15px] font-semibold text-ink-2">{card.profile.avatar_url ? <img src={card.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : card.profile.display_name?.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{card.profile.display_name || t('Gentanala member')}</p><p className="mt-0.5 truncate text-[12px] text-ink-2">{[card.profile.job_title, card.profile.company].filter(Boolean).join(' · ') || t('Digital business card')}</p></div><div className="flex shrink-0 items-center gap-1"><Link href={`/${card.profile.slug}`} target="_blank" aria-label={t('Open card')} className="rounded-full p-2 text-ink-2 hover:bg-fill-subtle"><ExternalLink className="h-4 w-4" /></Link><button onClick={() => void remove(card.profile_id)} aria-label={t('Remove saved card')} className="rounded-full p-2 text-ink-2 hover:bg-coral-soft hover:text-coral-soft-ink"><Trash2 className="h-4 w-4" /></button></div></article>)}</section>}
    </div>
}
