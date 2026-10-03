'use client'

import Link from 'next/link'
import { ArrowLeft, Loader2, LockKeyhole } from 'lucide-react'
import { useTier } from '@/app/dashboard/tier-context'
import InterpreterPanel from '@/components/interpreter/InterpreterPanel'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function InterpreterPage() {
    const { hasFeature, isLoading } = useTier()
    const { t } = useUiLanguage()

    if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
    if (!hasFeature('ai_bot')) return <div className="mx-auto max-w-md px-5 pb-[150px] pt-6"><Link href="/dashboard" className="inline-flex items-center gap-2 text-[12px] text-ink-2"><ArrowLeft className="h-4 w-4" />{t('Back to dashboard')}</Link><section className="mt-5 rounded-card bg-surface p-5 text-center shadow-card"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-fill-subtle"><LockKeyhole className="h-5 w-5 text-ink-2" /></span><h1 className="mt-4 text-[20px] font-semibold">{t('Live Interpreter')}</h1><p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t('Available on Premium and B2B plans.')}</p></section></div>

    return <div className="mx-auto max-w-md px-5 pb-[150px] pt-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[12px] text-ink-2"><ArrowLeft className="h-4 w-4" />{t('Back to dashboard')}</Link>
        <header className="mt-5"><h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t('Live Interpreter')}</h1><p className="mt-1.5 text-[13px] text-ink-2">{t('Speak one sentence, then pass the phone.')}</p></header>
        <Link href="/dashboard/ai-assistant" className="mt-4 inline-flex text-[12px] font-medium text-ink-2 underline underline-offset-4">{t('Manage AI & Translate')}</Link>
        <section className="mt-5 rounded-card bg-surface p-5 shadow-card"><InterpreterPanel /></section>
    </div>
}
