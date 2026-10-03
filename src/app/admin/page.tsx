'use client'

import AnimatedNumber from '@/components/motion/AnimatedNumber'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Shield,
    Plus,
    Download,
    RefreshCw,
    Loader2,
    Search,
    LogOut,
    CheckCircle2,
    X,
    AlertCircle,
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    QrCode,
    Trash2,
    Edit2,
    Link as LinkIcon,
    ExternalLink,
    ShieldAlert,
    User,
    Mail,
    Phone,
    Clock,
    Activity,
    Eye,
    Check,
    Copy,
    Package,
    AlertTriangle,
    Building,
    FileText,
    UserCheck,
    Settings,
    Smartphone,
    Gift
} from 'lucide-react'
import Link from 'next/link' // Added Link import
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import { SPECIAL_EDITIONS, normalizeSpecialEditions } from '@/lib/special-greeting.mjs'
import { newGiftToken } from '@/lib/gift.mjs'

interface SerialWithProfile {
    id: string
    serial_uuid: string
    product_name: string
    is_claimed: boolean
    claimed_at: string | null
    owner_id: string | null
    nfc_tap_count: number
    created_at: string
    // Profile data (joined)
    display_name: string | null
    email: string | null
    whatsapp: string | null
    view_count: number
    link_clicks: number
    last_active: string | null
    sync_enabled: boolean
    // Full user metadata
    tier: string | null
    user_tag: string | null
    special_edition: string | null
    special_editions: string[]
    selected_special_greeting_anim: string | null
    company_id: string | null
    company_name: string | null
    user_id: string | null
    // Mode kado
    gift_enabled: boolean
    gift_url: string | null
    gift_message: string | null
    gift_from: string | null
    gift_token: string | null
    gift_opened_at: string | null
}

type SortField = 'created_at' | 'display_name' | 'nfc_tap_count' | 'view_count' | 'last_active'
type SortDir = 'asc' | 'desc'



// Helper to format relative date - Moved outside to keep component pure
const formatRelative = (d: string | null) => {
    if (!d) return '-'
    const now = Date.now()
    const diff = now - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
    return `${Math.floor(mins / 1440)}d ago`
}

const getSpecialEditionLabel = (editionId: string) => (
    SPECIAL_EDITIONS.find((edition) => edition.id === editionId)?.label || editionId
)

const getSpecialEditionLabels = (editionIds: string[]) => (
    editionIds.length > 0 ? editionIds.map(getSpecialEditionLabel).join(', ') : ''
)

