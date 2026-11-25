'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Loader2, ShieldAlert } from 'lucide-react'
import { CompanyProvider, useCompany } from './company-context'
import CompanyShell from '@/components/company/CompanyShell'

function CompanyGuard({ children }: { children: React.ReactNode }) {
    const { data, isLoading, error } = useCompany()

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas font-kabut text-ink">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-ink-3" />
                    <p className="text-[13px] text-ink-2">Memuat dashboard perusahaan...</p>
                </div>
            </div>
        )
    }

    if (!data) {
        const signedOut = error === 'unauthorized'
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-5 font-kabut text-ink">
                <div className="w-full max-w-sm rounded-card bg-surface p-8 text-center shadow-card">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink">
                        <ShieldAlert className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.03em]">
                        {signedOut ? 'Masuk dulu' : 'Khusus admin perusahaan'}
                    </h1>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                        {signedOut
                            ? 'Masuk pakai akun admin perusahaan untuk membuka dashboard ini.'
                            : error === 'forbidden'
                                ? 'Akun ini bukan admin perusahaan. Minta tim Gentanala menjadikan akunmu admin perusahaan.'
                                : error}
                    </p>
                    <Link href={signedOut ? '/login?next=/company/dashboard' : '/dashboard'} className="mt-7 flex w-full items-center justify-center rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink">
                        {signedOut ? 'Masuk' : 'Kembali ke dashboard'}
                    </Link>
                </div>
            </div>
        )
    }

    return <CompanyShell>{children}</CompanyShell>
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense>
            <CompanyProvider>
                <CompanyGuard>{children}</CompanyGuard>
            </CompanyProvider>
        </Suspense>
    )
}
