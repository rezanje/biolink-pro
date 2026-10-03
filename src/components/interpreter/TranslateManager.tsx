'use client'

import Link from 'next/link'
import { ArrowUpRight, Languages, LockKeyhole } from 'lucide-react'
import PublicTranslateSettings from './PublicTranslateSettings'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function TranslateManager({ eligible }: { eligible: boolean }) {
    const { t } = useUiLanguage()
    if (!eligible) return <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-ink-2" /><h2 className="text-[17px] font-semibold">{t('Live Translate')}</h2></div>
        <p className="mt-2 text-[12.5px] text-ink-2">{t('Available on Premium and B2B plans.')}</p>
    </section>

    return <>
        <PublicTranslateSettings />
        <Link href="/dashboard/interpreter" className="mt-3 flex items-center gap-3 rounded-card-sm bg-surface p-4 text-[13px] font-medium shadow-row">
            <Languages className="h-5 w-5 text-ink-2" />
            <span className="flex-1">{t('Open Live Interpreter')}</span>
            <ArrowUpRight className="h-4 w-4 text-ink-3" />
        </Link>
    </>
}
