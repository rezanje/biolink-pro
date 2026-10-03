'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, FileText, Loader2, MessageSquareText, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { conversationPreviews, orderedConversationMessages } from '@/lib/conversations.mjs'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export type InboxMessage = { id: string; visitor_id: string; visitor_name: string | null; intent: string | null; role: 'visitor' | 'assistant'; content: string; created_at: string }
const PAGE_SIZE = 100

export default function ConversationInbox({ profileId, messages }: { profileId: string; messages: InboxMessage[] }) {
    const { t, locale } = useUiLanguage()
    const conversations = useMemo(() => conversationPreviews(messages) as [string, InboxMessage[]][], [messages])
    const [selected, setSelected] = useState<InboxMessage | null>(null)
    return <section className="mt-3 min-w-0 rounded-card bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 shrink-0" /><div><h2 className="text-[16px] font-semibold">{t('Visitor conversations')}</h2><p className="mt-0.5 text-[12px] text-ink-2">{t('Recent questions help you learn what visitors need.')}</p></div></div>
        {conversations.length ? <div className="mt-4 grid min-w-0 grid-cols-1 gap-2">{conversations.map(([visitor, thread]) => {
            const first = thread[0]; const latest = thread[thread.length - 1]; const name = first.visitor_name || t('Anonymous visitor')
            return <button key={visitor} type="button" onClick={() => setSelected(first)} aria-label={t('Open conversation with {name}', { name })} className="min-w-0 rounded-row bg-fill-subtle p-3 text-left focus-visible:outline-2 focus-visible:outline-ink">
                <div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-[13px] font-medium">{name}</p><span className="shrink-0 text-[11px] text-ink-3">{new Date(latest.created_at).toLocaleDateString(locale)}</span></div>
                {first.intent && <p className="mt-1 text-[11px] text-ink-2">{t('Interest: {intent}', { intent: first.intent })}</p>}
                <p className="mt-2 line-clamp-2 break-words text-[12px] text-ink">{latest.content}</p><span className="mt-2 flex items-center gap-1 text-[11px] font-medium">{t('View conversation')}<ChevronRight className="h-3 w-3" /></span>
            </button>
        })}</div> : <div className="mt-4 rounded-row bg-fill-subtle px-4 py-8 text-center"><FileText className="mx-auto h-5 w-5 text-ink-3" /><p className="mt-2 text-[12px] text-ink-2">{t('Conversations will appear after visitors use the concierge.')}</p></div>}
        {selected && <ConversationHistory key={selected.visitor_id} profileId={profileId} visitor={selected} onClose={() => setSelected(null)} />}
    </section>
}

function ConversationHistory({ profileId, visitor, onClose }: { profileId: string; visitor: InboxMessage; onClose: () => void }) {
    const { t, locale } = useUiLanguage()
    const supabase = createClient()
    const dialog = useRef<HTMLDialogElement>(null)
    const [messages, setMessages] = useState<InboxMessage[]>([])
    const [page, setPage] = useState(0)
    const [retry, setRetry] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
    useEffect(() => {
        let active = true
        void supabase.from('ai_concierge_messages').select('*').eq('profile_id', profileId).eq('visitor_id', visitor.visitor_id)
            .order('created_at', { ascending: false }).order('role', { ascending: true }).order('id', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).then(({ data, error: queryError }) => {
                if (!active) return
                setLoading(false); setError(Boolean(queryError))
                if (!queryError) {
                    const incoming = (data || []) as InboxMessage[]
                    setMessages(current => orderedConversationMessages([...new Map([...current, ...incoming].map(message => [message.id, message])).values()]) as InboxMessage[])
                    setHasMore(incoming.length === PAGE_SIZE)
                }
            })
        return () => { active = false }
    }, [profileId, visitor.visitor_id, page, retry, supabase])
    return <dialog ref={dialog} aria-label={t('Conversation history')} onCancel={onClose} className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-card bg-surface p-0 text-ink shadow-card backdrop:bg-black/40">
        <header className="flex items-start justify-between gap-3 border-b border-line p-5"><div className="min-w-0"><h2 className="text-[17px] font-semibold">{t('Conversation history')}</h2><p className="mt-1 break-words text-[13px] text-ink-2">{visitor.visitor_name || t('Anonymous visitor')}</p>{visitor.intent && <p className="mt-1 text-[11px] text-ink-3">{t('Interest: {intent}', { intent: visitor.intent })}</p>}</div><button type="button" onClick={onClose} aria-label={t('Close conversation')} className="rounded-full bg-fill-subtle p-2"><X className="h-5 w-5" /></button></header>
        <div className="max-h-[65dvh] space-y-3 overflow-y-auto overscroll-contain p-4">
            {hasMore && !error && <button disabled={loading} type="button" onClick={() => { setLoading(true); setPage(current => current + 1) }} className="w-full rounded-full bg-fill-subtle px-4 py-2 text-[12px] disabled:opacity-50">{t('Load earlier messages')}</button>}
            {loading && <p role="status" className="flex justify-center p-3"><Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">{t('Loading…')}</span></p>}
            {error && <div role="alert" className="rounded-row bg-coral-soft p-3 text-[12px]"><p>{t('Could not load conversation. Please try again.')}</p><button type="button" onClick={() => { setLoading(true); setError(false); setRetry(value => value + 1) }} className="mt-2 underline">{t('Retry')}</button></div>}
            <ol className="space-y-3">{messages.map(message => <li key={message.id} className={`rounded-row p-3 ${message.role === 'visitor' ? 'ml-5 bg-fill-subtle' : 'mr-5 border border-line'}`}><div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-ink-3"><span>{message.role === 'visitor' ? t('Visitor') : t('AI Concierge')}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</time></div><p data-message-content className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{message.content}</p></li>)}</ol>
            {!loading && !error && !messages.length && <p className="py-6 text-center text-[12px] text-ink-2">{t('No messages in this conversation.')}</p>}
        </div>
    </dialog>
}
