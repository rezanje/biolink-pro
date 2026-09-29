'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, BriefcaseBusiness, CalendarDays, MessageCircle, Send, Sparkles, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiLanguage } from '@/components/UiLanguageProvider'

type Settings = { persona: string; greeting: string; suggested_actions: string[]; booking_url: string }
type ChatMessage = { role: 'visitor' | 'assistant'; text: string }
const fallbackActions = ['Explore services', 'View portfolio', 'Ask about pricing', 'Book a meeting']
const questionFor = (action: string) => ({
    'Explore services': 'What services do you offer?',
    'View portfolio': 'Can you show me relevant work or portfolio?',
    'Ask about pricing': 'Could you share pricing guidance?',
    'Book a meeting': 'I would like to book a meeting.',
}[action] || `I am interested in ${action}.`)

export default function Concierge({ profile, onConnect }: { profile: { id: string; slug: string; display_name?: string | null }; onConnect: () => void }) {
    const { t } = useUiLanguage()
    const supabase = createClient()
    const [settings, setSettings] = useState<Settings | null>(null)
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [intent, setIntent] = useState('')
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState('')
    const visitorId = useMemo(() => {
        const key = `gentanala-concierge-${profile.id}`
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
        if (saved) return saved
        const next = crypto.randomUUID()
        if (typeof window !== 'undefined') window.localStorage.setItem(key, next)
        return next
    }, [profile.id])

    useEffect(() => {
        void supabase.from('ai_concierge_settings').select('persona,greeting,suggested_actions,booking_url')
            .eq('profile_id', profile.id).eq('enabled', true).maybeSingle()
            .then(({ data }) => {
                if (!data) return
                const actions = Array.isArray(data.suggested_actions)
                    ? data.suggested_actions.filter((item): item is string => typeof item === 'string').slice(0, 4)
                    : fallbackActions
                setSettings({ ...data, suggested_actions: actions })
            })
    }, [profile.id, supabase])

    const ask = async (question: string, selectedIntent = intent) => {
        const text = question.trim()
        if (!text || busy) return
        const next = [...messages, { role: 'visitor' as const, text }]
        setMessages(next); setInput(''); setBusy(true); setNotice('')
        try {
            const response = await fetch('/api/concierge/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: profile.slug, question: text, visitorId, visitorName: name, intent: selectedIntent, history: messages })
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || typeof data.reply !== 'string') throw new Error(data.error || t('Try again shortly.'))
            setMessages(current => [...current, { role: 'assistant', text: data.reply }])
        } catch (error) {
            setMessages(current => current.slice(0, -1)); setInput(text)
            setNotice((error as Error).message)
        } finally { setBusy(false) }
    }

    if (!settings) return null
    const actions = settings.suggested_actions.length ? settings.suggested_actions : fallbackActions
    const greeting = settings.greeting || t('Hi, I’m the concierge for {name}. What brings you here?', { name: profile.display_name || t('this card') })
    const bookingUrl = /^https:\/\//i.test(settings.booking_url) ? settings.booking_url : ''
    const selectIntent = (action: string) => { setIntent(action); setOpen(true); void ask(questionFor(action), action) }

    return <>
        <section className="mb-6 rounded-card border border-ink/10 bg-surface p-4 shadow-row">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill-subtle text-ink"><Sparkles className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="text-[14px] font-semibold">{t('Ask {name}', { name: profile.display_name || t('this card') })}</p><p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{greeting}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                {actions.map((action, index) => <button key={action} onClick={() => selectIntent(action)} className="flex min-h-12 items-center gap-2 rounded-row bg-fill-subtle px-3 py-2 text-left text-[12px] font-medium text-ink transition hover:bg-ink hover:text-white">
                    {index === 0 ? <BriefcaseBusiness className="h-4 w-4 shrink-0" /> : index === 3 ? <CalendarDays className="h-4 w-4 shrink-0" /> : <MessageCircle className="h-4 w-4 shrink-0" />}{t(action)}
                </button>)}
            </div>
            <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-ink-2 hover:text-ink"><Bot className="h-4 w-4" />{t('Ask something else')}</button>
        </section>
        {open && <div className="fixed inset-0 z-[110] flex items-end bg-ink/35 p-0 sm:items-center sm:justify-center sm:p-4" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
            <section role="dialog" aria-modal="true" aria-label={t('AI concierge')} className="flex h-[min(680px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface shadow-2xl sm:rounded-card">
                <header className="flex items-center justify-between border-b border-ink/10 p-4">
                    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle"><Bot className="h-5 w-5" /></span><div><p className="text-[14px] font-semibold">{settings.persona || 'AI Concierge'}</p><p className="text-[11px] text-ink-2">For {profile.display_name}</p></div></div>
                    <button onClick={() => setOpen(false)} aria-label={t('Close concierge')} className="rounded-full p-2 text-ink-2 hover:bg-fill-subtle"><X className="h-5 w-5" /></button>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {!messages.length && <><p className="max-w-[88%] rounded-2xl rounded-bl-sm bg-fill-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink">{greeting}</p><label className="block"><span className="text-[11px] text-ink-2">{t('Your name, optional')}</span><input value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder={t('How should we call you?')} className="mt-1.5 w-full rounded-row bg-fill-subtle px-3 py-2.5 text-[13px] outline-none" /></label></>}
                    {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed ${message.role === 'visitor' ? 'ml-auto rounded-br-sm bg-ink text-white' : 'rounded-bl-sm bg-fill-subtle text-ink'}`}>{message.text}</p>)}
                    {busy && <p className="text-[12px] text-ink-2">{t('Thinking…')}</p>}{notice && <p className="rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink">{notice}</p>}
                </div>
                <div className="border-t border-ink/10 p-3">
                    {bookingUrl && <a href={bookingUrl} target="_blank" rel="noreferrer" className="mb-2 flex items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-[12px] font-medium text-white"><CalendarDays className="h-4 w-4" />{t('Book a meeting')}</a>}
                    <button onClick={onConnect} className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 py-2.5 text-[12px] font-medium text-ink"><UserRound className="h-4 w-4" />{t('Share contact details')}</button>
                    <form onSubmit={event => { event.preventDefault(); void ask(input) }} className="flex gap-2"><input value={input} disabled={busy} maxLength={1000} onChange={event => setInput(event.target.value)} placeholder={t('Ask a question…')} className="min-w-0 flex-1 rounded-full bg-fill-subtle px-4 py-3 text-[13px] outline-none" /><button disabled={busy || !input.trim()} aria-label={t('Send question')} className="rounded-full bg-ink p-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></form>
                </div>
            </section>
        </div>}
    </>
}
