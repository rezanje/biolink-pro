'use client'

import { useEffect, useState } from 'react'
import { Check, CircleAlert, Loader2, LockKeyhole, Save, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConversationInbox from './ConversationInbox'
import { useUiLanguage } from '@/components/UiLanguageProvider'

type Knowledge = { about: string; services: string; portfolio: string; faq: string }
type Settings = { enabled: boolean; persona: string; instructions: string; greeting: string; knowledge: Knowledge; suggested_actions: string[]; booking_url: string }
type InboxMessage = { id: string; visitor_id: string; visitor_name: string | null; intent: string | null; role: 'visitor' | 'assistant'; content: string; created_at: string }
const initial: Settings = { enabled: false, persona: 'Professional concierge', instructions: '', greeting: '', knowledge: { about: '', services: '', portfolio: '', faq: '' }, suggested_actions: ['Explore services', 'View portfolio', 'Ask about pricing', 'Book a meeting'], booking_url: '' }

export default function ConciergeManager() {
    const { t } = useUiLanguage()
    const supabase = createClient()
    const [profileId, setProfileId] = useState('')
    const [settings, setSettings] = useState<Settings>(initial)
    const [messages, setMessages] = useState<InboxMessage[]>([])
    const [eligible, setEligible] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data: profile } = await supabase.from('profiles').select('id,bio,company,job_title,tier').eq('user_id', user.id).maybeSingle()
            if (!profile) { setLoading(false); return }
            setProfileId(profile.id)
            const canUseConcierge = profile.tier === 'PREMIUM' || profile.tier === 'B2B'
            setEligible(canUseConcierge)
            if (!canUseConcierge) { setLoading(false); return }
            const [{ data: stored, error: settingsError }, { data: inbox }] = await Promise.all([
                supabase.from('ai_concierge_settings').select('*').eq('profile_id', profile.id).maybeSingle(),
                supabase.from('ai_concierge_messages').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(60),
            ])
            if (settingsError) setError(t('Concierge storage is not ready. Run the latest database update first.'))
            if (stored) {
                const knowledge = typeof stored.knowledge === 'object' && stored.knowledge ? stored.knowledge as Partial<Knowledge> : {}
                setSettings({ ...initial, ...stored, knowledge: { ...initial.knowledge, ...knowledge }, suggested_actions: Array.isArray(stored.suggested_actions) ? stored.suggested_actions.filter((item: unknown): item is string => typeof item === 'string').slice(0, 4) : initial.suggested_actions })
            } else {
                setSettings(current => ({ ...current, knowledge: { ...current.knowledge, about: [profile.job_title, profile.company, profile.bio].filter(Boolean).join(' — ') } }))
            }
            setMessages((inbox || []) as InboxMessage[]); setLoading(false)
        }
        void load()
    }, [supabase])

    const setKnowledge = (key: keyof Knowledge, value: string) => setSettings(current => ({ ...current, knowledge: { ...current.knowledge, [key]: value } }))
    const save = async () => {
        if (!profileId) return
        setSaving(true); setError(''); setNotice('')
        const booking = settings.booking_url.trim()
        if (booking && !/^https:\/\//i.test(booking)) { setError(t('Booking link must start with https://')); setSaving(false); return }
        const { error: saveError } = await supabase.from('ai_concierge_settings').upsert({ ...settings, profile_id: profileId, persona: settings.persona.trim(), greeting: settings.greeting.trim(), instructions: settings.instructions.trim(), booking_url: booking, suggested_actions: settings.suggested_actions.filter(Boolean).slice(0, 4) })
        setSaving(false)
        if (saveError) { setError(t('Changes were not saved. Please try again.')); return }
        setNotice(settings.enabled ? t('Concierge is live on your public card.') : t('Draft saved. Turn it on when ready.'))
    }

    if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
    if (!eligible) return <section className="mt-5 rounded-card bg-surface p-5 shadow-card md:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill-subtle"><LockKeyhole className="h-5 w-5 text-ink-2" /></span><div><h2 className="text-[17px] font-semibold">{t('AI Concierge')}</h2><p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{t('AI Concierge is available on Premium and B2B plans.')}</p></div></div></section>
    return <>
        <section className="mt-5 rounded-card bg-surface p-5 shadow-card md:p-6">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5" /><h2 className="text-[17px] font-semibold">{t('AI Concierge')}</h2></div><p className="mt-1 text-[12.5px] text-ink-2">{t('Turns card visits into useful answers, qualified leads, and next steps.')}</p></div><button type="button" onClick={() => setSettings(current => ({ ...current, enabled: !current.enabled }))} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full ${settings.enabled ? 'bg-ink' : 'bg-track'}`} role="switch" aria-checked={settings.enabled} aria-label={t('Show concierge on public card')}><span className={`h-6 w-6 rounded-full bg-white shadow-row transition-transform ${settings.enabled ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label={t('Concierge name')} value={settings.persona} onChange={value => setSettings(current => ({ ...current, persona: value }))} placeholder={t('Professional concierge')} /><Field label={t('Opening message')} value={settings.greeting} onChange={value => setSettings(current => ({ ...current, greeting: value }))} placeholder={t('Hi — what brings you here?')} multiline /></div>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label={t('What you do')} value={settings.knowledge.about} onChange={value => setKnowledge('about', value)} multiline /><Field label={t('Services')} value={settings.knowledge.services} onChange={value => setKnowledge('services', value)} multiline /><Field label={t('Portfolio or proof')} value={settings.knowledge.portfolio} onChange={value => setKnowledge('portfolio', value)} multiline /><Field label={t('Frequently asked questions')} value={settings.knowledge.faq} onChange={value => setKnowledge('faq', value)} multiline /></div>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label={t('Answer guidance')} value={settings.instructions} onChange={value => setSettings(current => ({ ...current, instructions: value }))} placeholder={t('Example: Do not guess pricing. Keep replies direct.')} multiline /><Field label={t('Booking link')} value={settings.booking_url} onChange={value => setSettings(current => ({ ...current, booking_url: value }))} placeholder="https://…" /></div>
            <div className="mt-5"><p className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{t('Visitor shortcuts')}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{settings.suggested_actions.map((action, index) => <input key={index} value={action} maxLength={80} onChange={event => setSettings(current => ({ ...current, suggested_actions: current.suggested_actions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} className="rounded-row bg-fill-subtle px-4 py-3 text-[13px] outline-none" />)}</div></div>
            {error && <p className="mt-4 flex items-center gap-2 rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink"><CircleAlert className="h-4 w-4" />{error}</p>}{notice && <p className="mt-4 flex items-center gap-2 rounded-row bg-success-soft px-3 py-2 text-[12px] text-success-soft-ink"><Check className="h-4 w-4" />{notice}</p>}
            <button onClick={save} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[13px] font-medium text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? t('Saving…') : t('Save concierge')}</button>
        </section>
        <ConversationInbox profileId={profileId} messages={messages} />
    </>
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
    return <label className="block"><span className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{label}</span>{multiline ? <textarea value={value} maxLength={multiline ? 4000 : 500} rows={4} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-row bg-fill-subtle px-4 py-3 text-[13px] leading-relaxed outline-none" /> : <input value={value} maxLength={500} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[13px] outline-none" />}</label>
}
