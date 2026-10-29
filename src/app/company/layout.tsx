'use client'

import { CompanyProvider, useCompany } from './company-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import CompanyShell from '@/components/company/CompanyShell'
import { companyBrand } from '@/lib/company-brand.mjs'

function CompanyGuard({ children }: { children: React.ReactNode }) {
    const { company, isLoading } = useCompany()
    const router = useRouter()
    useEffect(() => { if (!isLoading && !company) router.replace('/dashboard') }, [isLoading, company, router])
    if (isLoading) return <div className="min-h-screen grid place-items-center bg-[#f4f5f0] text-[#24332a]">Memuat dashboard perusahaan…</div>
    if (!company) return null
    const brand = companyBrand(company)
    return <div style={{ '--company-primary': brand.primary, '--company-accent': brand.accent } as React.CSSProperties}>
        <CompanyShell>{children}</CompanyShell>
    </div>
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
    return <CompanyProvider><CompanyGuard>{children}</CompanyGuard></CompanyProvider>
}
