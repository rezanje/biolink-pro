'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export interface CompanyPerson {
    id: string
    display_name: string | null
    email: string | null
    job_title: string | null
    slug: string | null
    avatar_url: string | null
    role: string | null
    updated_at: string | null
}

export interface CompanyLead {
    id: string
    profile_id: string
    created_at: string
    name: string | null
    email: string | null
    whatsapp: string | null
    company: string | null
    job_title: string | null
    status: string | null
}

export interface PersonStats {
    id: string
    devices: number
    taps: number
    views30: number
    clicks30: number
    leads: number
    leadsNew: number
    leadsConverted: number
    lastTap: string | null
    lastLead: string | null
}

export interface CompanyWorkspace {
    company: { id: string; name: string; logo_url: string | null; website: string | null; card_template: string | null }
    viewerRole: string
    people: CompanyPerson[]
    summary: {
        counts: { people: number; devices: number; taps: number; views30: number; leads: number; leads30: number; conversion: number; unclaimed: number }
        status: Record<string, number>
        weeks: { start: string; count: number }[]
        perPerson: PersonStats[]
        topPeople: PersonStats[]
    }
    leads: CompanyLead[]
    leadsTruncated: boolean
}

interface CompanyContextType {
    data: CompanyWorkspace | null
    isLoading: boolean
    error: string | null
    companyParam: string | null
    reload: () => Promise<void>
    updateLeadStatus: (leadId: string, status: string) => Promise<boolean>
}

const CompanyContext = createContext<CompanyContextType>({
    data: null, isLoading: true, error: null, companyParam: null,
    reload: async () => {}, updateLeadStatus: async () => false,
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const companyParam = useSearchParams().get('company')
    const [data, setData] = useState<CompanyWorkspace | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const query = companyParam ? `?company=${encodeURIComponent(companyParam)}` : ''

    const reload = useCallback(async () => {
        setError(null)
        try {
            const res = await fetch(`/api/company/workspace${query}`, { cache: 'no-store' })
            const body = await res.json()
            if (!res.ok) {
                setData(null)
                setError(res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : body.error || 'Gagal memuat')
                return
            }
            setData(body)
        } catch {
            setError('Gagal memuat dashboard perusahaan')
        } finally {
            setIsLoading(false)
        }
    }, [query])

    useEffect(() => { void reload() }, [reload])

    const updateLeadStatus = async (leadId: string, status: string) => {
        const res = await fetch(`/api/company/workspace${query}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, status }),
        })
        if (!res.ok) return false
        setData(prev => prev ? { ...prev, leads: prev.leads.map(l => l.id === leadId ? { ...l, status } : l) } : prev)
        return true
    }

    return (
        <CompanyContext.Provider value={{ data, isLoading, error, companyParam, reload, updateLeadStatus }}>
            {children}
        </CompanyContext.Provider>
    )
}

export const useCompany = () => useContext(CompanyContext)