export default function AdminPage() {
    const [adminRole, setAdminRole] = useState<'super_admin' | 'company_admin' | null>(null)
    const [adminCompanyId, setAdminCompanyId] = useState<string | null>(null)
    const [authCheckComplete, setAuthCheckComplete] = useState(false)

    const [activeTab, setActiveTab] = useState<'profiles' | 'companies' | 'features'>('profiles')
    const [userToDelete, setUserToDelete] = useState<any | null>(null)
    const [tierConfigs, setTierConfigs] = useState<any[]>([])
    const [serials, setSerials] = useState<SerialWithProfile[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [companies, setCompanies] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [generateCount, setGenerateCount] = useState(1)
    const [generateCompanyId, setGenerateCompanyId] = useState<string>('')
    const [generateSpecialEdition, setGenerateSpecialEdition] = useState<string>('')
    const [generating, setGenerating] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [siteUrl, setSiteUrl] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [filterStatus, setFilterStatus] = useState<'all' | 'claimed' | 'unclaimed'>('all')
    const [qrDownloadData, setQrDownloadData] = useState<{ uuid: string; label: string; url: string } | null>(null)

    // Mode kado: satu isian yang dipakai bareng pembeli lewat tautan rahasia.
    const [giftSerial, setGiftSerial] = useState<SerialWithProfile | null>(null)
    const [giftForm, setGiftForm] = useState({ url: '', message: '', from: '' })
    const [giftSaving, setGiftSaving] = useState(false)

    // Edit Modal State
    const [editUser, setEditUser] = useState<any | null>(null)
    const [editCompany, setEditCompany] = useState<any | null>(null)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setSiteUrl(window.location.origin)
            checkAuth()
        }
    }, [])

    const checkAuth = async () => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
            // Check role in profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, company_id')
                .eq('user_id', session.user.id)
                .single()

            if (profile && (profile.role === 'super_admin' || profile.role === 'company_admin')) {
                setAdminRole(profile.role)
                setAdminCompanyId(profile.company_id)
                loadAllData(profile.role, profile.company_id)
            }
        }
        setAuthCheckComplete(true)
    }

    const handleLogoutAdmin = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const loadAllData = async (role: 'super_admin' | 'company_admin', companyId: string | null) => {
        setLoading(true)
        const supabase = createClient()

        // Variables for queries
        let serialQuery = supabase.from('serial_numbers').select('*').order('created_at', { ascending: false })
        let profileQuery = supabase.from('profiles').select('*')
        let companyQuery = supabase.from('companies').select('*').order('created_at', { ascending: false })

        if (role === 'company_admin' && companyId) {
            companyQuery = companyQuery.eq('id', companyId)
            profileQuery = profileQuery.eq('company_id', companyId)
            // serial_numbers owner_id needs to be filtered by profiles, which we'll do in array filter below since Supabase RLS handles the raw query.
        }

        // 1. Fetch Serials & Profiles for Serials Tab
        // If company_admin, RLS might handle it, but we can also be explicit here just in case.
        // Actually, RLS handles it automatically based on the user's role and company_id!
        const { data: serialData } = await serialQuery
        const { data: profileData } = await profileQuery

        const { data: companyData } = await companyQuery
        const { data: tierData } = await supabase.from('tier_configs').select('*').order('tier', { ascending: true })

        // Map Profiles
        const profileMap = new Map<string, any>()
        if (profileData) {
            profileData.forEach((p: any) => profileMap.set(p.user_id, p))
        }

        // Map Companies
        const companyMap = new Map<string, any>()
        if (companyData) {
            companyData.forEach((c: any) => companyMap.set(c.id, c))
        }

        // Process Serials
        const mappedSerials: SerialWithProfile[] = (serialData || []).map((s: any) => {
            const profile = s.owner_id ? profileMap.get(s.owner_id) : null
            const theme = profile?.theme || {}
            const specialEditions = normalizeSpecialEditions(
                profile?.special_editions?.length ? profile.special_editions : s.special_editions?.length ? s.special_editions : s.special_edition || profile?.special_edition
            )
            return {
                id: s.id,
                serial_uuid: s.serial_uuid,
                product_name: 'Gentanala Classic',
                is_claimed: s.is_claimed || false,
                claimed_at: s.claimed_at,
                owner_id: s.owner_id || null,
                nfc_tap_count: s.nfc_tap_count || 0,
                created_at: s.created_at,
                display_name: profile?.display_name || null,
                email: profile?.email || null,
                whatsapp: theme.whatsapp || profile?.phone || null,
                view_count: theme.view_count || 0,
                link_clicks: theme.link_clicks || 0,
                last_active: profile?.updated_at || null,
                sync_enabled: s.sync_enabled !== false,
                tier: profile?.tier || 'FREE',
                user_tag: profile?.user_tag || null,
                special_edition: specialEditions[0] || s.special_edition || profile?.special_edition || null,
                special_editions: specialEditions,
                selected_special_greeting_anim: profile?.selected_special_greeting_anim || null,
                company_id: s.company_id || profile?.company_id || null,
                company_name: (s.company_id ? companyMap.get(s.company_id)?.name : null) || (profile?.company_id ? companyMap.get(profile.company_id)?.name : null),
                user_id: s.owner_id || null,
                gift_enabled: s.gift_enabled || false,
                gift_url: s.gift_url || null,
                gift_message: s.gift_message || null,
                gift_from: s.gift_from || null,
                gift_token: s.gift_token || null,
                gift_opened_at: s.gift_opened_at || null
            }
        })

        // Process Users (Profiles)
        const mappedUsers = (profileData || []).map((p: any) => ({
            ...p,
            company_name: p.company_id ? companyMap.get(p.company_id)?.name : null
        }))

        setSerials(mappedSerials)
        setUsers(mappedUsers)

        setCompanies(companyData || [])
        setTierConfigs(tierData || [])
        setLoading(false)
    }

    const generateSerials = async () => {
        if (!window.confirm(`Generate ${generateCount} new serials${generateCompanyId ? ' for the selected Company' : ''}?`)) return
        setGenerating(true)

        try {
            const res = await fetch('/api/admin/serials/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    count: generateCount,
                    company_id: generateCompanyId || null,
                    special_edition: generateSpecialEdition || null
                })
            })

            const data = await res.json()

            if (!res.ok) {
                alert('Gagal generate: ' + (data.error || 'Unknown error'))
            } else {
                alert(data.message || `${generateCount} serial berhasil dibuat!`)
                if (adminRole) await loadAllData(adminRole, adminCompanyId)
                setGenerateCompanyId('')
                setGenerateSpecialEdition('')
            }
        } catch (err: any) {
            alert('Network error: ' + err.message)
        }

        setGenerating(false)
    }

    const deleteSerial = async (id: string) => {
        const supabase = createClient()
        const { error } = await supabase.from('serial_numbers').delete().eq('id', id)
        if (error) {
            alert('Gagal hapus serial: ' + error.message)
        } else {
            setSerials(prev => prev.filter(s => s.id !== id))
            setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
        }
        setDeleteConfirm(null)
    }

    const bulkDelete = async () => {
        const supabase = createClient()
        const ids = Array.from(selectedIds)
        const { error } = await supabase.from('serial_numbers').delete().in('id', ids)
        if (error) {
            alert('Gagal hapus: ' + error.message)
        } else {
            setSerials(prev => prev.filter(s => !selectedIds.has(s.id)))
            setSelectedIds(new Set())
        }
        setBulkDeleteConfirm(false)
    }

    const deleteCompany = async (id: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus perusahaan ini beserta datanya? (Pastikan tidak ada user/serial yang masih menyantol)')) return
        const supabase = createClient()
        const { error } = await supabase.from('companies').delete().eq('id', id)
        if (error) {
            alert('Gagal menghapus perusahaan: ' + error.message)
        } else {
            setCompanies(prev => prev.filter(c => c.id !== id))
            alert('Perusahaan berhasil dihapus.')
        }
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const exportCSV = () => {
        const headers = ['UUID', 'NFC URL', 'Product', 'Status', 'Nama', 'Email', 'WhatsApp', 'Views', 'Clicks', 'Taps', 'Last Active', 'Created']
        const rows = serials.map(s => [
            s.serial_uuid,
            `${siteUrl}/tap/${s.serial_uuid}`,
            s.product_name,
            s.is_claimed ? 'Claimed' : 'Unclaimed',
            s.display_name || '-',
            s.email || '-',
            s.whatsapp || '-',
            s.view_count.toString(),
            s.link_clicks.toString(),
            s.nfc_tap_count.toString(),
            s.last_active ? new Date(s.last_active).toLocaleDateString('id-ID') : '-',
            new Date(s.created_at).toLocaleDateString('id-ID')
        ])
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `serials-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const downloadQR = (uuid: string, label?: string) => {
        const tapUrl = `${siteUrl}/tap/${uuid}`
        setQrDownloadData({ uuid, label: label || uuid.substring(0, 18) + '...', url: tapUrl })
    }

    // Effect to handle QR download when qrDownloadData is set
    useEffect(() => {
        if (!qrDownloadData) return

        const timer = setTimeout(() => {
            const svgEl = document.getElementById('qr-download-svg')?.querySelector('svg')
            if (!svgEl) {
                setQrDownloadData(null)
                return
            }

            const size = 400
            const canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size + 60
            const ctx = canvas.getContext('2d')!

            // White background
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const svgData = new XMLSerializer().serializeToString(svgEl)
            const img = new Image()
            img.onload = () => {
                const padding = 30
                const qrSize = size - padding * 2
                ctx.drawImage(img, padding, padding, qrSize, qrSize)

                // Label
                ctx.fillStyle = '#18181b'
                ctx.font = 'bold 14px Inter, system-ui, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(qrDownloadData.label, size / 2, size + 20)

                ctx.fillStyle = '#71717a'
                ctx.font = '11px Inter, system-ui, sans-serif'
                ctx.fillText('Gentanala Digital Card', size / 2, size + 42)

                // Download
                const pngUrl = canvas.toDataURL('image/png')
                const a = document.createElement('a')
                a.download = `qr-${qrDownloadData.uuid.substring(0, 8)}.png`
                a.href = pngUrl
                a.click()

                setQrDownloadData(null)
            }
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
        }, 150) // Wait for React to render the QR

        return () => clearTimeout(timer)
    }, [qrDownloadData])

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAndSorted.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredAndSorted.map(s => s.id)))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev)
            if (n.has(id)) {
                n.delete(id)
            } else {
                n.add(id)
            }
            return n
        })
    }

    // Filter
    const filtered = useMemo(() => {
        let result = serials
        if (filterStatus === 'claimed') result = result.filter(s => s.is_claimed)
        if (filterStatus === 'unclaimed') result = result.filter(s => !s.is_claimed)
        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            result = result.filter(s =>
                s.serial_uuid.toLowerCase().includes(q) ||
                s.display_name?.toLowerCase().includes(q) ||
                s.email?.toLowerCase().includes(q) ||
                s.whatsapp?.toLowerCase().includes(q) ||
                s.product_name.toLowerCase().includes(q)
            )
        }
        return result
    }, [serials, filterStatus, searchTerm])

    // Sort
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortDir, setSortDir] = useState<SortDir>('desc')

    const filteredAndSorted = useMemo(() => {
        const sorted = [...filtered]
        sorted.sort((a, b) => {
            let cmp = 0
            switch (sortField) {
                case 'created_at':
                    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    break
                case 'display_name':
                    cmp = (a.display_name || '').localeCompare(b.display_name || '')
                    break
                case 'nfc_tap_count':
                    cmp = a.nfc_tap_count - b.nfc_tap_count
                    break
                case 'view_count':
                    cmp = a.view_count - b.view_count
                    break
                case 'last_active':
                    cmp = new Date(a.last_active || 0).getTime() - new Date(b.last_active || 0).getTime()
                    break
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return sorted
    }, [filtered, sortField, sortDir])

    const formatDate = (d: string | null) => {
        if (!d) return '-'
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />
        return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    }

    const renderSerialsTable = () => (
        <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white/40 border-b border-zinc-200/50">
                            <th className="px-4 py-4 text-left w-10">
                                <input
                                    type="checkbox"
                                    checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-zinc-300 accent-blue-600"
                                />
                            </th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">UUID</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                <button onClick={() => toggleSort('display_name')} className="flex items-center gap-1 hover:text-zinc-700">
                                    Profil <SortIcon field="display_name" />
                                </button>
                            </th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sync</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                <button onClick={() => toggleSort('nfc_tap_count')} className="flex items-center gap-1 hover:text-zinc-700">
                                    Traffic <SortIcon field="nfc_tap_count" />
                                </button>
                            </th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                <button onClick={() => toggleSort('last_active')} className="flex items-center gap-1 hover:text-zinc-700">
                                    Last Active <SortIcon field="last_active" />
                                </button>
                            </th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Subscription</th>
                            <th className="px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center text-zinc-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Loading...
                                </td>
                            </tr>
                        ) : filteredAndSorted.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center text-zinc-400">
                                    Tidak ada data ditemukan
                                </td>
                            </tr>
                        ) : (
                            filteredAndSorted.map((serial) => (
                                <tr key={serial.id} className={`transition-colors ${selectedIds.has(serial.id) ? 'bg-blue-50/50' : 'hover:bg-white/40'}`}>
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(serial.id)}
                                            onChange={() => toggleSelect(serial.id)}
                                            className="w-4 h-4 rounded border-zinc-300 accent-blue-600"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <code className="text-[10px] text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded-md border border-blue-100 inline-block w-fit">
                                                {serial.serial_uuid.substring(0, 18)}...
                                            </code>
                                            <span className="text-[10px] text-zinc-400">
                                                {formatDate(serial.created_at)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {serial.is_claimed && serial.display_name ? (
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-zinc-400" />
                                                    <span className="text-sm font-semibold text-zinc-900">{serial.display_name}</span>
                                                </div>
                                                {serial.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3 text-zinc-300" />
                                                        <span className="text-xs text-zinc-500">{serial.email}</span>
                                                    </div>
                                                )}
                                                {serial.whatsapp && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3 h-3 text-zinc-300" />
                                                        <span className="text-xs text-zinc-500">{serial.whatsapp}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-400 italic">Belum diklaim</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${serial.is_claimed
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${serial.is_claimed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                            {serial.is_claimed ? 'Claimed' : 'Unclaimed'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => toggleSync(serial.id, serial.sync_enabled)}
                                                className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold border transition-all hover:shadow-sm uppercase tracking-wider ${serial.sync_enabled !== false
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                    : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                                                    }`}
                                                title={serial.sync_enabled !== false ? "Linked to Master Branding" : "Independent Branding"}
                                            >
                                                {serial.sync_enabled !== false ? 'Synced' : 'Independent'}
                                            </button>
                                            {serial.company_name && (
                                                <span className="text-[9px] text-blue-500 font-medium truncate max-w-[140px]" title={serial.company_name}>
                                                    🏢 {serial.company_name}
                                                </span>
                                            )}
                                            {serial.sync_enabled && (serial.display_name || serial.email) && (
                                                <span className="text-[9px] text-zinc-400 truncate max-w-[120px]" title={serial.display_name || serial.email || ''}>
                                                    🔗 {serial.display_name || serial.email}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                <Eye className="w-3 h-3 text-purple-400" />
                                                <span className="text-zinc-700">{serial.view_count} views</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <Activity className="w-3 h-3 text-blue-400" />
                                                <span className="text-zinc-700">{serial.nfc_tap_count} taps</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-zinc-400">{serial.link_clicks} clicks</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-zinc-300" />
                                            <span className="text-xs text-zinc-500">{formatRelative(serial.last_active)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {serial.is_claimed ? (
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${serial.tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' :
                                                        serial.tier === 'B2B' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-zinc-100 text-zinc-600'
                                                        }`}>
                                                        {serial.tier}
                                                    </span>
                                                    {serial.user_tag && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-medium">
                                                            {serial.user_tag}
                                                        </span>
                                                    )}
                                                    {serial.special_editions.length > 0 && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-medium">
                                                            ✨ {getSpecialEditionLabels(serial.special_editions)}
                                                        </span>
                                                    )}
                                                </div>
                                                {serial.company_name && (
                                                    <span className="text-[10px] text-zinc-400 truncate max-w-[100px]" title={serial.company_name}>
                                                        🏢 {serial.company_name}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setEditUser(serial)}
                                                    className="text-[10px] text-blue-600 font-medium hover:underline w-fit"
                                                >
                                                    Manage Sub
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {serial.special_editions.length > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-medium w-fit">
                                                        ✨ {getSpecialEditionLabels(serial.special_editions)}
                                                    </span>
                                                )}
                                                {serial.company_name && (
                                                    <span className="text-[10px] text-zinc-400 truncate max-w-[100px]" title={serial.company_name}>
                                                        🏢 {serial.company_name}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setEditUser(serial)}
                                                    className="text-[10px] text-blue-600 font-medium hover:underline w-fit"
                                                >
                                                    Manage Card
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => downloadQR(serial.serial_uuid, serial.display_name || undefined)}
                                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Download QR Code"
                                            >
                                                <QrCode className="w-4 h-4 text-blue-400" />
                                            </button>
                                            <button
                                                onClick={() => openGift(serial)}
                                                className={`p-2 rounded-lg transition-colors ${serial.gift_enabled ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-zinc-100'}`}
                                                title={serial.gift_enabled ? 'Kado aktif — klik untuk ubah' : 'Atur mode kado'}
                                            >
                                                <Gift className={`w-4 h-4 ${serial.gift_enabled ? 'text-rose-500' : 'text-zinc-400'}`} />
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(`${siteUrl}/tap/${serial.serial_uuid}`, serial.id)}
                                                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                                                title="Copy NFC URL"
                                            >
                                                {copiedId === serial.id ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4 text-zinc-400" />
                                                )}
                                            </button>
                                            {adminRole === 'super_admin' && (
                                                <button
                                                    onClick={() => setDeleteConfirm(serial.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {/* Table footer */}
            <div className="px-6 py-3 bg-white/30 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
                <span>Menampilkan {filteredAndSorted.length} dari {serials.length} serial</span>
                <span>Sort: {sortField} ({sortDir})</span>
            </div>
        </div>
    )

    const toggleFeature = async (tier: string, featureKey: string, currentValue: boolean) => {
        const supabase = createClient()
        const config = tierConfigs.find(t => t.tier === tier)
        if (!config) return

        const newFeatures = { ...config.features, [featureKey]: !currentValue }

        // Optimistic UI update
        const updatedConfigs = tierConfigs.map(t =>
            t.tier === tier ? { ...t, features: newFeatures } : t
        )
        setTierConfigs(updatedConfigs)

        const { error } = await supabase
            .from('tier_configs')
            .update({ features: newFeatures })
            .eq('tier', tier)

        if (error) {
            alert('Failed to update feature: ' + error.message)
            loadAllData(adminRole!, adminCompanyId) // Revert
        }
    }

    // Buka isian kado. Tautan rahasia untuk pembeli dibuat sekali di sini,
    // lalu dipakai terus untuk kartu itu.
    const openGift = async (serial: SerialWithProfile) => {
        let token = serial.gift_token
        if (!token) {
            token = newGiftToken()
            const supabase = createClient()
            await supabase.from('serial_numbers').update({ gift_token: token }).eq('id', serial.id)
            setSerials(prev => prev.map(s => (s.id === serial.id ? { ...s, gift_token: token } : s)))
        }
        setGiftSerial({ ...serial, gift_token: token })
        setGiftForm({
            url: serial.gift_url || '',
            message: serial.gift_message || '',
            from: serial.gift_from || '',
        })
    }

    const saveGift = async (enabled: boolean) => {
        if (!giftSerial) return
        setGiftSaving(true)
        const patch = {
            gift_enabled: enabled,
            gift_url: giftForm.url.trim() || null,
            gift_message: giftForm.message.trim() || null,
            gift_from: giftForm.from.trim() || null,
        }
        const supabase = createClient()
        const { error } = await supabase.from('serial_numbers').update(patch).eq('id', giftSerial.id)
        setGiftSaving(false)

        if (error) {
            alert('Gagal menyimpan kado: ' + error.message)
            return
        }

        setSerials(prev => prev.map(s => (s.id === giftSerial.id ? { ...s, ...patch } : s)))
        setGiftSerial(null)
    }

    const toggleSync = async (serialId: string, currentStatus: boolean | null | undefined) => {
        const isCurrentlySynced = currentStatus !== false // Default to true if null/undefined
        console.log('Toggling sync for:', serialId, 'Current DB status:', currentStatus, 'Interpreted as Synced:', isCurrentlySynced)

        const newStatus = !isCurrentlySynced
        const message = newStatus
            ? "KONFIRMASI: Aktifkan Sinkronisasi?\n\nKartu ini akan mengikuti branding profil utama (Master Profile). Data unik di kartu ini akan disembunyikan."
            : "KONFIRMASI: Matikan Sinkronisasi?\n\nKartu ini akan menjadi profil independen. Anda bisa mengatur isi profil ini secara terpisah."

        if (typeof window !== 'undefined' && !window.confirm(message)) {
            console.log('Sync toggle cancelled by user')
            return
        }

        console.log('Sync toggle confirmed, updating database...')
        const supabase = createClient()

        // Optimistic update
        setSerials(serials.map(s =>
            s.id === serialId ? { ...s, sync_enabled: newStatus } : s
        ))

        const { error } = await supabase
            .from('serial_numbers')
            .update({ sync_enabled: newStatus })
            .eq('id', serialId)

        if (error) {
            alert('Failed to update sync status: ' + error.message)
            loadAllData(adminRole!, adminCompanyId) // Revert
        }
    }

    const renderFeaturesTable = () => {
        const featureKeys = [
            { key: 'basic_features', label: 'Basic Links & Info', description: 'Standard link-in-bio features' },
            { key: 'social_impact', label: 'Social Impact (Green)', description: 'Display green impact stats' },
            { key: 'ai_content', label: 'AI Bio & Avatar', description: 'Generate bio and avatar with AI' },
            { key: 'ai_bot', label: 'AI Digital Rep', description: 'Automated AI representative' },
            { key: 'analytics_leads', label: 'Analytics & Leads', description: 'Deep analytics and lead capture form' },
            { key: 'sync', label: 'Multi-Profile Sync', description: 'Sync content across multiple assets' },
            { key: 'custom_branding', label: 'Custom Branding', description: 'Logo & Uniform Theme management' },
            { key: 'company_dashboard', label: 'Company Dashboard', description: 'Dedicated dashboard for B2B' },
            { key: 'asset_management', label: 'Asset Management', description: 'Transfer assets to employees' }
        ]

        // Ensure we always have the 3 columns even if DB is empty
        const tiers = ['FREE', 'PREMIUM', 'B2B']

        return (
            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white/40 border-b border-zinc-200/50">
                            <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-1/3">Feature</th>
                            {tiers.map(tier => (
                                <th key={tier} className="text-center px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    <span className={`px-2 py-1 rounded-full ${tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' :
                                        tier === 'B2B' ? 'bg-blue-100 text-blue-700' :
                                            'bg-zinc-100 text-zinc-600'
                                        }`}>
                                        {tier}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {featureKeys.map((feature) => (
                            <tr key={feature.key} className="hover:bg-white/40 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-zinc-900">{feature.label}</span>
                                        <span className="text-xs text-zinc-500">{feature.description}</span>
                                    </div>
                                </td>
                                {tiers.map(tier => {
                                    const config = tierConfigs.find(t => t.tier === tier)
                                    const isEnabled = config?.features?.[feature.key] || false
                                    return (
                                        <td key={`${tier}-${feature.key}`} className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleFeature(tier, feature.key, isEnabled)}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isEnabled ? 'bg-blue-600' : 'bg-zinc-200'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${isEnabled ? 'translate-x-6' : 'translate-x-0'
                                                    }`} />
                                            </button>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderUsersTable = () => (
        <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white/40 border-b border-zinc-200/50">
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">User</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Tier</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Company</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Last Active</th>
                            <th className="text-right px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-zinc-400 font-medium">Loading users...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-zinc-400 font-medium">No users found</td></tr>
                        ) : (
                            users.filter(u =>
                                !searchTerm ||
                                u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map(user => (
                                <tr key={user.user_id} className="hover:bg-white/40">
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-zinc-900">{user.display_name || 'Anonymous'}</span>
                                            <span className="text-xs text-zinc-500">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.tier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' :
                                            user.tier === 'B2B' ? 'bg-blue-100 text-blue-700' :
                                                'bg-zinc-100 text-zinc-600'
                                            }`}>
                                            {user.tier}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-zinc-600">{user.company_name || '-'}</td>
                                    <td className="px-4 py-4 text-xs text-zinc-500">{formatRelative(user.updated_at)}</td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button onClick={() => setEditUser(user)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600" title="Edit Subscription">
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setUserToDelete(user)} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500" title="Delete Account">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    const renderCompaniesTable = () => (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setEditCompany({})} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> New Company
                </button>
            </div>
            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white/40 border-b border-zinc-200/50">
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Name</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Website</th>
                            <th className="text-right px-4 py-4 text-xs font-semibold text-zinc-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {companies.map(c => (
                            <tr key={c.id} className="hover:bg-white/40">
                                <td className="px-4 py-4 font-medium">{c.name}</td>
                                <td className="px-4 py-4 text-sm text-blue-600">{c.website}</td>
                                <td className="px-4 py-4 text-right">
                                    <button onClick={() => setEditCompany(c)} className="text-blue-600 hover:underline text-sm font-medium mr-4">Edit</button>
                                    <button onClick={() => deleteCompany(c.id)} className="text-red-500 hover:underline text-sm font-medium">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )

    if (!authCheckComplete) {
        return (
            <div className="min-h-screen bg-[#f0f0ec] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm font-medium text-zinc-500">Memverifikasi akses...</p>
                </div>
            </div>
        )
    }

    if (!adminRole) {
        return (
            <div className="min-h-screen bg-[#f0f0ec] flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/70 backdrop-blur-2xl border border-white p-10 rounded-[2.5rem] max-w-sm w-full shadow-2xl shadow-zinc-200/50 text-center"
                >
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
                        <ShieldAlert className="w-10 h-10 text-rose-500 -rotate-3" />
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Akses Khusus</h1>
                    <p className="text-zinc-500 font-medium mb-10 leading-relaxed text-sm">
                        Halaman ini dilindungi. Silakan login menggunakan akun email Administrator (Super Admin atau B2B Admin).
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={async () => {
                                const { createClient } = await import('@/lib/supabase/client')
                                const supabase = createClient()
                                await supabase.auth.signOut()
                                window.location.href = '/login?next=/admin'
                            }}
                            className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-95 cursor-pointer relative z-10"
                        >
                            <User className="w-4 h-4" /> Masuk sebagai Admin
                        </button>
                        <a
                            href="/"
                            className="flex items-center justify-center w-full py-3 text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer relative z-10"
                        >
                            Kembali ke Beranda
                        </a>
                    </div>

                    <div className="mt-8 pt-8 border-t border-zinc-100 relative z-10">
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            <strong>CATATAN:</strong> Kami telah memperbarui sistem keamanan. Sekarang tidak lagi menggunakan satu password bersama, melainkan login menggunakan email pribadi Anda masing-masing yang sudah terdaftar.
                        </p>
                    </div>
                </motion.div>
            </div>
        )
    }

    const renderContent = () => {
        if (activeTab === 'profiles') return renderSerialsTable()
        if (activeTab === 'companies') return renderCompaniesTable()
        if (activeTab === 'features') return renderFeaturesTable()
        return null
    }

    // ─── Admin Dashboard (Light Liquid Glass) ───
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-blue-50/50 to-zinc-100 text-zinc-900">
            {/* Header */}
            <header className="border-b border-white/40 bg-white/50 backdrop-blur-2xl sticky top-0 z-50 shadow-sm shadow-zinc-200/30">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg text-zinc-900">Gentanala {adminRole === 'super_admin' ? 'Super Admin' : 'Company Admin'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogoutAdmin}
                            className="text-sm font-semibold text-zinc-500 hover:text-rose-500 transition-colors flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Keluar
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100/50 backdrop-blur-sm rounded-xl w-fit mb-8 border border-zinc-200/50">
                    {['profiles', 'companies', 'features']
                        .filter(tab => adminRole === 'super_admin' || tab === 'profiles')
                        .map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                </div>

                {activeTab === 'profiles' && (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {[
                                { icon: <Package className="w-6 h-6 text-blue-600" />, bg: 'bg-blue-500/10 border-blue-500/20', val: serials.length, label: 'Total Serials' },
                                { icon: <Check className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-500/10 border-emerald-500/20', val: serials.filter(s => s.is_claimed).length, label: 'Claimed' },
                                { icon: <Eye className="w-6 h-6 text-purple-600" />, bg: 'bg-purple-500/10 border-purple-500/20', val: serials.reduce((a, s) => a + s.view_count, 0), label: 'Total Views' },
                                { icon: <Activity className="w-6 h-6 text-amber-600" />, bg: 'bg-amber-500/10 border-amber-500/20', val: serials.reduce((a, s) => a + s.nfc_tap_count, 0), label: 'Total Taps' },
                            ].map(stat => (
                                <div key={stat.label} className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.bg}`}>
                                            {stat.icon}
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-zinc-900"><AnimatedNumber value={stat.val} /></p>
                                            <p className="text-zinc-500 text-sm">{stat.label}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            {adminRole === 'super_admin' && (
                                <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-zinc-200 rounded-xl px-2 py-1">
                                    <span className="text-xs font-semibold text-zinc-500 pl-2">Generate:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={generateCount}
                                        onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                                        className="w-16 px-2 py-1.5 bg-transparent border-none text-zinc-900 text-center focus:outline-none"
                                    />
                                    <span className="text-xs text-zinc-400">cards for</span>
                                    <select
                                        value={generateCompanyId}
                                        onChange={(e) => setGenerateCompanyId(e.target.value)}
                                        className="py-1.5 px-2 bg-white rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-blue-500 min-w-[140px]"
                                    >
                                        <option value="">(No Company/B2C)</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <span className="text-xs text-zinc-400 pl-2">Edition:</span>
                                    <select
                                        value={generateSpecialEdition}
                                        onChange={(e) => setGenerateSpecialEdition(e.target.value)}
                                        className="py-1.5 px-2 bg-white rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-blue-500 min-w-[120px]"
                                    >
                                        <option value="">Standard</option>
                                        <option value="aruna">Aruna Series</option>
                                        <option value="prabowo">Prabowo Series</option>
                                    </select>
                                    <button
                                        onClick={generateSerials}
                                        disabled={generating}
                                        className="flex items-center gap-2 px-4 py-1.5 ml-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-xs font-medium"
                                    >
                                        {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                        Create
                                    </button>
                                </div>
                            )}
                            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-zinc-200 hover:bg-white/80 text-zinc-700 rounded-xl transition-colors font-medium ml-auto">
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                            <button onClick={() => adminRole && loadAllData(adminRole, adminCompanyId)} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-zinc-200 hover:bg-white/80 text-zinc-700 rounded-xl transition-colors font-medium">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>

                            {selectedIds.size > 0 && adminRole === 'super_admin' && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 ml-auto">
                                    <span className="text-sm text-zinc-500 font-medium">{selectedIds.size} selected</span>
                                    <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-medium">
                                        <Trash2 className="w-4 h-4" />
                                        Delete Selected
                                    </button>
                                    <button onClick={() => setSelectedIds(new Set())} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors">
                                        <X className="w-4 h-4 text-zinc-400" />
                                    </button>
                                </motion.div>
                            )}
                        </div>

                        {/* Search + Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Cari UUID, nama, email..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-white/50 backdrop-blur-sm border border-zinc-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-900 placeholder-zinc-400"
                                />
                            </div>
                            <div className="flex bg-white/50 backdrop-blur-sm border border-zinc-200 rounded-xl p-1">
                                {['all', 'claimed', 'unclaimed'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status as any)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === status
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
                                            }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {renderContent()}

                {activeTab === 'profiles' && (
                    <div className="mt-8 bg-blue-50/60 backdrop-blur-sm border border-blue-200/50 rounded-2xl p-6">
                        <h3 className="font-semibold text-blue-700 mb-3">📋 Cara Pakai:</h3>
                        <ol className="text-sm text-zinc-600 space-y-2 list-decimal list-inside">
                            <li>Klik <strong>&quot;Generate&quot;</strong> untuk membuat UUID baru</li>
                            <li>Klik <strong>&quot;Export CSV&quot;</strong> untuk download daftar</li>
                            <li>Kirim file CSV ke vendor NFC untuk di-program ke chip</li>
                            <li>Vendor akan program setiap chip dengan URL: <code className="text-blue-600 bg-blue-50 px-1 rounded">{'domain'}/tap/[uuid]</code></li>
                            <li>Saat customer scan, mereka akan diarahkan ke halaman claim</li>
                        </ol>
                    </div>
                )}
            </div>

            {/* Edit User Modal */}
            <AnimatePresence>
                {editUser && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl focus:outline-none"
                        >
                            <h3 className="text-lg font-bold mb-4">
                                {editUser.is_claimed ? 'Manage Subscription' : 'Manage Unclaimed Card'}
                            </h3>
                            <div className="space-y-4">
                                {editUser.display_name ? (
                                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 mb-2">
                                        <p className="text-xs text-zinc-500 uppercase font-semibold">User</p>
                                        <p className="text-sm font-bold text-zinc-900">{editUser.display_name}</p>
                                        <p className="text-xs text-zinc-500">{editUser.email}</p>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 mb-2">
                                        <p className="text-xs text-amber-600 uppercase font-semibold">Unclaimed Card</p>
                                        <p className="text-xs font-mono text-zinc-600 truncate mt-1">UUID: {editUser.serial_uuid}</p>
                                    </div>
                                )}
                                {adminRole === 'super_admin' && (
                                    <>
                                        {editUser.is_claimed && (
                                            <>
                                                <div>
                                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Tier</label>
                                                    <select
                                                        value={editUser.tier || 'FREE'}
                                                        onChange={e => setEditUser({ ...editUser, tier: e.target.value })}
                                                        className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                    >
                                                        <option value="FREE">Free</option>
                                                        <option value="PREMIUM">Premium</option>
                                                        <option value="B2B">B2B</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-zinc-500 uppercase">Tag</label>
                                                    <select
                                                        value={editUser.user_tag || ''}
                                                        onChange={e => setEditUser({ ...editUser, user_tag: e.target.value || null })}
                                                        className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                    >
                                                        <option value="">None</option>
                                                        <option value="GIFT">Gift</option>
                                                        <option value="DEMO">Demo</option>
                                                        <option value="INTERNAL">Internal</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label className="text-xs font-semibold text-zinc-500 uppercase">Special Edition Access</label>
                                            <div className="mt-2 grid gap-2">
                                                {SPECIAL_EDITIONS.map((edition) => {
                                                    const currentEditions = normalizeSpecialEditions(editUser.special_editions?.length ? editUser.special_editions : editUser.special_edition)
                                                    const checked = currentEditions.includes(edition.id)

                                                    return (
                                                        <label key={edition.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const nextEditions = e.target.checked
                                                                        ? Array.from(new Set([...currentEditions, edition.id]))
                                                                        : currentEditions.filter((item) => item !== edition.id)

                                                                    setEditUser({
                                                                        ...editUser,
                                                                        special_editions: nextEditions,
                                                                        special_edition: nextEditions[0] || null,
                                                                        selected_special_greeting_anim: typeof editUser.selected_special_greeting_anim === 'string' && nextEditions.includes(editUser.selected_special_greeting_anim)
                                                                            ? editUser.selected_special_greeting_anim
                                                                            : null
                                                                    })
                                                                }}
                                                                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
                                                            />
                                                            {edition.label}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                                {adminRole === 'super_admin' && (
                                    <div>
                                        <label className="text-xs font-semibold text-zinc-500 uppercase">Company (B2B Only)</label>
                                        <select
                                            value={editUser.company_id || ''}
                                            onChange={e => setEditUser({ ...editUser, company_id: e.target.value || null })}
                                            className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        >
                                            <option value="">None</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-8">
                                    {adminRole === 'super_admin' && editUser.is_claimed && (
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone.')) return

                                                const res = await fetch('/api/admin/users/delete', {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: editUser.user_id })
                                                })

                                                const data = await res.json()

                                                if (data.error) {
                                                    alert('Failed to delete user: ' + data.error)
                                                } else {
                                                    alert('User has been deleted successfully.')
                                                    setEditUser(null)
                                                    if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                                }
                                            }}
                                            className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors mr-auto"
                                        >
                                            Delete User
                                        </button>
                                    )}

                                    {editUser?.is_claimed && (
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm('Reset profil ini? Data bio, link, tampilan akan dikosongkan dan kaitan dengan kartu fisik akan dilepas (kartu menjadi Unclaimed). Akun login staff tetap ada namun kosong. Lanjutkan?')) return

                                                const res = await fetch('/api/admin/users/reset', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        userId: editUser.user_id,
                                                        requestorCompanyId: adminCompanyId,
                                                        requestorRole: adminRole
                                                    })
                                                })

                                                const data = await res.json()

                                                if (!res.ok) {
                                                    alert('Gagal mereset profil: ' + (data.error || 'Unknown error'))
                                                } else {
                                                    alert('Profil berhasil direset dan kartu dilepaskan.')
                                                    setEditUser(null)
                                                    if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                                }
                                            }}
                                            className="px-4 py-2 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors mr-auto ml-2"
                                        >
                                            Reset Profil
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setEditUser(null)}
                                        className="px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            // Use API to bypass RLS
                                            const res = await fetch('/api/admin/users/update', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    userId: editUser.user_id || null,
                                                    serialId: editUser.id,
                                                    tier: editUser.tier,
                                                    user_tag: editUser.user_tag,
                                                    company_id: editUser.company_id || null,
                                                    special_edition: editUser.special_editions?.[0] || null,
                                                    special_editions: normalizeSpecialEditions(editUser.special_editions),
                                                    selected_special_greeting_anim: typeof editUser.selected_special_greeting_anim === 'string' && normalizeSpecialEditions(editUser.special_editions).includes(editUser.selected_special_greeting_anim)
                                                        ? editUser.selected_special_greeting_anim
                                                        : null
                                                })
                                            })

                                            const data = await res.json()

                                            if (!res.ok) {
                                                console.error('Update failed:', data.error)
                                                alert('Failed to update: ' + (data.error || 'Unknown error'))
                                            } else {
                                                alert('User updated successfully')
                                                if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                                setEditUser(null)
                                            }
                                        }}
                                        className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Company Modal */}
            {/* Edit Company Modal - Redesigned as Full Dashboard */}
            <AnimatePresence>
                {editCompany && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 30, scale: 0.98 }}
                            className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden"
                        >
                            {/* Dashboard Header */}
                            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
                                <div>
                                    <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
                                        <Building className="w-7 h-7 text-blue-600" />
                                        {editCompany.id ? 'Company Dashboard' : 'Registrasi Company Baru'}
                                    </h3>
                                    <p className="text-sm text-zinc-500 mt-1 ml-10">Kelola identitas, delegasi admin, serta perangkat yang terhubung.</p>
                                </div>
                                <button
                                    onClick={() => setEditCompany(null)}
                                    className="p-2.5 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 grid lg:grid-cols-2 gap-10">
                                {/* Left Column: Main Information */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-6 border-b border-zinc-100 pb-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h4 className="text-lg font-bold text-zinc-900">Informasi Utama</h4>
                                    </div>

                                    <div className="grid gap-5">
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Company Name</label>
                                            <input
                                                type="text"
                                                value={editCompany.name || ''}
                                                onChange={e => setEditCompany({ ...editCompany, name: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl text-sm outline-none"
                                                placeholder="e.g. PT. Gentanala Jaya"
                                            />
                                        </div>
                                        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                                            <label className="text-xs font-bold text-amber-700 uppercase flex items-center gap-2 mb-1.5">
                                                <UserCheck className="w-4 h-4" /> Company Admin Email
                                            </label>
                                            <input
                                                type="email"
                                                value={editCompany.admin_email || ''}
                                                onChange={e => setEditCompany({ ...editCompany, admin_email: e.target.value })}
                                                className="w-full p-3.5 bg-white border border-amber-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all rounded-xl text-sm outline-none"
                                                placeholder="e.g. hrd@abadi.com"
                                            />
                                            <p className="text-[11px] text-amber-600/80 mt-2 font-medium">Isi email ini untuk mendelegasikan akses admin ke profil company (harus email yang sudah terdaftar sebagai akun).</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-5">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Website</label>
                                                <input
                                                    type="text"
                                                    value={editCompany.website || ''}
                                                    onChange={e => setEditCompany({ ...editCompany, website: e.target.value })}
                                                    className="w-full mt-1.5 p-3.5 bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl text-sm outline-none"
                                                    placeholder="https://company.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Logo URL</label>
                                                <input
                                                    type="text"
                                                    value={editCompany.logo_url || ''}
                                                    onChange={e => setEditCompany({ ...editCompany, logo_url: e.target.value })}
                                                    className="w-full mt-1.5 p-3.5 bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl text-sm outline-none"
                                                    placeholder="https://..."
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Profile Avatar B2B Fallback</label>
                                            <input
                                                type="text"
                                                value={editCompany.avatar_url || ''}
                                                onChange={e => setEditCompany({ ...editCompany, avatar_url: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl text-sm outline-none"
                                                placeholder="Alternatif avatar bagi profil B2B yang kosong"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Company Bio / Description</label>
                                            <textarea
                                                value={editCompany.bio || ''}
                                                onChange={e => setEditCompany({ ...editCompany, bio: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl text-sm outline-none min-h-[100px]"
                                                placeholder="Jelaskan deskripsi singkat profil company ini..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Extras and Devices */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-6 border-b border-zinc-100 pb-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                            <Settings className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <h4 className="text-lg font-bold text-zinc-900">Pengaturan Ekstra</h4>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Social Links (JSON Configuration)</label>
                                        <p className="text-xs text-zinc-400 mb-2 ml-1">Konfigurasi array format JSON untuk social links company.</p>
                                        <textarea
                                            value={typeof editCompany.social_links === 'string' ? editCompany.social_links : JSON.stringify(editCompany.social_links || [], null, 2)}
                                            onChange={e => {
                                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                try {
                                                    const parsed = JSON.parse(e.target.value)
                                                    setEditCompany({ ...editCompany, social_links: parsed })
                                                } catch (err) {
                                                    setEditCompany({ ...editCompany, social_links: e.target.value })
                                                }
                                            }}
                                            className="w-full p-4 bg-zinc-900 text-zinc-300 rounded-xl font-mono text-xs outline-none min-h-[140px] focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            placeholder='[{"platform": "instagram", "url": "..."}]'
                                        />
                                    </div>

                                    {/* Employees / Serials List (Only edit mode) */}
                                    {editCompany.id && (
                                        <div className="mt-8">
                                            <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                    <Smartphone className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <h4 className="text-lg font-bold text-zinc-900">Perangkat & Akun Tertaut</h4>
                                                <div className="ml-auto">
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                                                        {serials.filter(s => s.company_id === editCompany.id).length} Perangkat
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="max-h-[220px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-zinc-200">
                                                {serials.filter(s => s.company_id === editCompany.id).length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-8 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                                                        <Search className="w-8 h-8 text-zinc-300 mb-2" />
                                                        <p className="text-sm font-medium text-zinc-500">Belum ada perangkat / kartu yang tertaut.</p>
                                                    </div>
                                                ) : (
                                                    serials.filter(s => s.company_id === editCompany.id).map(s => (
                                                        <div key={s.id} className="group flex flex-col p-4 bg-white border border-zinc-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm font-black text-zinc-900 group-hover:text-blue-600 transition-colors uppercase">{s.display_name || 'Unclaimed'}</span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.is_claimed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                                    {s.is_claimed ? 'Aktif' : 'Terbuka'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Kode Kartu (UUID)</span>
                                                                    <code className="text-xs text-zinc-600 font-mono bg-zinc-100 px-1.5 py-0.5 rounded">{s.serial_uuid.substring(0, 13)}...</code>
                                                                </div>
                                                                {s.email && (
                                                                    <div className="flex flex-col border-l border-zinc-200 pl-4">
                                                                        <span className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Akun Pegawai</span>
                                                                        <span className="text-xs font-semibold text-zinc-700 truncate max-w-[120px]" title={s.email}>{s.email}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col border-l border-zinc-200 pl-4 ml-auto text-right">
                                                                    <span className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Analitik</span>
                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <span className="text-[11px] text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100"><Activity className="w-3 h-3 text-blue-500" />{s.nfc_tap_count}</span>
                                                                        <span className="text-[11px] text-purple-700 font-bold flex items-center gap-1 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-100"><Eye className="w-3 h-3 text-purple-500" />{s.view_count}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="px-8 py-5 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 items-center">
                                <button
                                    onClick={() => setEditCompany(null)}
                                    className="px-6 py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 rounded-xl transition-colors"
                                >
                                    Batal & Tutup
                                </button>
                                <button
                                    onClick={async () => {
                                        const supabase = createClient()
                                        let companyId = editCompany.id

                                        if (companyId) {
                                            const { error: updateError } = await supabase.from('companies').update({
                                                name: editCompany.name,
                                                website: editCompany.website,
                                                logo_url: editCompany.logo_url,
                                                bio: editCompany.bio,
                                                avatar_url: editCompany.avatar_url,
                                                social_links: typeof editCompany.social_links === 'string' ? JSON.parse(editCompany.social_links) : editCompany.social_links
                                            }).eq('id', companyId)

                                            if (updateError) {
                                                alert('Gagal update company: ' + updateError.message)
                                                return
                                            }
                                        } else {
                                            const { data: newCompany, error: insertError } = await supabase.from('companies').insert({
                                                name: editCompany.name,
                                                website: editCompany.website,
                                                logo_url: editCompany.logo_url,
                                                bio: editCompany.bio,
                                                avatar_url: editCompany.avatar_url,
                                                social_links: typeof editCompany.social_links === 'string' ? JSON.parse(editCompany.social_links) : (editCompany.social_links || [])
                                            }).select().single()

                                            if (insertError) {
                                                alert('Gagal membuat company: ' + insertError.message)
                                                return
                                            }
                                            if (newCompany) companyId = newCompany.id
                                        }

                                        // Assign admin role if email is provided
                                        if (companyId && editCompany.admin_email) {
                                            const res = await fetch('/api/admin/companies/assign-admin', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ company_id: companyId, admin_email: editCompany.admin_email })
                                            })
                                            const data = await res.json()
                                            if (!res.ok) {
                                                alert('Gagal menugaskan Admin: ' + (data.error || 'Unknown error. Pastikan email sudah register.'))
                                            } else {
                                                alert(data.message)
                                            }
                                        }

                                        setEditCompany(null)
                                        if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                    }}
                                    className="px-8 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-[0_8px_30px_rgb(37,99,235,0.2)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                                >
                                    Simpan Dashboard Company
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Single Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
                        >
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Hapus Serial Number?</h3>
                            <div className="space-y-4 mb-6">
                                <p className="text-sm text-zinc-600">
                                    Apakah Anda yakin ingin menghapus serial number ini?
                                </p>
                                {serials.find(s => s.id === deleteConfirm)?.is_claimed ? (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Terdeteksi User Terhubung</p>
                                        <p className="text-[11px] text-amber-700 leading-relaxed">
                                            Serial ini sudah diklaim oleh <strong>{serials.find(s => s.id === deleteConfirm)?.display_name}</strong>.
                                            Anda bisa menghapus hanya data fisiknya saja, atau menghapus seluruh akun user tersebut.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-400 italic">Serial ini belum diklaim oleh siapapun.</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => deleteSerial(deleteConfirm)}
                                        className="px-4 py-2 bg-zinc-100 text-zinc-700 text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                                    >
                                        Hapus Serial Saja
                                    </button>
                                </div>

                                {serials.find(s => s.id === deleteConfirm)?.is_claimed && (
                                    <button
                                        onClick={() => {
                                            const serial = serials.find(s => s.id === deleteConfirm)
                                            if (!serial?.user_id) return

                                            // Close this modal and open the User Deletion Modal (which has Reset/Delete options)
                                            setDeleteConfirm(null)
                                            setUserToDelete({
                                                user_id: serial.user_id,
                                                serial_id: serial.id,
                                                display_name: serial.display_name,
                                                email: serial.email
                                            })
                                        }}
                                        className="w-full py-2.5 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-600/20 mt-2"
                                    >
                                        HAPUS AKUN USER & TOKEN
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Delete Confirmation Modal */}
            <AnimatePresence>
                {bulkDeleteConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
                        >
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Hapus {selectedIds.size} Serial?</h3>
                            <p className="text-sm text-zinc-600 mb-6">
                                Anda akan menghapus masal {selectedIds.size} serial number. Tindakan ini permanen.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setBulkDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={bulkDelete}
                                    className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-600/20"
                                >
                                    Hapus Masal
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Direct User Deletion Modal */}
            <AnimatePresence>
                {userToDelete && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-zinc-100"
                        >
                            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 mx-auto rotate-3">
                                <Trash2 className="w-8 h-8 text-red-600 -rotate-3" />
                            </div>

                            <h3 className="text-xl font-black text-zinc-900 mb-2 text-center uppercase tracking-tight">Hapus Akun Permanent?</h3>
                            <p className="text-sm text-zinc-500 mb-8 text-center leading-relaxed">
                                Anda akan menghapus akun <strong>{userToDelete.display_name || userToDelete.email}</strong>.<br />
                                {(() => {
                                    const linkedCount = serials.filter(s => s.owner_id === userToDelete.user_id).length;
                                    if (linkedCount > 1) {
                                        return (
                                            <span className="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-lg mt-3 block border border-red-100">
                                                ⚠️ PERINGATAN: User ini memiliki {linkedCount} serial/kartu yang tertaut! Menghapus user akan memutuskan SEMUA kartu tersebut.
                                            </span>
                                        );
                                    }
                                    return <span className="text-red-500 font-bold mt-2 block">Seluruh profile, links, dan aset NFC akan terputus selamanya!</span>;
                                })()}
                            </p>

                            <div className="space-y-3">
                                {/* Option 1: Unclaim this specific serial only */}
                                {userToDelete.serial_id && (
                                    <button
                                        onClick={async () => {
                                            const res = await fetch('/api/admin/users/delete', {
                                                method: 'DELETE',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: userToDelete.user_id, serialId: userToDelete.serial_id, action: 'unclaim' })
                                            })
                                            const data = await res.json()
                                            if (data.error) alert('Gagal unclaim: ' + data.error)
                                            else {
                                                alert('Serial berhasil dilepas dari user. Profil user TIDAK tersentuh.')
                                                setUserToDelete(null)
                                                if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                            }
                                        }}
                                        className="w-full py-4 bg-blue-100 text-blue-800 text-sm font-bold rounded-2xl hover:bg-blue-200 transition-all border border-blue-200 flex flex-col items-center gap-1"
                                    >
                                        <span className="uppercase tracking-widest">LEPASKAN SERIAL INI</span>
                                        <span className="text-[10px] font-normal opacity-80">(Unclaim kartu ini saja - Akun user tetap utuh)</span>
                                    </button>
                                )}

                                {/* Option 2: Reset entire profile (affects all serials) */}
                                <button
                                    onClick={async () => {
                                        if (!window.confirm('PERINGATAN: Reset ini akan menghapus SEMUA isi profil user (bio, foto, links) yang berdampak ke SEMUA kartu miliknya. Lanjutkan?')) return
                                        const res = await fetch('/api/admin/users/delete', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: userToDelete.user_id, action: 'reset' })
                                        })
                                        const data = await res.json()
                                        if (data.error) alert('Gagal reset: ' + data.error)
                                        else {
                                            alert('Seluruh isi profil user berhasil di-reset.')
                                            setUserToDelete(null)
                                            if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                        }
                                    }}
                                    className="w-full py-4 bg-amber-100 text-amber-800 text-sm font-bold rounded-2xl hover:bg-amber-200 transition-all border border-amber-200 flex flex-col items-center gap-1"
                                >
                                    <span className="uppercase tracking-widest">RESET SELURUH PROFIL</span>
                                    <span className="text-[10px] font-normal opacity-80">(Hapus foto, bio, link SEMUA kartu user - Akun tetap ada)</span>
                                </button>

                                {/* Option 2: Full Delete */}
                                <button
                                    onClick={async () => {
                                        const res = await fetch('/api/admin/users/delete', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: userToDelete.user_id, action: 'delete' })
                                        })
                                        const data = await res.json()

                                        if (data.error) {
                                            if (data.error.toLowerCase().includes('service role')) {
                                                alert('ERROR KRITIKAL: SUPABASE_SERVICE_ROLE_KEY belum dipasang di environment server. Fitur hapus akun tidak bisa jalan tanpa key ini.')
                                            } else {
                                                alert('Gagal hapus akun: ' + data.error)
                                            }
                                        } else {
                                            alert('Akun berhasil dihapus selamanya.')
                                            setUserToDelete(null)
                                            if (adminRole) await loadAllData(adminRole, adminCompanyId)
                                        }
                                    }}
                                    className="w-full py-4 bg-red-600 text-white text-sm font-black rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex flex-col items-center gap-1"
                                >
                                    <span className="uppercase tracking-widest">HAPUS PERMANEN</span>
                                    <span className="text-[10px] font-normal opacity-80">(Hapus user & putuskan serial number)</span>
                                </button>

                                <button
                                    onClick={() => setUserToDelete(null)}
                                    className="w-full py-3 bg-zinc-100 text-zinc-500 text-sm font-bold rounded-2xl hover:bg-zinc-200 transition-all uppercase tracking-widest mt-2"
                                >
                                    BATALKAN
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Isian kado — dipakai tim; pembeli membuka isian yang sama lewat tautan rahasia */}
            {giftSerial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900">Mode Kado</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    Kejutan yang muncul saat jam ini pertama kali ditempel penerima.
                                </p>
                            </div>
                            <button onClick={() => setGiftSerial(null)} className="p-2 text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {giftSerial.is_claimed && (
                            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                                Kartu ini sudah diklaim, jadi kejutannya tidak muncul lagi saat di-tap — cuma tersimpan
                                sebagai kenangan di dashboard pemiliknya.
                            </p>
                        )}
                        {giftSerial.gift_opened_at && (
                            <p className="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                                Sudah dibuka penerimanya pada {new Date(giftSerial.gift_opened_at).toLocaleString('id-ID')}.
                                Pembeli tidak bisa mengubahnya lagi dari tautan isian.
                            </p>
                        )}

                        <label className="mt-5 block text-xs font-medium uppercase text-zinc-500 mb-1.5">Link video kejutan</label>
                        <input
                            type="text"
                            value={giftForm.url}
                            onChange={(e) => setGiftForm({ ...giftForm, url: e.target.value })}
                            placeholder="youtube.com/watch?v=..."
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-zinc-400"
                        />

                        <label className="mt-4 block text-xs font-medium uppercase text-zinc-500 mb-1.5">Pesan buat penerima</label>
                        <textarea
                            value={giftForm.message}
                            onChange={(e) => setGiftForm({ ...giftForm, message: e.target.value })}
                            rows={3}
                            maxLength={300}
                            placeholder="Selamat ulang tahun!"
                            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-zinc-400"
                        />

                        <label className="mt-4 block text-xs font-medium uppercase text-zinc-500 mb-1.5">Dari siapa</label>
                        <input
                            type="text"
                            value={giftForm.from}
                            onChange={(e) => setGiftForm({ ...giftForm, from: e.target.value })}
                            placeholder="Nama pengirim"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-zinc-400"
                        />

                        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <p className="text-[11px] font-medium uppercase text-zinc-500">Tautan isian buat pembeli</p>
                            <div className="mt-2 flex items-center gap-2">
                                <code className="flex-1 truncate rounded-lg bg-white border border-zinc-200 px-3 py-2 text-[11px] text-zinc-600">
                                    {siteUrl}/gift/{giftSerial.gift_token}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`${siteUrl}/gift/${giftSerial.gift_token}`, `gift-${giftSerial.id}`)}
                                    className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
                                >
                                    {copiedId === `gift-${giftSerial.id}` ? 'Tersalin' : 'Salin'}
                                </button>
                            </div>
                            <p className="mt-2 text-[10px] text-zinc-400">
                                Kirim ke pembeli lewat WhatsApp/email supaya dia isi sendiri kejutannya.
                            </p>
                        </div>

                        <div className="mt-5 flex gap-2">
                            {giftSerial.gift_enabled && (
                                <button
                                    onClick={() => saveGift(false)}
                                    disabled={giftSaving}
                                    className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                                >
                                    Matikan kado
                                </button>
                            )}
                            <button
                                onClick={() => saveGift(true)}
                                disabled={giftSaving || !giftForm.url.trim()}
                                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                            >
                                {giftSaving ? 'Menyimpan...' : 'Simpan & aktifkan kado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden QR Code for processing download */}
            < div style={{ display: 'none' }} id="qr-download-svg" >
                {qrDownloadData && (
                    <QRCodeSVG
                        value={qrDownloadData.url}
                        size={400}
                        bgColor="#ffffff"
                        fgColor="#18181b"
                        level="Q"
                        includeMargin={false}
                    />
                )}
            </div >
        </div >
    )
}
