'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Check, Loader2, RefreshCw } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'
import { DEFAULT_PREFERENCES } from '@/lib/meetings/policy.mjs'

type Preferences = { enabled: boolean; timezone: string; duration: number; weekdays: number[]; start: string; end: string }
type Connection = { configured: boolean; connected: boolean; email?: string; preferences: Preferences }
type Meeting = { id: string; visitor_name: string; visitor_email: string; note: string; start_at: string; end_at: string; timezone: string; status: string; calendar_event_url?: string; approval_calendar_email?: string }
const fieldClass = 'mt-1.5 w-full min-w-0 rounded-row bg-fill-subtle px-3 py-3 text-[13px] outline-none'

export default function MeetingManager({ eligible }: { eligible: boolean }) {
    const { t, locale } = useUiLanguage()
    const [connection, setConnection] = useState<Connection | null>(null)
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
    const [requests, setRequests] = useState<Meeting[]>([])
    const [loading, setLoading] = useState(eligible)
    const [saving, setSaving] = useState(false)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [hasMore, setHasMore] = useState(false)
    const loadRequests = useCallback(async (offset = 0) => {
        const response = await fetch(`/api/meetings/requests?offset=${offset}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setRequests(current => offset ? [...current, ...data.requests] : data.requests); setHasMore(data.hasMore)
    }, [])
    useEffect(() => {
        if (!eligible) return
        let active = true
        void fetch('/api/calendar').then(async response => {
            const data = await response.json()
            if (!active) return
            if (!response.ok) throw new Error(data.error)
            setConnection(data); setPreferences(data.preferences)
            if (data.configured) await loadRequests()
            const result = new URLSearchParams(window.location.search).get('calendar')
            if (result === 'connected') setNotice('Google Calendar connected. Set your hours and turn on meeting requests.')
            if (result === 'failed') setError('Google connection was not completed. Try again and allow calendar access.')
            if (result === 'unavailable') setError('Calendar booking setup is not ready.')
        }).catch(cause => { if (active) setError(cause.message) }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [eligible, loadRequests])
    const save = async () => {
        setSaving(true); setError(''); setNotice('')
        try {
            const response = await fetch('/api/calendar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) })
            const data = await response.json(); if (!response.ok) throw new Error(data.error)
            setPreferences(data.preferences); setNotice('Meeting settings saved.')
        } catch (cause) { setError((cause as Error).message) } finally { setSaving(false) }
    }
    const disconnect = async () => {
        setSaving(true); setError(''); setNotice('')
        try {
            const response = await fetch('/api/calendar', { method: 'DELETE' }); const data = await response.json()
            if (!response.ok) throw new Error(data.error)
            setConnection(current => current && { ...current, connected: false, email: undefined })
            setPreferences(current => ({ ...current, enabled: false })); setNotice('Google Calendar disconnected.')
        } catch (cause) { setError((cause as Error).message) } finally { setSaving(false) }
    }
    const handleRequest = async (meeting: Meeting, action: 'approve' | 'reject') => {
        setBusy(meeting.id); setError(''); setNotice('')
        try {
            const response = await fetch('/api/meetings/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: meeting.id, action }) })
            const data = await response.json(); if (!response.ok) throw new Error(data.error)
            setNotice(action === 'approve' ? 'Meeting accepted. Google Calendar invitations have been sent.' : 'Meeting request declined.')
            await loadRequests()
        } catch (cause) {
            setError((cause as Error).message)
            await loadRequests().catch(() => {})
        } finally { setBusy('') }
    }
    if (!eligible) return null
    return <section id="meeting-settings" className="mt-5 min-w-0 rounded-card bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="flex items-center gap-2 text-[17px] font-semibold"><CalendarDays className="h-5 w-5 shrink-0" />{t('Meeting requests')}</h2><p className="mt-1 text-[12.5px] text-ink-2">{t('Visitors request a time. You approve before anything is added to Google Calendar.')}</p></div><button type="button" role="switch" aria-label={t('Show meeting requests on public card')} aria-checked={preferences.enabled} disabled={!connection?.connected || saving} onClick={() => setPreferences(current => ({ ...current, enabled: !current.enabled }))} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full disabled:opacity-40 ${preferences.enabled ? 'bg-ink' : 'bg-track'}`}><span className={`h-6 w-6 rounded-full bg-white shadow-row ${preferences.enabled ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
        {loading ? <p className="mt-4 flex items-center gap-2 text-[12px]"><Loader2 className="h-4 w-4 animate-spin" />{t('Loading…')}</p> : <>
            <ol className="mt-4 space-y-2 rounded-row bg-fill-subtle p-4 text-[12px] text-ink-2"><li>{t('1. Connect your Google account and allow calendar access.')}</li><li>{t('2. Set your available days and hours, then enable meeting requests.')}</li><li>{t('3. Accept or decline requests below. Only accepted meetings get calendar invitations.')}</li></ol>
            {connection?.configured ? <div className="mt-4 rounded-row border border-ink/10 p-4">
                {connection.connected && <p className="mb-3 flex min-w-0 items-start gap-2 break-all text-[12px]"><Check className="h-4 w-4 shrink-0" />{connection.email}</p>}
                <button type="button" onClick={() => window.location.assign('/api/calendar/connect')} className="inline-flex rounded-full bg-ink px-5 py-2.5 text-[12px] font-medium text-white">{connection.connected ? t('Reconnect Google Calendar') : t('Connect Google Calendar')}</button>
                {connection.connected && <button type="button" disabled={saving || Boolean(busy)} onClick={disconnect} className="ml-3 mt-2 text-[12px] underline disabled:opacity-50">{t('Disconnect')}</button>}
            </div> : <p className="mt-4 rounded-row bg-fill-subtle p-4 text-[12px] text-ink-2">{t('Calendar booking is not available yet. You can still use a booking link above.')}</p>}
            {connection?.configured && <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-[12px]">{t('Meeting timezone')}<input className={fieldClass} value={preferences.timezone} placeholder="Asia/Jakarta" maxLength={100} onChange={event => setPreferences(current => ({ ...current, timezone: event.target.value }))} list="meeting-timezones" /><datalist id="meeting-timezones">{['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Hong_Kong', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'].map(zone => <option key={zone} value={zone} />)}</datalist></label>
                <label className="text-[12px]">{t('Meeting duration')}<select value={preferences.duration} onChange={event => setPreferences(current => ({ ...current, duration: Number(event.target.value) }))} className={fieldClass}>{[15, 30, 60].map(duration => <option key={duration} value={duration}>{t('{minutes} minutes', { minutes: duration })}</option>)}</select></label>
                <label className="min-w-0 text-[12px]">{t('Available from')}<input type="time" step={900} value={preferences.start} onChange={event => setPreferences(current => ({ ...current, start: event.target.value }))} className={fieldClass} /></label>
                <label className="min-w-0 text-[12px]">{t('Available until')}<input type="time" step={900} value={preferences.end} onChange={event => setPreferences(current => ({ ...current, end: event.target.value }))} className={fieldClass} /></label>
                <fieldset className="min-w-0 sm:col-span-2"><legend className="text-[12px]">{t('Available days')}</legend><div className="mt-2 flex flex-wrap gap-2">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <label key={day} className="flex items-center gap-2 rounded-row bg-fill-subtle px-3 py-2 text-[12px]"><input type="checkbox" checked={preferences.weekdays.includes(index + 1)} onChange={event => setPreferences(current => ({ ...current, weekdays: event.target.checked ? [...current.weekdays, index + 1] : current.weekdays.filter(value => value !== index + 1) }))} />{t(day)}</label>)}</div></fieldset>
                <p className="text-[11px] text-ink-3 sm:col-span-2">{t('Visitors can request up to 14 days ahead, with at least 2 hours notice. Busy calendar times are hidden.')}</p>
                <button type="button" disabled={saving} onClick={save} className="rounded-full bg-ink px-4 py-3 text-[13px] font-medium text-white disabled:opacity-50 sm:col-span-2">{saving ? t('Saving…') : t('Save meeting settings')}</button>
            </div>}
            {connection?.configured && <div className="mt-6"><div className="flex items-center justify-between gap-2"><h3 className="text-[15px] font-semibold">{t('Booking requests')}</h3><button type="button" disabled={Boolean(busy)} aria-label={t('Refresh meeting requests')} onClick={() => { setBusy('refresh'); void loadRequests().catch(cause => setError(cause.message)).finally(() => setBusy('')) }} className="rounded-full bg-fill-subtle p-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /></button></div>
                {!requests.length && <p className="mt-3 text-[12px] text-ink-2">{t('No meeting requests yet.')}</p>}
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3">{requests.map(meeting => <article key={meeting.id} className="min-w-0 rounded-row bg-fill-subtle p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-[13px] font-medium">{meeting.visitor_name}</p><a href={`mailto:${meeting.visitor_email}`} className="break-all text-[11px] text-ink-2 underline">{meeting.visitor_email}</a></div><span className="shrink-0 rounded-full bg-surface px-2 py-1 text-[10px]">{t(({ pending: 'Pending approval', approving: 'Processing', approved: 'Accepted', rejected: 'Declined' } as Record<string, string>)[meeting.status] || meeting.status)}</span></div><p className="mt-2 text-[12px]">{new Date(meeting.start_at).toLocaleString(locale, { timeZone: meeting.timezone, dateStyle: 'medium', timeStyle: 'short' })} · {meeting.timezone}</p>{meeting.note && <p className="mt-2 whitespace-pre-wrap break-words text-[12px] text-ink-2">{meeting.note}</p>}
                    {['pending', 'approving'].includes(meeting.status) && <div className="mt-3 flex gap-2"><button type="button" disabled={Boolean(busy) || !connection.connected || (meeting.status === 'pending' && Date.parse(meeting.start_at) <= Date.now())} onClick={() => void handleRequest(meeting, 'approve')} aria-label={t('Accept request from {name}', { name: meeting.visitor_name })} className="flex-1 rounded-full bg-ink px-3 py-2.5 text-[12px] text-white disabled:opacity-40">{busy === meeting.id ? t('Processing') : meeting.status === 'approving' ? t('Retry approval') : t('Accept')}</button><button type="button" disabled={Boolean(busy) || meeting.status !== 'pending'} onClick={() => void handleRequest(meeting, 'reject')} aria-label={t('Decline request from {name}', { name: meeting.visitor_name })} className="flex-1 rounded-full border border-ink/15 px-3 py-2.5 text-[12px] disabled:opacity-40">{t('Decline')}</button></div>}
                    {meeting.status === 'approving' && meeting.approval_calendar_email && <p className="mt-2 break-all text-[11px] text-ink-2">{t('Approval calendar: {email}', { email: meeting.approval_calendar_email })}</p>}
                    {meeting.status === 'approving' && <p className="mt-2 text-[11px] text-ink-2">{t('Confirmation is pending. If processing was interrupted, retry after 5 minutes. An existing invitation will be reused.')}</p>}
                    {meeting.status === 'approved' && meeting.calendar_event_url?.startsWith('https://www.google.com/calendar/') && <a href={meeting.calendar_event_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12px] underline">{t('Open in Google Calendar')}</a>}
                </article>)}</div>
                {hasMore && <button type="button" disabled={Boolean(busy)} onClick={() => { setBusy('older'); void loadRequests(requests.length).catch(cause => setError(cause.message)).finally(() => setBusy('')) }} className="mt-3 w-full rounded-full bg-fill-subtle px-4 py-2 text-[12px]">{t('Load earlier requests')}</button>}
            </div>}
        </>}
        {error && <p role="alert" className="mt-4 rounded-row bg-coral-soft p-3 text-[12px] text-coral-soft-ink">{t(error)}</p>}
        {notice && <p role="status" className="mt-4 rounded-row bg-success-soft p-3 text-[12px] text-success-soft-ink">{t(notice)}</p>}
    </section>
}
