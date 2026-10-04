'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SavedCardCollection from '@/components/dashboard/SavedCardCollection'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function SavedCardsPage() {
    const { t } = useUiLanguage()
    return <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">
        <Link href="/dashboard/analytics" className="mb-6 inline-flex items-center gap-2 text-[12px] text-ink-2"><ArrowLeft className="h-4 w-4" />{t('Database Leads')}</Link>
        <SavedCardCollection />
    </div>
}
