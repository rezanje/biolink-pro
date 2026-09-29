'use client'

import { TierProvider } from './tier-context'
import DashboardShell from '@/components/dashboard/DashboardShell'
import PWAHandler from '@/components/pwa/PWAHandler'
import { UiLanguageProvider } from '@/components/UiLanguageProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <UiLanguageProvider mode="owner"><TierProvider>
            <DashboardShell>
                {children}
            </DashboardShell>
            <PWAHandler />
        </TierProvider></UiLanguageProvider>
    )
}
