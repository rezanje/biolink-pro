'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface Company {
    id: string
    name: string
    logo_url: string | null
    website: string | null
    theme: { primary?: string; accent?: string } | null
}

interface CompanyContextType {
    company: Company | null
    isLoading: boolean
    isB2BAdmin: boolean
}

const CompanyContext = createContext<CompanyContextType>({ company: null, isLoading: true, isB2BAdmin: false })

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [company, setCompany] = useState<Company | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/company/workspace?view=context', { signal: controller.signal, cache: 'no-store' })
            .then(async response => response.ok ? (await response.json()).company as Company : null)
            .then(setCompany)
            .catch(() => setCompany(null))
            .finally(() => setIsLoading(false))
        return () => controller.abort()
    }, [])

    return <CompanyContext.Provider value={{ company, isLoading, isB2BAdmin: !!company }}>{children}</CompanyContext.Provider>
}

export const useCompany = () => useContext(CompanyContext)
