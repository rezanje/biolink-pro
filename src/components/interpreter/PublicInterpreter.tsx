'use client'

import { useState } from 'react'
import { Languages, Mic, X } from 'lucide-react'
import InterpreterPanel from './InterpreterPanel'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function PublicInterpreter({ profileSlug, displayName }: { profileSlug: string; displayName?: string | null }) {
    const { t } = useUiLanguage()
    const [open, setOpen] = useState(false)
    const name = displayName || t('this card owner')

    return <>
        <section className="mb-6 rounded-card border border-ink/10 bg-surface p-4 shadow-row">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill-subtle text-ink"><Languages className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="text-[14px] font-semibold">{t('Live Translate')}</p><p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{t('Speak across languages with {name}.', { name })}</p></div>
            </div>
            <button onClick={() => setOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-[12px] font-medium text-white"><Mic className="h-4 w-4" />{t('Start a conversation')}</button>
        </section>
        {open && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/35 p-4" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
            <section role="dialog" aria-modal="true" aria-label={t('Live Translate')} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-5 shadow-2xl">
                <header className="flex items-start justify-between gap-3"><div><p className="text-[18px] font-semibold">{t('Live Translate')}</p><p className="mt-1 text-[12px] text-ink-2">{t('Speak one sentence, then pass the phone.')}</p></div><button onClick={() => setOpen(false)} aria-label={t('Close Live Translate')} className="rounded-full p-2 text-ink-2 hover:bg-fill-subtle"><X className="h-5 w-5" /></button></header>
                <div className="mt-5"><InterpreterPanel profileSlug={profileSlug} /></div>
            </section>
        </div>}
    </>
}
