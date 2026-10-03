'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export type BookingInfo = { enabled: boolean; timezone: string; duration: number; today: string }
type Slot = { start: string; end: string }
export default function MeetingRequestDialog({ slug, info, onClose }: { slug: string; info: BookingInfo; onClose: () => void }) {
    const { t, locale } = useUiLanguage()
    const dialog = useRef<HTMLDialogElement>(null)
    const [date, setDate] = useState(info.today)
    const [slots, setSlots] = useState<Slot[]>([])
    const [selected, setSelected] = useState('')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [retry, setRetry] = useState(0)
    const [requestId, setRequestId] = useState(() => crypto.randomUUID())
    const lastDate = new Date(`${info.today}T12:00:00Z`); lastDate.setUTCDate(lastDate.getUTCDate() + 14)
    useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
    useEffect(() => {
        const controller = new AbortController()
        void fetch(`/api/meetings?${new URLSearchParams({ slug, date })}`, { signal: controller.signal }).then(async response => {
            const data = await response.json(); if (!response.ok) throw new Error(data.error)
            setSlots(data.slots)
        }).catch(cause => { if (!controller.signal.aborted) setError(cause.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [slug, date, retry])
    const submit = async () => {
        setSending(true); setError('')
        try {
            const response = await fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, start: selected, name, email, note, requestId }) })
            const data = await response.json(); if (!response.ok) throw new Error(data.error)
            setSubmitted(true)
        } catch (cause) { setError((cause as Error).message) } finally { setSending(false) }
    }
    return <dialog ref={dialog} aria-label={t('Book a meeting')} onCancel={event => { if (sending) event.preventDefault(); else onClose() }} className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-card bg-surface p-0 text-ink shadow-card backdrop:bg-black/40">
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 p-5"><div><h2 className="text-[17px] font-semibold">{t('Book a meeting')}</h2><p className="mt-1 text-[12px] text-ink-2">{t('Your request needs approval before a calendar invitation is sent.')}</p></div><button type="button" disabled={sending} onClick={onClose} aria-label={t('Close meeting request')} className="shrink-0 rounded-full bg-fill-subtle p-2 disabled:opacity-40"><X className="h-5 w-5" /></button></header>
        <div className="max-h-[72dvh] overflow-y-auto overscroll-contain p-5">
            {submitted ? <div role="status" className="py-6 text-center"><Check className="mx-auto h-8 w-8" /><h3 className="mt-3 font-semibold">{t('Request sent — awaiting approval')}</h3><p className="mt-2 text-[13px] text-ink-2">{t('The owner will review your request. A Google Calendar invitation will arrive by email only if accepted.')}</p><button type="button" onClick={onClose} className="mt-5 rounded-full bg-ink px-6 py-3 text-[13px] text-white">{t('Done')}</button></div> : <form onSubmit={event => { event.preventDefault(); void submit() }} className="space-y-4">
                <p className="text-[12px] text-ink-2">{t('{minutes} minutes', { minutes: info.duration })} · {info.timezone}</p>
                <label className="block text-[12px]">{t('Meeting date')}<input type="date" required min={info.today} max={lastDate.toISOString().slice(0, 10)} value={date} disabled={sending} onChange={event => { if (!event.target.value) return; setDate(event.target.value); setSelected(''); setSlots([]); setLoading(true); setError(''); setRequestId(crypto.randomUUID()) }} className="mt-1.5 block w-full min-w-0 rounded-row bg-fill-subtle px-3 py-3 text-[13px]" /></label>
                {loading ? <p role="status" className="flex items-center gap-2 text-[12px]"><Loader2 className="h-4 w-4 animate-spin" />{t('Checking available times…')}</p> : slots.length ? <fieldset><legend className="text-[12px]">{t('Available times')}</legend><div className="mt-2 grid grid-cols-3 gap-2">{slots.map(slot => <label key={slot.start} className={`flex cursor-pointer items-center justify-center gap-1 rounded-row border px-2 py-3 text-[12px] ${selected === slot.start ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-fill-subtle'}`}><input type="radio" name="time" required value={slot.start} checked={selected === slot.start} disabled={sending} onChange={() => { setSelected(slot.start); setRequestId(crypto.randomUUID()) }} className="sr-only" />{new Date(slot.start).toLocaleTimeString(locale, { timeZone: info.timezone, hour: '2-digit', minute: '2-digit' })}</label>)}</div></fieldset> : !error && <p className="rounded-row bg-fill-subtle p-3 text-[12px] text-ink-2">{t('No available times on this day. Choose another date.')}</p>}
                <label className="block text-[12px]">{t('Your name')}<input autoComplete="name" required minLength={2} maxLength={100} value={name} disabled={sending} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-row bg-fill-subtle px-3 py-3 text-[13px]" /></label>
                <label className="block text-[12px]">{t('Email for calendar invitation')}<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sending} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-row bg-fill-subtle px-3 py-3 text-[13px]" /></label>
                <label className="block text-[12px]">{t('Meeting note, optional')}<textarea rows={3} maxLength={1000} value={note} disabled={sending} onChange={event => setNote(event.target.value)} className="mt-1.5 w-full resize-y rounded-row bg-fill-subtle px-3 py-3 text-[13px]" /></label>
                {error && <div role="alert" className="rounded-row bg-coral-soft p-3 text-[12px] text-coral-soft-ink"><p>{t(error)}</p><button type="button" disabled={sending} onClick={() => { setSelected(''); setSlots([]); setLoading(true); setError(''); setRetry(value => value + 1) }} className="mt-2 underline">{t('Refresh available times')}</button></div>}
                <button disabled={!selected || loading || sending} className="w-full rounded-full bg-ink px-4 py-3 text-[13px] font-medium text-white disabled:opacity-40">{sending ? t('Sending request…') : t('Request meeting')}</button>
            </form>}
        </div>
    </dialog>
}
