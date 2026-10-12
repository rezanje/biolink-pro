'use client'

import Link from 'next/link'
import { ArrowUpRight, Languages } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function TranslateManager({ eligible }: { eligible: boolean }) {
    const { t } = useUiLanguage()
    if (!eligible) return null

    return <Link href="/dashboard/interpreter" className="mt-3 flex items-center gap-3 rounded-card-sm bg-surface p-4 text-[13px] font-medium shadow-row">
        <Languages className="h-5 w-5 text-ink-2" />
        <span className="flex-1">{t('Open Live Interpreter')}</span>
        <ArrowUpRight className="h-4 w-4 text-ink-3" />
    </Link>
}
