'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
    TrendingUp,
    Users,
    MousePointer2,
    Download,
    Loader2,
    Eye,
    MessageSquare,
    Phone,
    Mail,
    Clock,
    ArrowUpDown,
    ChevronRight,
    Building2,
    Briefcase,
    Linkedin,
    MessageCircle,
    Search,
    X,
    Bookmark,
    Trash2,
} from 'lucide-react'
import PremiumLock from '@/components/dashboard/PremiumLock'
import { whatsappLink } from '@/lib/wa.mjs'
import { useTier } from '@/app/dashboard/tier-context'
import { useUiLanguage } from '@/components/UiLanguageProvider'

// Warna label status — memakai token hangat yang sama dengan beranda.
const getStatusColor = (status: string) => {
    switch (status) {
        case 'contacted': return 'bg-coral-soft text-coral-soft-ink'
        case 'converted': return 'bg-success-soft text-success-soft-ink'
        case 'failed': return 'bg-coral-soft text-coral-soft-ink'
        default: return 'bg-fill-subtle text-ink-2'
    }
}

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'contacted': return 'Contacted'
        case 'converted': return 'Deal'
        case 'failed': return 'Failed'
        default: return 'New'
    }
}

const getExternalUrl = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return null

    try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`)
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
    } catch {
        return null
    }
}

type SavedCardPreview = { slug: string; display_name: string | null; company: string | null; job_title: string | null; avatar_url: string | null }
type SavedCard = { profile_id: string; created_at: string; profile: SavedCardPreview | null }
type SavedCardRow = Omit<SavedCard, 'profile'> & { profile: SavedCardPreview | SavedCardPreview[] | null }

export default function AnalyticsPage() {
    const { t, locale } = useUiLanguage()
    const dateLocale = locale === 'id' ? 'id-ID' : locale === 'zh-CN' ? 'zh-CN' : 'en-US'
    const supabase = createClient()
    const { hasFeature } = useTier()
    const isLocked = !hasFeature('analytics_leads')

    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalViews: 0,
        totalClicks: 0,
        totalLeads: 0,
        uniqueVisitors: 0
    })
    const [chartData, setChartData] = useState<any[]>([])
    const [recentLeads, setRecentLeads] = useState<any[]>([])
    const [dateRange, setDateRange] = useState('30d')
    const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false)
    const [leadCaptureDelay, setLeadCaptureDelay] = useState(4)
    const [savingDelay, setSavingDelay] = useState(false)

    // Kartu calon pelanggan yang sedang dibuka detailnya
    const [activeLead, setActiveLead] = useState<any | null>(null)

    // Filtering & Sorting State
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [leadSearch, setLeadSearch] = useState('')
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
    const [loadingLeads, setLoadingLeads] = useState(false)
    const [collectionTab, setCollectionTab] = useState<'contacts' | 'saved'>(() => typeof window !== 'undefined' && window.location.hash === '#saved' ? 'saved' : 'contacts')
    const [savedCards, setSavedCards] = useState<SavedCard[]>([])
    const [loadingSavedCards, setLoadingSavedCards] = useState(false)

    useEffect(() => {
        fetchAnalytics()
    }, [dateRange])

    useEffect(() => {
        fetchLeads()
    }, [statusFilter, dateFrom, dateTo, leadSearch, sortOrder])

    useEffect(() => {
        if (collectionTab === 'saved') void fetchSavedCards()
    }, [collectionTab])

    useEffect(() => {
        if (window.location.hash === '#saved') setCollectionTab('saved')
    }, [])

    const fetchLeads = async () => {
        try {
            setLoadingLeads(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get profile ID first (we need it for the query)
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (!profile) return

            let query = supabase
                .from('leads')
                .select('*')
                .eq('profile_id', profile.id)

            if (statusFilter !== 'all') query = query.eq('status', statusFilter)
            if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
            if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999`)

            const search = leadSearch.trim().replace(/[,%()]/g, ' ')
            if (search) {
                query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`)
            }

            // Apply Sorting
            query = query.order('created_at', { ascending: sortOrder === 'asc' })

            // Limit (increase limit for better UX with filtering)
            query = query.limit(50)

            const { data: leads, error } = await query

            if (error) {
                console.error('Error fetching leads:', error)
            } else {
                setRecentLeads(leads || [])
            }
        } catch (err) {
            console.error('Error in fetchLeads:', err)
        } finally {
            setLoadingLeads(false)
        }
    }

    const fetchSavedCards = async () => {
        try {
            setLoadingSavedCards(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data, error } = await supabase
                .from('saved_profiles')
                .select('profile_id,created_at,profile:profiles(slug,display_name,company,job_title,avatar_url)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
            if (error) { console.error('Error fetching saved cards:', error); return }
            const rows = (data || []) as unknown as SavedCardRow[]
            setSavedCards(rows.map(({ profile, ...card }) => ({ ...card, profile: Array.isArray(profile) ? profile[0] || null : profile })))
        } catch (err) {
            console.error('Error in fetchSavedCards:', err)
        } finally {
            setLoadingSavedCards(false)
        }
    }

    const removeSavedCard = async (profileId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('profile_id', profileId)
        if (!error) setSavedCards(current => current.filter(card => card.profile_id !== profileId))
    }

    const fetchAnalytics = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get profile and settings
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, lead_capture_enabled, lead_capture_delay')
                .eq('user_id', user.id)
                .single()

            if (!profile) return

            console.log('Fetching analytics for profile:', profile.id)

            setLeadCaptureEnabled(profile.lead_capture_enabled || false)
            setLeadCaptureDelay(profile.lead_capture_delay || 4)

            // 1. Fetch Stats (Direct Counts)
            // Calculate date range
            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(endDate.getDate() - parseInt(dateRange))

            const { count: viewsCount } = await supabase
                .from('analytics')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', profile.id)
                .eq('event_type', 'view')
                .gte('created_at', startDate.toISOString())

            const { count: clicksCount } = await supabase
                .from('analytics')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', profile.id)
                .eq('event_type', 'click')
                .gte('created_at', startDate.toISOString())

            const { count: leadsCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', profile.id)

            console.log('Stats fetched:', { views: viewsCount, clicks: clicksCount, leads: leadsCount })

            setStats({
                totalViews: viewsCount || 0,
                totalClicks: clicksCount || 0,
                totalLeads: leadsCount || 0,
                uniqueVisitors: 0
            })

            // 2. Fetch Chart Data (Daily Views/Clicks)
            // startDate/endDate already defined above

            const { data: dailyData } = await supabase
                .from('analytics')
                .select('created_at, event_type')
                .eq('profile_id', profile.id)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })

            // Process daily data
            const days = new Map()
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                days.set(dateStr, { date: dateStr, views: 0, clicks: 0 })
            }

            if (dailyData) {
                dailyData.forEach((item: any) => {
                    const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    if (days.has(date)) {
                        const dayStats = days.get(date)
                        if (item.event_type === 'view') dayStats.views++
                        if (item.event_type === 'click') dayStats.clicks++
                    }
                })
            }
            setChartData(Array.from(days.values()))

            // Note: fetchLeads is called by useEffect now

        } catch (err) {
            console.error('Error fetching analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleLeadCapture = async () => {
        try {
            const newValue = !leadCaptureEnabled
            setLeadCaptureEnabled(newValue)

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ lead_capture_enabled: newValue })
                    .eq('user_id', user.id)

                if (error) {
                    // Revert on error
                    setLeadCaptureEnabled(!newValue)
                    console.error('Error updating setting:', error)
                    console.error('Error details:', error.message, error.details, error.hint)
                    alert(t('Failed to update settings: {error}', { error: error.message }))
                }
            }
        } catch (err) {
            console.error('Error toggling lead capture:', err)
        }
    }

    const exportLeads = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .single()
        if (!profile) return

        let query = supabase
            .from('leads')
            .select('*')
            .eq('profile_id', profile.id)
        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
        if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999`)

        const search = leadSearch.trim().replace(/[,%()]/g, ' ')
        if (search) {
            query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`)
        }

        query = query.order('created_at', { ascending: sortOrder === 'asc' }).limit(10000)

        const { data: leads, error } = await query
        if (error) {
            console.error('Error exporting leads:', error)
            alert(t('Could not export contacts. Please try again.'))
            return
        }

        const escapeCsv = (value: unknown) => `"${String(value || '').replace(/"/g, '""')}"`
        const csvContent = [
            'Name,Job Title,Company,WhatsApp,Email,LinkedIn,WeChat ID,Status,Date',
            ...(leads || []).map(lead => [
                lead.name,
                lead.job_title,
                lead.company,
                lead.whatsapp,
                lead.email,
                lead.linkedin,
                lead.wechat_id,
                getStatusLabel(lead.status),
                new Date(lead.created_at).toLocaleDateString(),
            ].map(escapeCsv).join(',')),
        ].join('\n')

        const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `contacts_${dateFrom || 'all'}_to_${dateTo || 'all'}_${statusFilter}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    const updateLeadStatus = async (leadId: string, newStatus: string) => {
        try {
            // Optimistic update
            setRecentLeads(prev => prev.map(lead =>
                lead.id === leadId ? { ...lead, status: newStatus } : lead
            ))
            setActiveLead((prev: any) => (prev && prev.id === leadId ? { ...prev, status: newStatus } : prev))

            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus })
                .eq('id', leadId)

            if (error) {
                console.error('Error updating status:', error)
                // Revert
                fetchAnalytics()
                alert(t('Failed to update status'))
            }
        } catch (err) {
            console.error('Error updating status:', err)
        }
    }

    const saveDelaySettings = async (newDelay: number) => {
        try {
            setSavingDelay(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('profiles')
                .update({ lead_capture_delay: newDelay })
                .eq('user_id', user.id)

            if (error) {
                console.error('Error saving delay:', error)
                alert(t('Failed to save delay settings'))
            }
        } catch (err) {
            console.error('Error saving delay:', err)
        } finally {
            setSavingDelay(false)
        }
    }

    return (
        <PremiumLock
            isLocked={isLocked}
            featureName={t('Analytics & Leads')}
            description={t('Unlock detailed visitor insights, lead capture forms, and traffic charts.')}
        >
            <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">
                <header>
                    <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t('Analytics')}</h1>
                    <p className="mt-1.5 text-[13px] text-ink-2">{t('Track your digital card performance and potential customers')}</p>
                </header>

                {/* Rentang waktu */}
                <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-surface p-1 shadow-row">
                    {['7d', '30d', '90d'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${dateRange === range ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                                }`}
                        >
                            {t('{count} days', { count: range.replace('d', '') })}
                        </button>
                    ))}
                </div>

                {/* Formulir penangkap calon pelanggan */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-start gap-4">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${leadCaptureEnabled ? 'bg-success-soft text-success-soft-ink' : 'bg-fill-subtle text-ink-2'}`}>
                            <Users className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-semibold">{t('Contact Form')}</h3>
                                {leadCaptureEnabled && (
                                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success-soft-ink">
                                        {t('Active')}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-[12.5px] leading-snug text-ink-2">
                                {t("Collect visitors' names, WhatsApp numbers, and email addresses from your public card")}
                            </p>
                        </div>
                        <button
                            onClick={toggleLeadCapture}
                            aria-label={t('Enable contact form')}
                            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${leadCaptureEnabled ? 'bg-ink' : 'bg-track'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-row transition-transform ${leadCaptureEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Jeda munculnya formulir */}
                    {leadCaptureEnabled && (
                        <div className="mt-4 rounded-row bg-fill-subtle p-4">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
                                    <Clock className="h-4 w-4 text-ink-3" strokeWidth={1.8} />
                                    {t('Show after')}
                                </span>
                                <span
                                    className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-ink-2"
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                >
                                    {leadCaptureDelay}s
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="15"
                                step="1"
                                value={leadCaptureDelay}
                                onChange={(e) => setLeadCaptureDelay(parseInt(e.target.value))}
                                onMouseUp={(e) => saveDelaySettings(parseInt((e.target as HTMLInputElement).value))}
                                onTouchEnd={(e) => saveDelaySettings(parseInt((e.target as HTMLInputElement).value))}
                                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-track accent-ink"
                            />
                            <div className="mt-2 flex justify-between text-[10px] text-ink-3">
                                <span>{t('Fast (1 second)')}</span>
                                <span>{t('Slow (15 seconds)')}</span>
                            </div>
                        </div>
                    )}
                </section>

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-ink-3" />
                    </div>
                ) : (
                    <>
                        {/* Four summary metrics */}
                        <section className="mt-3 grid grid-cols-2 gap-y-5 divide-x divide-ink/[0.08] rounded-card-sm bg-surface px-2 py-4 shadow-row md:grid-cols-4">
                            <Stat icon={Eye} label={t('Total Views')} value={stats.totalViews} />
                            <Stat icon={MousePointer2} label={t('Link Clicks')} value={stats.totalClicks} />
                            <Stat icon={Users} label={t('Total Contacts')} value={stats.totalLeads} />
                            <Stat
                                icon={TrendingUp}
                                label="CTR"
                                value={`${stats.totalViews > 0 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1) : 0}%`}
                            />
                        </section>

                        {/* Traffic chart */}
                        <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[15px] font-semibold">{t('Traffic')}</h3>
                                <div className="flex items-center gap-4 text-[11.5px] text-ink-2">
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-track" />
                                        {t('Views')}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-coral" />
                                        {t('Clicks')}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 flex h-56 items-end gap-1.5">
                                {chartData.map((item, i) => {
                                    const maxVal = Math.max(...chartData.map(d => Math.max(d.views, d.clicks, 10)))
                                    const viewHeight = (item.views / maxVal) * 100
                                    const clickHeight = (item.clicks / maxVal) * 100

                                    return (
                                        <div key={i} className="group relative flex h-full flex-1 flex-col justify-end gap-1">
                                            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                                {item.date}: {item.views} {t('views')}, {item.clicks} {t('clicks')}
                                            </div>

                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${viewHeight}%` }}
                                                className="relative w-full rounded-t-md bg-track"
                                            >
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${clickHeight}%` }}
                                                    className="absolute bottom-0 left-0 right-0 rounded-t-md bg-coral/70"
                                                />
                                            </motion.div>

                                            {i % 5 === 0 && (
                                                <span className="absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 text-[10px] text-ink-3">
                                                    {item.date}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="mt-7">
                            <div role="tablist" aria-label={t('Relationship collections')} className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1 shadow-row">
                                <button role="tab" aria-selected={collectionTab === 'contacts'} onClick={() => { setCollectionTab('contacts'); window.history.replaceState(null, '', '/dashboard/analytics') }} className={`rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${collectionTab === 'contacts' ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>{t('Contacts')} <span className="ml-1 opacity-70">{stats.totalLeads}</span></button>
                                <button role="tab" aria-selected={collectionTab === 'saved'} onClick={() => { setCollectionTab('saved'); window.history.replaceState(null, '', '#saved') }} className={`rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${collectionTab === 'saved' ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>{t('Saved Cards')}</button>
                            </div>

                            <div className={collectionTab === 'contacts' ? 'mt-5' : 'hidden'}>
                        <section className="mt-7">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{t('Contacts')}</h2>
                                <button
                                    onClick={exportLeads}
                                    className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-white shadow-ink transition-transform active:scale-[0.98]"
                                >
                                    <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    {t('Export')}
                                </button>
                            </div>

                            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="relative block">
                                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{t('Search')}</span>
                                    <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-ink-3" strokeWidth={1.8} />
                                    <input
                                        value={leadSearch}
                                        onChange={(e) => setLeadSearch(e.target.value)}
                                        placeholder={t('Name, company, phone, email')}
                                        className="w-full rounded-row bg-surface py-3 pl-9 pr-3 text-[12.5px] text-ink shadow-row placeholder:text-ink-3 focus:outline-none"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{t('Status')}</span>
                                    <div className="relative">
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="w-full cursor-pointer appearance-none rounded-row bg-surface py-3 pl-4 pr-9 text-[12.5px] text-ink shadow-row focus:outline-none"
                                        >
                                            <option value="all">{t('All statuses')}</option>
                                            <option value="new">{t('New')}</option>
                                            <option value="contacted">{t('Contacted')}</option>
                                            <option value="converted">{t('Deal')}</option>
                                            <option value="failed">{t('Failed')}</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-3">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{t('From')}</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full rounded-row bg-surface px-3 py-3 text-[12.5px] text-ink shadow-row focus:outline-none"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{t('To')}</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full rounded-row bg-surface px-3 py-3 text-[12.5px] text-ink shadow-row focus:outline-none"
                                    />
                                </label>
                            </div>

                            <div className="mt-2.5 flex items-center gap-2.5">
                                <button
                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex shrink-0 items-center gap-2 rounded-row bg-surface px-4 py-3 text-[12.5px] font-medium text-ink-2 shadow-row"
                                >
                                    <ArrowUpDown className="h-4 w-4" strokeWidth={1.8} />
                                    {sortOrder === 'desc' ? t('Newest') : t('Oldest')}
                                </button>
                                {(statusFilter !== 'all' || dateFrom || dateTo || leadSearch) && (
                                    <button
                                        onClick={() => {
                                            setStatusFilter('all')
                                            setDateFrom('')
                                            setDateTo('')
                                            setLeadSearch('')
                                        }}
                                        className="px-3 py-3 text-[12.5px] font-medium text-ink-2 transition-colors hover:text-ink"
                                    >
                                        {t('Clear filters')}
                                    </button>
                                )}
                            </div>

                            {loadingLeads ? (
                                <div className="mt-4 flex justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
                                </div>
                            ) : recentLeads.length > 0 ? (
                                <div className="mt-4 grid gap-2.5">
                                    {recentLeads.map((lead: any) => {
                                        const wa = whatsappLink(lead.whatsapp)
                                        return (
                                            <div
                                                key={lead.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setActiveLead(lead)}
                                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveLead(lead)}
                                                className="flex cursor-pointer items-center gap-3 rounded-card-sm bg-surface p-4 text-left shadow-row transition-transform active:scale-[0.99]"
                                            >
                                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-[15px] font-semibold text-ink-2">
                                                    {(lead.name || '?').trim().charAt(0).toUpperCase()}
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-[14.5px] font-medium">{lead.name || t('No name')}</p>
                                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(lead.status || 'new')}`}>
                                                            {t(getStatusLabel(lead.status || 'new'))}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 truncate text-[12px] text-ink-2">
                                                        {lead.company ? `${lead.company} · ` : ''}{lead.whatsapp}
                                                    </p>
                                                </div>

                                                {/* Direct chat button; does not open the contact details */}
                                                {wa && (
                                                    <a
                                                        href={wa}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={t('Chat with {name} on WhatsApp', { name: lead.name || t('Contact') })}
                                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-ink transition-transform active:scale-95"
                                                    >
                                                        <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                                                    </a>
                                                )}
                                                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-card border border-dashed border-ink/15 bg-surface/60 p-10 text-center">
                                    <MessageSquare className="mx-auto mb-3 h-10 w-10 text-ink-3" strokeWidth={1.5} />
                                    <h3 className="text-[15px] font-medium">{t('No contacts yet')}</h3>
                                    <p className="mt-1.5 text-[12.5px] text-ink-2">{t('Enable the contact form so visitors can leave their details')}</p>
                                </div>
                            )}
                        </section>
                            </div>

                            {collectionTab === 'saved' && (
                                <div className="mt-5">
                                    {loadingSavedCards ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
                                    ) : savedCards.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                            {savedCards.map(card => card.profile && (
                                                <article key={card.profile_id} className="group relative overflow-hidden rounded-card-sm bg-surface p-3 shadow-row transition-transform active:scale-[0.99]">
                                                    <a href={`/${card.profile.slug}`} target="_blank" rel="noopener noreferrer" className="block">
                                                        <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-fill-subtle text-[27px] font-semibold text-ink-2">
                                                            {card.profile.avatar_url ? <img src={card.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : card.profile.display_name?.slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <p className="mt-3 truncate text-[13px] font-semibold">{card.profile.display_name || t('Gentanala member')}</p>
                                                        <p className="mt-1 truncate text-[11px] text-ink-2">{[card.profile.job_title, card.profile.company].filter(Boolean).join(' · ') || t('Digital business card')}</p>
                                                        <p className="mt-3 text-[10px] text-ink-3">{t('Saved')} {new Date(card.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</p>
                                                    </a>
                                                    <button type="button" onClick={() => void removeSavedCard(card.profile_id)} aria-label={t('Remove {name} from saved cards', { name: card.profile.display_name || t('Card') })} className="absolute right-2 top-2 rounded-full bg-surface/95 p-2 text-ink-2 shadow-row transition-colors hover:bg-coral-soft hover:text-coral-soft-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </article>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-card border border-dashed border-ink/15 bg-surface/60 p-10 text-center">
                                            <Bookmark className="mx-auto mb-3 h-10 w-10 text-ink-3" strokeWidth={1.5} />
                                            <h3 className="text-[15px] font-medium">{t('No saved cards yet')}</h3>
                                            <p className="mt-1.5 text-[12.5px] text-ink-2">{t('Bookmark any Gentanala card to build your personal network collection.')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {/* Contact details */}
                {activeLead && (
                    <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                        onClick={() => setActiveLead(null)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-card bg-surface p-5 pb-8 shadow-card sm:rounded-card sm:pb-5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-[17px] font-semibold text-ink-2">
                                        {(activeLead.name || '?').trim().charAt(0).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em]">
                                            {activeLead.name || t('No name')}
                                        </h3>
                                        <p className="mt-0.5 text-[11.5px] text-ink-3">
                                            {t('Added')} {new Date(activeLead.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
                                            {new Date(activeLead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveLead(null)}
                                    aria-label={t('Close')}
                                    className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                                >
                                    <X className="h-5 w-5" strokeWidth={1.8} />
                                </button>
                            </div>

                            {/* Data yang dia isi */}
                            <div className="mt-5 grid gap-2.5">
                                <div className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3">
                                    <Phone className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                    <div className="min-w-0">
                                        <p className="text-[10.5px] uppercase tracking-wider text-ink-3">WhatsApp</p>
                                        <p className="truncate text-[14px]">{activeLead.whatsapp || '—'}</p>
                                    </div>
                                </div>

                                {activeLead.email && (
                                    <div className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3">
                                        <Mail className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                        <div className="min-w-0">
                                            <p className="text-[10.5px] uppercase tracking-wider text-ink-3">{t('Email')}</p>
                                            <p className="truncate text-[14px]">{activeLead.email}</p>
                                        </div>
                                    </div>
                                )}

                                {activeLead.company && (
                                    <div className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3">
                                        <Building2 className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                        <div className="min-w-0">
                                            <p className="text-[10.5px] uppercase tracking-wider text-ink-3">{t('Company')}</p>
                                            <p className="truncate text-[14px]">{activeLead.company}</p>
                                        </div>
                                    </div>
                                )}

                                {activeLead.job_title && (
                                    <div className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3">
                                        <Briefcase className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                        <div className="min-w-0">
                                            <p className="text-[10.5px] uppercase tracking-wider text-ink-3">{t('Job Title')}</p>
                                            <p className="truncate text-[14px]">{activeLead.job_title}</p>
                                        </div>
                                    </div>
                                )}

                                {getExternalUrl(activeLead.linkedin) && (
                                    <a
                                        href={getExternalUrl(activeLead.linkedin) as string}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3 transition-colors hover:text-ink-2"
                                    >
                                        <Linkedin className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                        <div className="min-w-0">
                                            <p className="text-[10.5px] uppercase tracking-wider text-ink-3">LinkedIn</p>
                                            <p className="truncate text-[14px]">{activeLead.linkedin}</p>
                                        </div>
                                    </a>
                                )}

                                {activeLead.wechat_id && (
                                    <div className="flex items-center gap-3 rounded-row bg-fill-subtle px-4 py-3">
                                        <MessageCircle className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                                        <div className="min-w-0">
                                            <p className="text-[10.5px] uppercase tracking-wider text-ink-3">{t('WeChat ID')}</p>
                                            <p className="truncate text-[14px]">{activeLead.wechat_id}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            <div className="mt-5">
                                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{t('Status')}</p>
                                <div className="mt-2 grid grid-cols-2 gap-1 rounded-row bg-fill-subtle p-1 sm:grid-cols-4 sm:rounded-full">
                                    {[
                                        { id: 'new', label: 'New' },
                                        { id: 'contacted', label: 'Contacted' },
                                        { id: 'converted', label: 'Deal' },
                                        { id: 'failed', label: 'Failed' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => updateLeadStatus(activeLead.id, opt.id)}
                                            className={`rounded-full py-2.5 text-[12px] font-medium transition-colors ${(activeLead.status || 'new') === opt.id ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                                                }`}
                                        >
                                            {t(opt.label)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aksi */}
                            <div className="mt-5 grid gap-2.5">
                                {whatsappLink(activeLead.whatsapp) ? (
                                    <a
                                        href={whatsappLink(activeLead.whatsapp) as string}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                                    >
                                        <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                                         {t('Chat on WhatsApp')}
                                     </a>
                                 ) : (
                                     <p className="rounded-row bg-fill-subtle px-4 py-3 text-center text-[12px] text-ink-3">
                                         {t('This number cannot be used to start a chat')}
                                    </p>
                                )}

                                {activeLead.email && (
                                    <a
                                        href={`mailto:${activeLead.email}`}
                                        className="flex items-center justify-center gap-2 rounded-full bg-fill-subtle py-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
                                    >
                                        <Mail className="h-4 w-4" strokeWidth={1.8} />
                                         {t('Send email')}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PremiumLock>
    )
}

/** Satu angka di dalam kartu ringkasan — pola yang sama dipakai beranda. */
function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number | string }) {
    return (
        <div className="flex flex-col items-center px-2">
            <Icon className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.8} />
            <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em]">{value}</p>
            <p className="mt-1.5 text-center text-[11.5px] text-ink-2">{label}</p>
        </div>
    )
}
