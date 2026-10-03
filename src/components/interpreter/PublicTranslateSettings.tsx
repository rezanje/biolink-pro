'use client'

import { useEffect, useState } from 'react'
import { Check, CircleAlert, Languages, Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isPublicTranslateEnabled } from '@/lib/profile-display.mjs'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function PublicTranslateSettings() {
    const { t } = useUiLanguage()
    const supabase = createClient()
    const [userId, setUserId] = useState<string | null>(null)
    const [enabled, setEnabled] = useState(true)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let live = true
        const load = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                if (authError || !user) throw new Error('Authentication unavailable')
                const { data: profile, error: profileError } = await supabase.from('profiles')
                    .select('theme').eq('user_id', user.id).single()
                if (profileError || !profile) throw new Error('Profile unavailable')
                if (live) {
                    setUserId(user.id)
                    setEnabled(isPublicTranslateEnabled(profile.theme))
                }
            } catch {
                if (live) setError('Could not load your settings. Please refresh and try again.')
            } finally {
                if (live) setLoading(false)
            }
        }
        void load()
        return () => { live = false }
    }, [supabase])

    const save = async () => {
        if (!userId || loading || saving) return
        setSaving(true); setSaved(false); setError('')
        try {
            // The owner endpoint merges this patch with the latest saved theme.
            const response = await fetch('/api/admin/users/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, theme: { public_translate_enabled: enabled } }),
            })
            if (!response.ok) throw new Error('Save failed')
            setSaved(true)
        } catch {
            setError('Could not save your settings. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
            <div>
                <div className="flex items-center gap-2"><Languages className="h-5 w-5" /><h2 id="public-translate-label" className="text-[16px] font-semibold">{t('Show Live Translate on public card')}</h2></div>
                <p id="public-translate-description" className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{t('Let visitors translate from your card. You can still use the interpreter here when this is off.')}</p>
            </div>
            <button type="button" role="switch" aria-checked={enabled} aria-labelledby="public-translate-label" aria-describedby="public-translate-description" disabled={loading || saving || !userId}
                onClick={() => { setEnabled(current => !current); setSaved(false); setError('') }}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-ink' : 'bg-track'}`}>
                <span className={`h-6 w-6 rounded-full bg-white shadow-row transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
        </div>
        {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink"><CircleAlert className="h-4 w-4 shrink-0" />{t(error)}</p>}
        {saved && <p role="status" className="mt-4 flex items-center gap-2 rounded-row bg-success-soft px-3 py-2 text-[12px] text-success-soft-ink"><Check className="h-4 w-4 shrink-0" />{t(enabled ? 'Live Translate is visible on your public card.' : 'Live Translate is hidden from your public card.')}</p>}
        <button type="button" onClick={save} disabled={loading || saving || !userId} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-[13px] font-medium text-white disabled:opacity-50">
            {loading || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t(loading ? 'Loading…' : saving ? 'Saving…' : 'Save settings')}
        </button>
    </section>
}
