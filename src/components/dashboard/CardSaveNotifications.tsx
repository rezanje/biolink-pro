'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BookmarkCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiLanguage } from '@/components/UiLanguageProvider'

type Notification = {
    id: string; created_at: string; read_at: string | null
    actor_profile_id: string | null; actor_slug: string | null; actor_name: string | null; is_saved: boolean
}

export function NotificationsLink() {
    const { t } = useUiLanguage()
    const [unread, setUnread] = useState(0)
    useEffect(() => {
        let active = true
        const refresh = async () => {
            if (document.hidden) return
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { if (active) setUnread(0); return }
                const { count, error } = await supabase.from('card_save_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null)
                if (active && !error) setUnread(count || 0)
            } catch { /* Inbox availability must not interrupt the dashboard. */ }
        }
        void refresh()
        const onRefresh = () => { void refresh() }
        window.addEventListener('focus', onRefresh)
        window.addEventListener('card-notifications-read', onRefresh)
        document.addEventListener('visibilitychange', onRefresh)
        const timer = window.setInterval(onRefresh, 60000)
        return () => {
            active = false
            clearInterval(timer)
            window.removeEventListener('focus', onRefresh)
            window.removeEventListener('card-notifications-read', onRefresh)
            document.removeEventListener('visibilitychange', onRefresh)
        }
    }, [])
    return <Link href="/dashboard/notifications" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={t('Notifications')}>
        <Bell className="h-4 w-4" />{t('Notifications')}
        {unread > 0 && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>}
    </Link>
}

export default function CardSaveNotifications() {
    const { t, locale } = useUiLanguage()
    const [items, setItems] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState<string | null>(null)
    const busyRef = useRef(false)
    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const supabase = createClient()
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError) throw authError
            if (!user) { window.location.assign('/login?next=/dashboard/notifications'); return }
            const { data, error: loadError } = await supabase.rpc('list_card_save_notifications')
            if (loadError) throw loadError
            setItems(data || [])
        } catch { setError(t('Could not load notifications. Please try again.')) }
        finally { setLoading(false) }
    }, [t])
    useEffect(() => { void load() }, [load])

    const markRead = async (item: Notification) => {
        if (item.read_at) return
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const readAt = new Date().toISOString()
            const { data, error } = await supabase.from('card_save_notifications').update({ read_at: readAt }).eq('id', item.id).eq('recipient_id', user.id).select('id').single()
            if (error || !data) throw error
            setItems(current => current.map(n => n.id === item.id ? { ...n, read_at: readAt } : n))
            window.dispatchEvent(new Event('card-notifications-read'))
        } catch { setError(t('Could not update notification. Please try again.')) }
    }

    const saveBack = async (item: Notification) => {
        if (!item.actor_profile_id || item.is_saved || busyRef.current) return
        busyRef.current = true
        setBusy(item.id)
        setError('')
        try {
            const supabase = createClient()
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError) throw authError
            if (!user) { window.location.assign('/login?next=/dashboard/notifications'); return }
            // Same operation as SaveCardButton: explicit, immediate, idempotent,
            // and preserves any existing folder. RLS rechecks public eligibility.
            const { error: saveError } = await supabase.from('saved_profiles').upsert({ user_id: user.id, profile_id: item.actor_profile_id }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true })
            if (saveError) throw saveError
            setItems(current => current.map(n => n.actor_profile_id === item.actor_profile_id ? { ...n, is_saved: true } : n))
            await markRead(item)
        } catch { setError(t('Could not save this card. Please refresh and try again.')) }
        finally { busyRef.current = false; setBusy(null) }
    }

    return <section aria-labelledby="notifications-title">
        <h1 id="notifications-title" className="font-display text-3xl">{t('Notifications')}</h1>
        <p className="mt-2 text-sm text-ink-2">{t('People who saved your card. Saving back is optional.')}</p>
        <button onClick={() => void load()} disabled={loading || Boolean(busy)} className="mt-4 rounded-full border border-line px-4 py-2 text-sm">{t('Refresh notifications')}</button>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {loading ? <p role="status" className="mt-6 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{t('Loading...')}</p> : <>
            {!error && items.length === 0 && <p className="mt-6 text-sm text-ink-2">{t('No card saves yet.')}</p>}
            <ul className="mt-6 space-y-3">
                {items.map(item => <li key={item.id} className="rounded-2xl border border-line bg-white/70 p-5">
                    <p className="text-sm font-medium">{t('{name} saved your card.', { name: item.actor_name || item.actor_slug || t('A Gentanala member') })}</p>
                    <p className="mt-1 text-xs text-ink-2"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(locale)}</time>{!item.read_at && <span className="ml-2">{t('Unread')}</span>}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                        {item.actor_slug && item.actor_profile_id ? <>
                            <Link href={`/${encodeURIComponent(item.actor_slug)}`} onClick={() => void markRead(item)} className="rounded-full border border-line px-4 py-2">{t('View card')}</Link>
                            <button onClick={() => void saveBack(item)} disabled={item.is_saved || Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-white disabled:opacity-60">
                                {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.is_saved ? <BookmarkCheck className="h-4 w-4" /> : null}
                                {item.is_saved ? t('Already saved') : t('Save back')}
                            </button>
                        </> : <p className="text-ink-2">{t('This member has no public card available.')}</p>}
                        {!item.read_at && <button onClick={() => void markRead(item)} className="rounded-full px-3 py-2 underline underline-offset-4">{t('Mark as read')}</button>}
                    </div>
                </li>)}
            </ul>
            {items.length === 100 && <p className="mt-4 text-xs text-ink-2">{t('Showing the latest 100 notifications.')}</p>}
            <Link href="/dashboard/saved" className="mt-6 inline-block text-sm underline underline-offset-4">{t('Saved Cards')}</Link>
        </>}
    </section>
}
