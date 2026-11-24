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
    IdCard,
    SlidersHorizontal,
    Ticket,
    Smartphone,
    Gift
} from 'lucide-react'
import Link from 'next/link' // Added Link import
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import { SPECIAL_EDITIONS, normalizeSpecialEditions } from '@/lib/special-greeting.mjs'
import { newGiftToken } from '@/lib/gift.mjs'
import { CatalogSettings, type CatalogItem } from '@/components/admin/CatalogSettings'
import { PromoPackagesPanel, type PromoPackage } from '@/components/admin/PromoPackagesPanel'
import { PROMO_TEMPLATES } from '@/lib/promo-packages.mjs'

interface SerialWithProfile {
    id: string
    serial_uuid: string
    product_name: string
    device_type_id: string | null
    event_id: string | null
    event_name: string | null
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
    // Hak akses & paket
    subscription_valid_until: string | null
    unlocked_templates: string[]
    feature_grants: string[]
    bundle_id: string | null
    promo_package_id: string | null
}

type SortField = 'created_at' | 'display_name' | 'nfc_tap_count' | 'view_count' | 'last_active'
type SortDir = 'asc' | 'desc'



// Helper to format relative date - Moved outside to keep component pure
const formatRelative = (d: string | null) => {
    if (!d) return '-'
    const now = Date.now()
    const diff = now - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `${mins} mnt lalu`
    if (mins < 1440) return `${Math.floor(mins / 60)} jam lalu`
    return `${Math.floor(mins / 1440)} hari lalu`
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

    const [activeTab, setActiveTab] = useState<'profiles' | 'companies' | 'features' | 'promos' | 'settings'>('profiles')
    const [promoPackages, setPromoPackages] = useState<PromoPackage[]>([])
    const [bulkBusy, setBulkBusy] = useState(false)
    const [generatePromoId, setGeneratePromoId] = useState('')
    const [generateBundleDeviceId, setGenerateBundleDeviceId] = useState('')
    const [userToDelete, setUserToDelete] = useState<any | null>(null)
    const [tierConfigs, setTierConfigs] = useState<any[]>([])
    const [serials, setSerials] = useState<SerialWithProfile[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [companies, setCompanies] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [generateCount, setGenerateCount] = useState(1)
    const [generateCompanyId, setGenerateCompanyId] = useState<string>('')
    const [deviceTypes, setDeviceTypes] = useState<CatalogItem[]>([])
    const [events, setEvents] = useState<CatalogItem[]>([])
    const [catalogError, setCatalogError] = useState('')
    const [assignmentSerial, setAssignmentSerial] = useState<SerialWithProfile | null>(null)
    const [assignmentSaving, setAssignmentSaving] = useState(false)
    const [assignmentError, setAssignmentError] = useState('')
    const [generateDeviceId, setGenerateDeviceId] = useState('')
    const [generateEventId, setGenerateEventId] = useState('')
    const [generateSource, setGenerateSource] = useState<'b2c' | 'company' | 'event'>('b2c')
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
        const { data: promoData } = role === 'super_admin'
            ? await supabase.from('promo_packages').select('*').order('created_at', { ascending: false })
            : { data: [] }

        let loadedDevices: CatalogItem[] = []
        let loadedEvents: CatalogItem[] = []
        try {
            const res = await fetch('/api/admin/catalogs')
            const catalog = await res.json()
            if (!res.ok) throw new Error(catalog.error)
            loadedDevices = catalog.device_types
            loadedEvents = catalog.events
            setCatalogError('')
        } catch (err) {
            setCatalogError(err instanceof Error ? err.message : 'Gagal memuat device/event')
        }
        setDeviceTypes(loadedDevices)
        setEvents(loadedEvents)

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
            // Preserve legacy company membership until the serial receives an explicit device/source assignment.
            const serialCompanyId = s.event_id ? null : s.device_type_id ? s.company_id : s.company_id || profile?.company_id
            const specialEditions = normalizeSpecialEditions(
                profile?.special_editions?.length ? profile.special_editions : s.special_editions?.length ? s.special_editions : s.special_edition || profile?.special_edition
            )
            return {
                id: s.id,
                serial_uuid: s.serial_uuid,
                product_name: loadedDevices.find(d => d.id === s.device_type_id)?.name || 'Belum ditentukan',
                device_type_id: s.device_type_id || null,
                event_id: s.event_id || null,
                event_name: loadedEvents.find(e => e.id === s.event_id)?.name || null,
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
                company_id: serialCompanyId || null,
                company_name: serialCompanyId ? companyMap.get(serialCompanyId)?.name : null,
                user_id: s.owner_id || null,
                gift_enabled: s.gift_enabled || false,
                gift_url: s.gift_url || null,
                gift_message: s.gift_message || null,
                gift_from: s.gift_from || null,
                gift_token: s.gift_token || null,
                gift_opened_at: s.gift_opened_at || null,
                subscription_valid_until: profile?.subscription_valid_until || null,
                unlocked_templates: Array.isArray(profile?.unlocked_templates) ? profile.unlocked_templates : [],
                feature_grants: Array.isArray(profile?.feature_grants) ? profile.feature_grants : [],
                bundle_id: s.bundle_id || null,
                promo_package_id: s.promo_package_id || null
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
        setPromoPackages((promoData || []) as PromoPackage[])
        setLoading(false)
    }

    const generateSerials = async () => {
        if (!generateDeviceId || (generateSource === 'company' && !generateCompanyId) || (generateSource === 'event' && !generateEventId)) {
            alert('Pilih device dan company/event tujuan terlebih dahulu')
            return
        }
        const destination = generateSource === 'company' ? companies.find(c => c.id === generateCompanyId)?.name : generateSource === 'event' ? events.find(e => e.id === generateEventId)?.name : 'Personal / B2C'
        const bundleName = generateBundleDeviceId ? deviceTypes.find(d => d.id === generateBundleDeviceId)?.name : null
        const what = bundleName
            ? `${generateCount} paket (${deviceTypes.find(d => d.id === generateDeviceId)?.name} + ${bundleName}, total ${generateCount * 2} serial)`
            : `${generateCount} serial ${deviceTypes.find(d => d.id === generateDeviceId)?.name}`
        if (!window.confirm(`Buat ${what} untuk ${destination}?`)) return
        setGenerating(true)

        try {
            const res = await fetch('/api/admin/serials/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    count: generateCount,
                    company_id: generateSource === 'company' ? generateCompanyId : null,
                    event_id: generateSource === 'event' ? generateEventId : null,
                    device_type_id: generateDeviceId,
                    special_edition: generateSpecialEdition || null,
                    promo_package_id: generatePromoId || null,
                    bundle_device_type_id: generateBundleDeviceId || null
                })
            })

            const data = await res.json()

            if (!res.ok) {
                alert('Gagal generate: ' + (data.error || 'Unknown error'))
            } else {
                alert(data.message || `${generateCount} serial berhasil dibuat!`)
                if (adminRole) await loadAllData(adminRole, adminCompanyId)
                setGenerateEventId('')
                setGenerateCompanyId('')
                setGenerateSpecialEdition('')
                setGenerateBundleDeviceId('')
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

    // Pasangkan / lepas bundel (jam + kartu: aktivasi sekali di salah satunya).
    const setBundle = async (pair: boolean) => {
        const ids = Array.from(selectedIds)
        if (pair && ids.length < 2) { alert('Pilih minimal 2 serial untuk dijadikan satu paket'); return }
        if (pair && !window.confirm(`Jadikan ${ids.length} serial ini satu paket? Aktivasi salah satunya akan mengaktifkan semuanya ke pemilik yang sama.`)) return
        setBulkBusy(true)
        const { data, error } = await createClient().rpc('nfc_admin_set_bundle', { p_serial_ids: ids, p_pair: pair })
        setBulkBusy(false)
        if (error || !data?.success) { alert('Gagal: ' + (data?.error || error?.message || 'Unknown error')); return }
        setSelectedIds(new Set())
        if (adminRole) await loadAllData(adminRole, adminCompanyId)
    }

    // Pasang paket promo ke serial terpilih ('' = lepas paket).
    const setSerialPromo = async (packageId: string) => {
        const ids = Array.from(selectedIds)
        const pkg = promoPackages.find(p => p.id === packageId)
        if (!window.confirm(pkg ? `Pasang paket "${pkg.name}" ke ${ids.length} serial? Berlaku saat serial itu diaktifkan (serial yang sudah aktif tidak berubah).` : `Lepas paket promo dari ${ids.length} serial?`)) return
        setBulkBusy(true)
        const { error } = await createClient().from('serial_numbers').update({ promo_package_id: packageId || null }).in('id', ids)
        setBulkBusy(false)
        if (error) { alert('Gagal: ' + error.message); return }
        setSelectedIds(new Set())
        if (adminRole) await loadAllData(adminRole, adminCompanyId)
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
        const headers = ['UUID', 'NFC URL', 'Device', 'Company', 'Event', 'Status', 'Nama', 'Email', 'WhatsApp', 'Views', 'Clicks', 'Taps', 'Last Active', 'Created']
        const rows = serials.map(s => [
            s.serial_uuid,
            `${siteUrl}/tap/${s.serial_uuid}`,
            s.product_name,
            s.company_name || '-',
            s.event_name || '-',
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
        const csv = [headers, ...rows].map(r => r.map(c => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')
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
                s.product_name.toLowerCase().includes(q) ||
                s.company_name?.toLowerCase().includes(q) ||
                s.event_name?.toLowerCase().includes(q)
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

    const TH = 'px-4 py-3.5 text-left text-[10px] font-medium uppercase tracking-wider text-ink-2'
    const BADGE = 'inline-flex w-fit items-center whitespace-nowrap gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium'
    const tierBadge = (tier: string | null) => tier === 'PREMIUM' ? 'bg-coral-soft text-coral-soft-ink' : tier === 'B2B' ? 'bg-sky/40 text-ink' : 'bg-fill-subtle text-ink-2'
    const ICON_BTN = 'rounded-full p-2 text-ink-2 transition-colors hover:bg-fill-subtle hover:text-ink'

    const renderSerialsTable = () => (
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-hairline">
                            <th className="w-10 px-4 py-3.5 text-left">
                                <input
                                    type="checkbox"
                                    aria-label="Pilih semua"
                                    checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded accent-ink"
                                />
                            </th>
                            <th className={TH}>UUID</th>
                            <th className={TH}>
                                <button onClick={() => toggleSort('display_name')} className="flex items-center gap-1 uppercase hover:text-ink">Profil <SortIcon field="display_name" /></button>
                            </th>
                            <th className={TH}>Status</th>
                            <th className={TH}>Perangkat</th>
                            <th className={TH}>
                                <button onClick={() => toggleSort('nfc_tap_count')} className="flex items-center gap-1 uppercase hover:text-ink">Trafik <SortIcon field="nfc_tap_count" /></button>
                            </th>
                            <th className={TH}>
                                <button onClick={() => toggleSort('last_active')} className="flex items-center gap-1 uppercase hover:text-ink">Aktif <SortIcon field="last_active" /></button>
                            </th>
                            <th className={TH}>Langganan</th>
                            <th className={`${TH} text-right`}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-16 text-center text-[13px] text-ink-2">
                                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-ink-3" />
                                    Memuat...
                                </td>
                            </tr>
                        ) : filteredAndSorted.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-16 text-center text-[13px] text-ink-2">Tidak ada data ditemukan</td>
                            </tr>
                        ) : (
                            filteredAndSorted.map((serial) => (
                                <tr key={serial.id} className={`align-top transition-colors ${selectedIds.has(serial.id) ? 'bg-fill-subtle' : 'hover:bg-fill-subtle/60'}`}>
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            aria-label={`Pilih ${serial.serial_uuid}`}
                                            checked={selectedIds.has(serial.id)}
                                            onChange={() => toggleSelect(serial.id)}
                                            className="h-4 w-4 rounded accent-ink"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <code className="block w-fit whitespace-nowrap rounded-lg bg-fill-subtle px-2 py-1 font-mono text-[10.5px] text-ink" title={serial.serial_uuid}>
                                            {serial.serial_uuid.substring(0, 13)}…
                                        </code>
                                        <span className="mt-1 block text-[10.5px] text-ink-3">{formatDate(serial.created_at)}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {serial.is_claimed && serial.display_name ? (
                                            <div className="flex items-start gap-2.5">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[12px] font-semibold text-avatar-ink">
                                                    {serial.display_name[0]?.toUpperCase()}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate text-[13px] font-semibold">{serial.display_name}</p>
                                                    {serial.email && <p className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-2"><Mail className="h-3 w-3 shrink-0" strokeWidth={1.8} />{serial.email}</p>}
                                                    {serial.whatsapp && <p className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-2"><Phone className="h-3 w-3 shrink-0" strokeWidth={1.8} />{serial.whatsapp}</p>}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[12px] italic text-ink-3">Belum diklaim</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`${BADGE} ${serial.is_claimed ? 'bg-success-soft text-success-soft-ink' : 'bg-butter/40 text-ink'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${serial.is_claimed ? 'bg-success-soft-ink' : 'bg-ink-2'}`} />
                                            {serial.is_claimed ? 'Diklaim' : 'Belum'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[12.5px] font-medium">{serial.product_name}</span>
                                            <button
                                                onClick={() => toggleSync(serial.id, serial.sync_enabled)}
                                                className={`${BADGE} ${serial.sync_enabled !== false ? 'bg-sky/35 text-ink' : 'bg-fill-subtle text-ink-2'} hover:opacity-80`}
                                                title={serial.sync_enabled !== false ? 'Ikut profil utama' : 'Profil sendiri'}
                                            >
                                                {serial.sync_enabled !== false ? 'Sinkron' : 'Mandiri'}
                                            </button>
                                            {serial.event_name && <span className="text-[11px] text-ink-2">Event: {serial.event_name}</span>}
                                            {serial.bundle_id && (
                                                <span className="text-[11px] text-ink-2" title={`Paket ${serial.bundle_id}`}>
                                                    🔗 Paket dengan {serials.filter(o => o.bundle_id === serial.bundle_id && o.id !== serial.id).map(o => o.product_name).join(', ') || '—'}
                                                </span>
                                            )}
                                            {serial.promo_package_id && (
                                                <span className="text-[11px] text-coral-soft-ink">🎁 {promoPackages.find(p => p.id === serial.promo_package_id)?.name || 'Promo'}</span>
                                            )}
                                            {serial.company_name && (
                                                <span className="max-w-[160px] truncate text-[11px] text-ink-2" title={serial.company_name}>🏢 {serial.company_name}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-[11.5px] text-ink-2">
                                        <p className="flex items-center gap-1.5"><Eye className="h-3 w-3" strokeWidth={1.8} /><span className="font-medium text-ink">{serial.view_count}</span> dilihat</p>
                                        <p className="mt-0.5 flex items-center gap-1.5"><Activity className="h-3 w-3" strokeWidth={1.8} /><span className="font-medium text-ink">{serial.nfc_tap_count}</span> tap</p>
                                        <p className="mt-0.5 pl-[18px]">{serial.link_clicks} klik</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-ink-2">
                                            <Clock className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.8} />{formatRelative(serial.last_active)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            {serial.is_claimed && (
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className={`${BADGE} font-semibold ${tierBadge(serial.tier)}`}>{serial.tier}</span>
                                                    {serial.tier === 'PREMIUM' && (
                                                        <span className={`${BADGE} bg-fill-subtle text-ink-2`} title="Premium berlaku sampai">
                                                            {serial.subscription_valid_until ? `s/d ${new Date(serial.subscription_valid_until).toLocaleDateString('id-ID')}` : 'tanpa batas'}
                                                        </span>
                                                    )}
                                                    {serial.user_tag && <span className={`${BADGE} bg-butter/40 text-ink`}>{serial.user_tag}</span>}
                                                </div>
                                            )}
                                            {serial.special_editions.length > 0 && (
                                                <span className={`${BADGE} bg-moss/40 text-ink`}>✨ {getSpecialEditionLabels(serial.special_editions)}</span>
                                            )}
                                            <button onClick={() => setEditUser(serial)} className="w-fit text-[11.5px] font-medium text-coral hover:underline">
                                                {serial.is_claimed ? 'Atur langganan' : 'Atur kartu'}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-0.5">
                                            {adminRole === 'super_admin' && <button onClick={() => { setAssignmentSerial(serial); setAssignmentError('') }} title="Atur device dan sumber akun" className={ICON_BTN}><Settings className="h-4 w-4" strokeWidth={1.8} /></button>}
                                            <button onClick={() => downloadQR(serial.serial_uuid, serial.display_name || undefined)} className={ICON_BTN} title="Unduh QR Code">
                                                <QrCode className="h-4 w-4" strokeWidth={1.8} />
                                            </button>
                                            <button
                                                onClick={() => openGift(serial)}
                                                className={serial.gift_enabled ? 'rounded-full bg-coral-soft p-2 text-coral-soft-ink' : ICON_BTN}
                                                title={serial.gift_enabled ? 'Kado aktif — klik untuk ubah' : 'Atur mode kado'}
                                            >
                                                <Gift className="h-4 w-4" strokeWidth={1.8} />
                                            </button>
                                            <button onClick={() => copyToClipboard(`${siteUrl}/tap/${serial.serial_uuid}`, serial.id)} className={ICON_BTN} title="Salin URL NFC">
                                                {copiedId === serial.id ? <Check className="h-4 w-4 text-success-soft-ink" strokeWidth={1.8} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
                                            </button>
                                            {adminRole === 'super_admin' && (
                                                <button onClick={() => setDeleteConfirm(serial.id)} className="rounded-full p-2 text-ink-3 transition-colors hover:bg-coral-soft hover:text-coral-soft-ink" title="Hapus">
                                                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
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
            <div className="flex items-center justify-between border-t border-hairline px-5 py-3 text-[11.5px] text-ink-2">
                <span>Menampilkan {filteredAndSorted.length} dari {serials.length} serial</span>
                <span>Urutan: {sortField} ({sortDir === 'asc' ? 'naik' : 'turun'})</span>
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
            { key: 'basic_features', label: 'Link & info dasar', description: 'Fitur link-in-bio standar' },
            { key: 'social_impact', label: 'Dampak sosial (hijau)', description: 'Tampilkan statistik dampak hijau' },
            { key: 'ai_content', label: 'AI bio & avatar', description: 'Buat bio dan avatar dengan AI' },
            { key: 'ai_bot', label: 'AI Digital Rep', description: 'Perwakilan AI otomatis' },
            { key: 'analytics_leads', label: 'Analytics & Leads', description: 'Analitik lengkap dan formulir leads' },
            { key: 'sync', label: 'Sinkron banyak profil', description: 'Sinkron isi di beberapa perangkat' },
            { key: 'custom_branding', label: 'Branding sendiri', description: 'Logo dan tema seragam perusahaan' },
            { key: 'company_dashboard', label: 'Dashboard perusahaan', description: 'Dashboard khusus B2B' },
            { key: 'asset_management', label: 'Kelola aset', description: 'Pindahkan perangkat ke karyawan' }
        ]

        // Selalu tampilkan 3 kolom walau database kosong
        const tiers = ['FREE', 'PREMIUM', 'B2B']

        return (
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hairline">
                                <th className={`${TH} w-1/2 px-5`}>Fitur</th>
                                {tiers.map(tier => (
                                    <th key={tier} className={`${TH} text-center`}>
                                        <span className={`${BADGE} font-semibold ${tierBadge(tier)}`}>{tier}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                            {featureKeys.map((feature) => (
                                <tr key={feature.key} className="transition-colors hover:bg-fill-subtle/60">
                                    <td className="px-5 py-4">
                                        <p className="text-[13px] font-medium">{feature.label}</p>
                                        <p className="text-[11.5px] text-ink-2">{feature.description}</p>
                                    </td>
                                    {tiers.map(tier => {
                                        const config = tierConfigs.find(t => t.tier === tier)
                                        const isEnabled = config?.features?.[feature.key] || false
                                        return (
                                            <td key={`${tier}-${feature.key}`} className="px-4 py-4 text-center">
                                                <button
                                                    role="switch"
                                                    aria-checked={isEnabled}
                                                    aria-label={`${feature.label} untuk ${tier}`}
                                                    onClick={() => toggleFeature(tier, feature.key, isEnabled)}
                                                    className={`inline-flex h-[26px] w-[46px] items-center rounded-full p-[3px] transition-colors ${isEnabled ? 'bg-ink' : 'bg-track'}`}
                                                >
                                                    <span className={`h-5 w-5 rounded-full bg-white shadow-row transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderUsersTable = () => (
        <div className="bg-surface border border-hairline rounded-card overflow-hidden shadow-row">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-surface border-b border-hairline">
                            <th className="text-left px-4 py-4 text-xs font-semibold text-ink-2 uppercase">User</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-ink-2 uppercase">Tier</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-ink-2 uppercase">Company</th>
                            <th className="text-left px-4 py-4 text-xs font-semibold text-ink-2 uppercase">Last Active</th>
                            <th className="text-right px-4 py-4 text-xs font-semibold text-ink-2 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-ink-3 font-medium">Loading users...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-ink-3 font-medium">No users found</td></tr>
                        ) : (
                            users.filter(u =>
                                !searchTerm ||
                                u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map(user => (
                                <tr key={user.user_id} className="hover:bg-fill-subtle">
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-ink">{user.display_name || 'Anonymous'}</span>
                                            <span className="text-xs text-ink-2">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`${BADGE} font-semibold ${tierBadge(user.tier)}`}>
                                            {user.tier}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-ink-2">{user.company_name || '-'}</td>
                                    <td className="px-4 py-4 text-xs text-ink-2">{formatRelative(user.updated_at)}</td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button onClick={() => setEditUser(user)} className="p-2 hover:bg-coral-soft rounded-lg transition-colors text-coral" title="Edit Subscription">
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setUserToDelete(user)} className="p-2 hover:bg-coral-soft rounded-lg transition-colors text-coral-soft-ink" title="Delete Account">
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
        <div>
            <div className="mb-4 flex justify-end">
                <button onClick={() => setEditCompany({})} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]">
                    <Plus className="h-4 w-4" strokeWidth={1.8} /> Perusahaan baru
                </button>
            </div>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
                {companies.length === 0 && <p className="px-5 py-10 text-center text-[13px] text-ink-2">Belum ada perusahaan.</p>}
                <ul className="divide-y divide-hairline">
                    {companies.map(c => (
                        <li key={c.id} className="flex items-center gap-3 px-5 py-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill-subtle text-ink-2">
                                {c.logo_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={c.logo_url} alt="" className="h-full w-full object-cover" />
                                    : <Building className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-semibold">{c.name}</p>
                                <p className="truncate text-[11.5px] text-ink-2">{c.website || 'Tanpa website'} · {serials.filter(s => s.company_id === c.id).length} perangkat</p>
                            </div>
                            <button onClick={() => setEditCompany(c)} className="rounded-full bg-fill-subtle px-4 py-2 text-[12px] font-medium hover:bg-track">Ubah</button>
                            <button onClick={() => deleteCompany(c.id)} aria-label={`Hapus ${c.name}`} className="rounded-full p-2 text-ink-3 hover:bg-coral-soft hover:text-coral-soft-ink"><Trash2 className="h-4 w-4" strokeWidth={1.8} /></button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )

    const FIELD = 'w-full rounded-row bg-fill-subtle px-4 py-3 text-[13px] text-ink outline-none transition-colors focus:bg-surface focus:ring-1 focus:ring-ink/15 disabled:opacity-50'
    const PILL = 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-medium text-ink shadow-row transition-colors hover:bg-white disabled:opacity-50'

    if (!authCheckComplete) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-4 font-kabut text-ink">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-ink-3" />
                    <p className="text-[13px] text-ink-2">Memverifikasi akses...</p>
                </div>
            </div>
        )
    }

    if (!adminRole) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 font-kabut text-ink">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm rounded-card bg-surface p-8 text-center shadow-card"
                >
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink">
                        <ShieldAlert className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em]">Akses khusus</h1>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                        Halaman ini untuk admin. Masuk pakai email admin yang sudah terdaftar (Super Admin atau Admin Perusahaan).
                    </p>
                    <button
                        onClick={async () => {
                            const { createClient } = await import('@/lib/supabase/client')
                            const supabase = createClient()
                            await supabase.auth.signOut()
                            window.location.href = '/login?next=/admin'
                        }}
                        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                    >
                        <User className="h-4 w-4" strokeWidth={1.8} /> Masuk sebagai admin
                    </button>
                    <Link href="/" className="mt-3 block py-2 text-[12.5px] text-ink-2 hover:text-ink">Kembali ke beranda</Link>
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

    const ADMIN_TABS = [
        { id: 'profiles', label: 'Serial & Pelanggan', icon: IdCard, title: 'Serial & Pelanggan', subtitle: 'Buat serial, pantau klaim, dan atur langganan pelanggan' },
        { id: 'companies', label: 'Perusahaan', icon: Building, title: 'Perusahaan', subtitle: 'Akun B2B, admin perusahaan, dan perangkat karyawan' },
        { id: 'features', label: 'Fitur Tier', icon: SlidersHorizontal, title: 'Fitur per tier', subtitle: 'Fitur yang terbuka untuk Free, Premium, dan B2B' },
        { id: 'promos', label: 'Promo', icon: Ticket, title: 'Paket promo', subtitle: 'Hak yang diberikan otomatis saat pelanggan mengaktifkan perangkat' },
        { id: 'settings', label: 'Pengaturan', icon: Settings, title: 'Pengaturan', subtitle: 'Jenis device dan event untuk pembuatan serial' },
    ] as const
    const visibleTabs = ADMIN_TABS.filter(tab => adminRole === 'super_admin' || tab.id === 'profiles')
    const currentTab = ADMIN_TABS.find(tab => tab.id === activeTab) || ADMIN_TABS[0]

    // ─── Admin (arah desain Kabut, sama dengan dashboard pelanggan) ───
    return (
        <div className="min-h-screen bg-canvas font-kabut text-ink">
            <div className="mx-auto max-w-[1200px] px-5 pb-[140px] pt-5">
                {/* Bar atas */}
                <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[11.5px] font-medium text-ink-2 shadow-row">
                        <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Gentanala · {adminRole === 'super_admin' ? 'Super Admin' : 'Admin Perusahaan'}
                    </span>
                    <button onClick={handleLogoutAdmin} className={PILL}>
                        <LogOut className="h-4 w-4" strokeWidth={1.8} /> Keluar
                    </button>
                </div>

                <header className="mt-6">
                    <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{currentTab.title}</h1>
                    <p className="mt-1.5 text-[13px] text-ink-2">{currentTab.subtitle}</p>
                </header>

                {catalogError && <p role="alert" className="mt-4 rounded-row bg-coral-soft px-4 py-3 text-[12.5px] text-coral-soft-ink">{catalogError}</p>}

                <div className="mt-6">
                    {activeTab === 'promos' && adminRole === 'super_admin' && (
                        <PromoPackagesPanel
                            packages={promoPackages}
                            serialCounts={serials.reduce<Record<string, number>>((acc, s) => {
                                if (s.promo_package_id) acc[s.promo_package_id] = (acc[s.promo_package_id] || 0) + 1
                                return acc
                            }, {})}
                            onSaved={() => loadAllData(adminRole, adminCompanyId)}
                        />
                    )}
                    {activeTab === 'settings' && adminRole === 'super_admin' && (
                        <div className="grid gap-5 md:grid-cols-2">
                            <CatalogSettings kind="device_types" title="Jenis Device" items={deviceTypes} onSaved={() => loadAllData(adminRole, adminCompanyId)} />
                            <CatalogSettings kind="events" title="Events" items={events} onSaved={() => loadAllData(adminRole, adminCompanyId)} />
                        </div>
                    )}

                    {activeTab === 'profiles' && (
                        <>
                            {/* Ringkasan */}
                            <section className="grid grid-cols-2 gap-y-6 rounded-card bg-surface px-3 py-6 shadow-card md:grid-cols-4">
                                {[
                                    { icon: Package, tone: 'bg-fill-subtle text-ink-2', val: serials.length, label: 'Total serial' },
                                    { icon: Check, tone: 'bg-success-soft text-success-soft-ink', val: serials.filter(s => s.is_claimed).length, label: 'Sudah diklaim' },
                                    { icon: Eye, tone: 'bg-sky/35 text-ink', val: serials.reduce((a, s) => a + s.view_count, 0), label: 'Total dilihat' },
                                    { icon: Activity, tone: 'bg-coral-soft text-coral-soft-ink', val: serials.reduce((a, s) => a + s.nfc_tap_count, 0), label: 'Total tap' },
                                ].map(stat => (
                                    <div key={stat.label} className="flex flex-col items-center px-2 text-center">
                                        <span className={`flex h-9 w-9 items-center justify-center rounded-row ${stat.tone}`}>
                                            <stat.icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                                        </span>
                                        <p className="mt-2.5 text-[10px] font-medium uppercase leading-tight tracking-wider text-ink-2">{stat.label}</p>
                                        <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={stat.val} /></p>
                                    </div>
                                ))}
                            </section>

                            {/* Buat serial */}
                            {adminRole === 'super_admin' && (
                                <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-row bg-fill-subtle text-ink-2"><Plus className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                                        <div>
                                            <h2 className="text-[15px] font-semibold">Buat serial</h2>
                                            <p className="text-[12px] text-ink-2">UUID baru untuk diprogram ke chip NFC</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Jumlah
                                            <input type="number" min="1" max="100" value={generateCount} onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)} className={`${FIELD} mt-1.5 normal-case tracking-normal`} />
                                        </label>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Device
                                            <select aria-label="Jenis device" value={generateDeviceId} onChange={e => setGenerateDeviceId(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Pilih device</option>
                                                {deviceTypes.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Sumber akun
                                            <select aria-label="Sumber akun" value={generateSource} onChange={e => { setGenerateSource(e.target.value as 'b2c' | 'company' | 'event'); setGenerateCompanyId(''); setGenerateEventId('') }} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="b2c">Personal / B2C</option>
                                                <option value="company">Company</option>
                                                <option value="event">Event</option>
                                            </select>
                                        </label>
                                        {generateSource === 'company' && <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Company
                                            <select aria-label="Company tujuan" value={generateCompanyId} onChange={e => setGenerateCompanyId(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Pilih company</option>
                                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </label>}
                                        {generateSource === 'event' && <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Event
                                            <select aria-label="Event tujuan" value={generateEventId} onChange={e => setGenerateEventId(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Pilih event</option>
                                                {events.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                        </label>}
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Edisi
                                            <select aria-label="Edisi spesial" value={generateSpecialEdition} onChange={(e) => setGenerateSpecialEdition(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Standard</option>
                                                <option value="aruna">Aruna Series</option>
                                                <option value="prabowo">Prabowo Series</option>
                                            </select>
                                        </label>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Paket dengan
                                            <select aria-label="Pasangan paket" value={generateBundleDeviceId} onChange={e => setGenerateBundleDeviceId(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Tidak (satuan)</option>
                                                {deviceTypes.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Promo
                                            <select aria-label="Paket promo" value={generatePromoId} onChange={e => setGeneratePromoId(e.target.value)} className={`${FIELD} mt-1.5 normal-case tracking-normal`}>
                                                <option value="">Ikut paket umum</option>
                                                {promoPackages.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_active ? '' : ' (mati)'}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={generateSerials}
                                            disabled={generating || !!catalogError || !generateDeviceId || (generateSource === 'company' && !generateCompanyId) || (generateSource === 'event' && !generateEventId)}
                                            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99] disabled:opacity-40"
                                        >
                                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.8} />}
                                            Buat serial
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* Cari, saring, dan aksi */}
                            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Cari UUID, nama, email, device, company, event..."
                                        className="w-full rounded-full bg-surface py-3 pl-11 pr-4 text-[13px] text-ink shadow-row outline-none placeholder:text-ink-3 focus:ring-1 focus:ring-ink/15"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1 rounded-full bg-fill-subtle p-1">
                                    {([['all', 'Semua'], ['claimed', 'Diklaim'], ['unclaimed', 'Belum']] as const).map(([status, label]) => (
                                        <button
                                            key={status}
                                            onClick={() => setFilterStatus(status)}
                                            className={`rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors ${filterStatus === status ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={exportCSV} className={PILL}><Download className="h-4 w-4" strokeWidth={1.8} /> Export CSV</button>
                                    <button onClick={() => adminRole && loadAllData(adminRole, adminCompanyId)} className={PILL} aria-label="Muat ulang">
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>

                            {selectedIds.size > 0 && adminRole === 'super_admin' && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center gap-2 rounded-card-sm bg-ink px-4 py-3 text-white shadow-ink">
                                    <span className="mr-1 text-[12.5px] font-medium">{selectedIds.size} dipilih</span>
                                    <button onClick={() => setBundle(true)} disabled={bulkBusy} className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-medium hover:bg-white/20 disabled:opacity-50">Jadikan paket</button>
                                    <button onClick={() => setBundle(false)} disabled={bulkBusy} className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-medium hover:bg-white/20 disabled:opacity-50">Lepas paket</button>
                                    <select aria-label="Set paket promo" value="" disabled={bulkBusy} onChange={e => { if (e.target.value !== '__') void setSerialPromo(e.target.value === '__none' ? '' : e.target.value) }} className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white outline-none [&>option]:text-ink">
                                        <option value="" disabled>Set promo…</option>
                                        {promoPackages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        <option value="__none">Lepas promo</option>
                                    </select>
                                    <button onClick={() => setBulkDeleteConfirm(true)} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] font-medium text-white hover:bg-coral/90">
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Hapus
                                    </button>
                                    <button onClick={() => setSelectedIds(new Set())} aria-label="Batalkan pilihan" className="ml-auto rounded-full p-2 hover:bg-white/10">
                                        <X className="h-4 w-4" strokeWidth={1.8} />
                                    </button>
                                </motion.div>
                            )}
                            <div className="mt-5" />
                        </>
                    )}

                    {renderContent()}

                    {activeTab === 'profiles' && (
                        <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-row bg-fill-subtle text-ink-2"><FileText className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                                <h3 className="text-[15px] font-semibold">Cara pakai</h3>
                            </div>
                            <ol className="mt-3 list-inside list-decimal space-y-1.5 text-[12.5px] leading-relaxed text-ink-2">
                                <li>Buat serial baru lewat kartu <strong className="font-medium text-ink">Buat serial</strong>.</li>
                                <li>Klik <strong className="font-medium text-ink">Export CSV</strong> untuk mengunduh daftar.</li>
                                <li>Kirim file CSV ke vendor NFC untuk diprogram ke chip.</li>
                                <li>Vendor memprogram tiap chip dengan URL <code className="rounded bg-fill-subtle px-1.5 py-0.5 text-[11.5px] text-ink">{'domain'}/tap/[uuid]</code>.</li>
                                <li>Saat pelanggan tap, mereka diarahkan ke halaman klaim.</li>
                            </ol>
                        </section>
                    )}
                </div>
            </div>

            {/* Navigasi bawah, sama seperti dashboard pelanggan */}
            {visibleTabs.length > 1 && (
                <div className="fixed bottom-6 left-[22px] right-[22px] z-50 md:left-1/2 md:w-[420px] md:-translate-x-1/2">
                    <nav aria-label="Navigasi admin" className="h-[68px] rounded-full border border-white/80 bg-white/[0.72] px-2 shadow-nav backdrop-blur-[26px] backdrop-saturate-[1.7]">
                        <ul className="flex h-full items-center justify-around">
                            {visibleTabs.map(tab => {
                                const active = activeTab === tab.id
                                return (
                                    <li key={tab.id}>
                                        <button
                                            onClick={() => setActiveTab(tab.id)}
                                            aria-current={active ? 'page' : undefined}
                                            aria-label={tab.label}
                                            title={tab.label}
                                            className={`flex h-[50px] w-[50px] items-center justify-center rounded-full transition-colors ${active ? 'bg-ink/[0.08] text-ink' : 'text-ink-2 hover:text-ink'}`}
                                        >
                                            <tab.icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </nav>
                </div>
            )}

            {assignmentSerial && adminRole === 'super_admin' && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
                <form onSubmit={async e => {
                    e.preventDefault()
                    setAssignmentSaving(true)
                    setAssignmentError('')
                    try {
                        const res = await fetch('/api/admin/serials/assignment', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: assignmentSerial.id, device_type_id: assignmentSerial.device_type_id, company_id: assignmentSerial.company_id, event_id: assignmentSerial.event_id }) })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error)
                        await loadAllData(adminRole, adminCompanyId)
                        setAssignmentSerial(null)
                    } catch (err) { setAssignmentError(err instanceof Error ? err.message : 'Gagal menyimpan') }
                    finally { setAssignmentSaving(false) }
                }} className="w-full max-w-md space-y-4 rounded-card bg-surface p-6 shadow-card">
                    <h2 className="text-lg font-semibold">Device dan Sumber Akun</h2>
                    <p className="break-all text-xs text-ink-2">{assignmentSerial.serial_uuid}</p>
                    <label className="block text-sm">Jenis device
                        <select required disabled={assignmentSaving} value={assignmentSerial.device_type_id || ''} onChange={e => setAssignmentSerial({ ...assignmentSerial, device_type_id: e.target.value || null })} className="mt-1 w-full rounded-lg border border-hairline p-2">
                            <option value="">Pilih device</option>
                            {deviceTypes.filter(d => d.is_active || d.id === assignmentSerial.device_type_id).map(d => <option key={d.id} value={d.id}>{d.name}{!d.is_active ? ' (Nonaktif)' : ''}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Company
                        <select disabled={assignmentSaving} value={assignmentSerial.company_id || ''} onChange={e => setAssignmentSerial({ ...assignmentSerial, company_id: e.target.value || null, event_id: null })} className="mt-1 w-full rounded-lg border border-hairline p-2">
                            <option value="">Tanpa company</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Event
                        <select disabled={assignmentSaving} value={assignmentSerial.event_id || ''} onChange={e => setAssignmentSerial({ ...assignmentSerial, event_id: e.target.value || null, company_id: null })} className="mt-1 w-full rounded-lg border border-hairline p-2">
                            <option value="">Tanpa event</option>
                            {events.filter(ev => ev.is_active || ev.id === assignmentSerial.event_id).map(ev => <option key={ev.id} value={ev.id}>{ev.name}{!ev.is_active ? ' (Nonaktif)' : ''}</option>)}
                        </select>
                    </label>
                    <p className="text-xs text-ink-2">Pilih company atau event. Kosongkan keduanya untuk akun personal. Pengaturan ini berlaku untuk serial ini.</p>
                    {assignmentError && <p role="alert" className="text-sm text-coral-soft-ink">{assignmentError}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" disabled={assignmentSaving} onClick={() => setAssignmentSerial(null)} className="rounded-lg px-4 py-2 text-sm">Batal</button>
                        <button disabled={assignmentSaving || !!catalogError} className="rounded-lg bg-ink px-4 py-2 text-sm text-white disabled:opacity-50">{assignmentSaving ? 'Menyimpan...' : 'Simpan'}</button>
                    </div>
                </form>
            </div>}

            {/* Edit User Modal */}
            <AnimatePresence>
                {editUser && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-6 shadow-card focus:outline-none"
                        >
                            <h3 className="text-lg font-semibold mb-4">
                                {editUser.is_claimed ? 'Atur langganan' : 'Atur kartu belum diklaim'}
                            </h3>
                            <div className="space-y-4">
                                {editUser.display_name ? (
                                    <div className="p-3 bg-fill-subtle rounded-row border border-hairline mb-2">
                                        <p className="text-xs text-ink-2 uppercase font-semibold">User</p>
                                        <p className="text-sm font-semibold text-ink">{editUser.display_name}</p>
                                        <p className="text-xs text-ink-2">{editUser.email}</p>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-butter/40 rounded-row border border-hairline mb-2">
                                        <p className="text-xs text-ink uppercase font-semibold">Kartu belum diklaim</p>
                                        <p className="text-xs font-mono text-ink-2 truncate mt-1">UUID: {editUser.serial_uuid}</p>
                                    </div>
                                )}
                                {adminRole === 'super_admin' && (
                                    <>
                                        {editUser.is_claimed && (
                                            <>
                                                <div>
                                                    <label className="text-xs font-semibold text-ink-2 uppercase">Tier</label>
                                                    <select
                                                        value={editUser.tier || 'FREE'}
                                                        onChange={e => {
                                                            const tier = e.target.value
                                                            // Naik ke Premium dengan tanggal lama yang sudah lewat: mulai dari tanpa batas.
                                                            const expired = editUser.subscription_valid_until && new Date(editUser.subscription_valid_until) < new Date()
                                                            setEditUser({ ...editUser, tier, subscription_valid_until: tier === 'PREMIUM' && expired ? null : editUser.subscription_valid_until })
                                                        }}
                                                        className="w-full mt-1 p-2.5 bg-fill-subtle border border-hairline rounded-row text-sm focus:ring-2 focus:ring-ink/10 outline-none"
                                                    >
                                                        <option value="FREE">Free</option>
                                                        <option value="PREMIUM">Premium</option>
                                                        <option value="B2B">B2B</option>
                                                    </select>
                                                </div>
                                                {editUser.tier === 'PREMIUM' && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-ink-2 uppercase">Premium berlaku sampai</label>
                                                        <div className="mt-1 flex items-center gap-3">
                                                            <input
                                                                type="date"
                                                                aria-label="Premium berlaku sampai"
                                                                disabled={!editUser.subscription_valid_until}
                                                                value={editUser.subscription_valid_until ? editUser.subscription_valid_until.slice(0, 10) : ''}
                                                                onChange={e => setEditUser({ ...editUser, subscription_valid_until: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })}
                                                                className="flex-1 p-2.5 bg-fill-subtle border border-hairline rounded-row text-sm outline-none disabled:opacity-50"
                                                            />
                                                            <label className="flex items-center gap-1.5 text-sm text-ink">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!editUser.subscription_valid_until}
                                                                    onChange={e => setEditUser({ ...editUser, subscription_valid_until: e.target.checked ? null : new Date(Date.now() + 30 * 86400000).toISOString() })}
                                                                />
                                                                Tanpa batas
                                                            </label>
                                                        </div>
                                                        {editUser.subscription_valid_until && new Date(editUser.subscription_valid_until) < new Date() && (
                                                            <p className="mt-1 text-[11px] text-ink">Tanggal ini sudah lewat, jadi pelanggan diperlakukan Free.</p>
                                                        )}
                                                    </div>
                                                )}
                                                {PROMO_TEMPLATES.length > 0 && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-ink-2 uppercase">Tema eksklusif</label>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {PROMO_TEMPLATES.map((template: { id: string; name: string }) => (
                                                                <label key={template.id} className="flex items-center gap-2 rounded-row border border-hairline bg-fill-subtle px-3 py-2 text-sm text-ink">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(editUser.unlocked_templates || []).includes(template.id)}
                                                                        onChange={e => setEditUser({
                                                                            ...editUser,
                                                                            unlocked_templates: e.target.checked
                                                                                ? Array.from(new Set([...(editUser.unlocked_templates || []), template.id]))
                                                                                : (editUser.unlocked_templates || []).filter((id: string) => id !== template.id)
                                                                        })}
                                                                        className="h-4 w-4 rounded border-hairline text-coral"
                                                                    />
                                                                    {template.name}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-xs font-semibold text-ink-2 uppercase">Tag</label>
                                                    <select
                                                        value={editUser.user_tag || ''}
                                                        onChange={e => setEditUser({ ...editUser, user_tag: e.target.value || null })}
                                                        className="w-full mt-1 p-2.5 bg-fill-subtle border border-hairline rounded-row text-sm focus:ring-2 focus:ring-ink/10 outline-none"
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
                                            <label className="text-xs font-semibold text-ink-2 uppercase">Akses edisi spesial</label>
                                            <div className="mt-2 grid gap-2">
                                                {SPECIAL_EDITIONS.map((edition) => {
                                                    const currentEditions = normalizeSpecialEditions(editUser.special_editions?.length ? editUser.special_editions : editUser.special_edition)
                                                    const checked = currentEditions.includes(edition.id)

                                                    return (
                                                        <label key={edition.id} className="flex items-center gap-2 rounded-row border border-hairline bg-fill-subtle px-3 py-2 text-sm text-ink">
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
                                                                className="h-4 w-4 rounded border-hairline text-coral"
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
                                        <label className="text-xs font-semibold text-ink-2 uppercase">Perusahaan (khusus B2B)</label>
                                        <select
                                            value={editUser.company_id || ''}
                                            onChange={e => setEditUser({ ...editUser, company_id: e.target.value || null })}
                                            className="w-full mt-1 p-2.5 bg-fill-subtle border border-hairline rounded-row text-sm focus:ring-2 focus:ring-ink/10 outline-none"
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
                                            className="px-4 py-2 text-sm font-semibold text-coral-soft-ink bg-coral-soft hover:bg-coral-soft rounded-row transition-colors mr-auto"
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
                                            className="px-4 py-2 text-sm font-semibold text-ink bg-butter/40 hover:bg-amber-100 rounded-row transition-colors mr-auto ml-2"
                                        >
                                            Reset Profil
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setEditUser(null)}
                                        className="px-4 py-2 text-sm font-medium text-ink-2 hover:bg-fill-subtle rounded-row transition-colors"
                                    >
                                        Batal
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
                                                    // Hak berbayar hanya dikirim super admin untuk serial yang sudah dimiliki.
                                                    ...(adminRole === 'super_admin' && editUser.user_id ? {
                                                        tier: editUser.tier,
                                                        subscription_valid_until: editUser.subscription_valid_until || null,
                                                        unlocked_templates: editUser.unlocked_templates || [],
                                                    } : {}),
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
                                        className="px-6 py-2 bg-ink text-white text-sm font-semibold rounded-row hover:bg-ink/90 shadow-row transition-all"
                                    >
                                        Simpan
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 30, scale: 0.98 }}
                            className="bg-surface w-full max-w-6xl rounded-card shadow-card flex flex-col h-full max-h-[90vh] overflow-hidden"
                        >
                            {/* Dashboard Header */}
                            <div className="px-8 py-6 border-b border-hairline flex items-center justify-between bg-fill-subtle">
                                <div>
                                    <h3 className="text-2xl font-semibold text-ink flex items-center gap-3">
                                        <Building className="w-7 h-7 text-coral" />
                                        {editCompany.id ? 'Company Dashboard' : 'Registrasi Company Baru'}
                                    </h3>
                                    <p className="text-sm text-ink-2 mt-1 ml-10">Kelola identitas, delegasi admin, serta perangkat yang terhubung.</p>
                                </div>
                                <button
                                    onClick={() => setEditCompany(null)}
                                    className="p-2.5 bg-surface border border-hairline hover:bg-fill-subtle rounded-full transition-colors text-ink-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 grid lg:grid-cols-2 gap-10">
                                {/* Left Column: Main Information */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-6 border-b border-hairline pb-3">
                                        <div className="w-8 h-8 rounded-lg bg-coral-soft flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-coral" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-ink">Informasi Utama</h4>
                                    </div>

                                    <div className="grid gap-5">
                                        <div>
                                            <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Company Name</label>
                                            <input
                                                type="text"
                                                value={editCompany.name || ''}
                                                onChange={e => setEditCompany({ ...editCompany, name: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-fill-subtle border border-hairline focus:border-ink-3 focus:ring-1 focus:ring-ink/10 transition-all rounded-row text-sm outline-none"
                                                placeholder="e.g. PT. Gentanala Jaya"
                                            />
                                        </div>
                                        <div className="bg-amber-50/50 p-4 rounded-row border border-amber-100/50">
                                            <label className="text-xs font-semibold text-ink uppercase flex items-center gap-2 mb-1.5">
                                                <UserCheck className="w-4 h-4" /> Company Admin Email
                                            </label>
                                            <input
                                                type="email"
                                                value={editCompany.admin_email || ''}
                                                onChange={e => setEditCompany({ ...editCompany, admin_email: e.target.value })}
                                                className="w-full p-3.5 bg-surface border border-hairline focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all rounded-row text-sm outline-none"
                                                placeholder="e.g. hrd@abadi.com"
                                            />
                                            <p className="text-[11px] text-amber-600/80 mt-2 font-medium">Isi email ini untuk mendelegasikan akses admin ke profil company (harus email yang sudah terdaftar sebagai akun).</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-5">
                                            <div>
                                                <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Website</label>
                                                <input
                                                    type="text"
                                                    value={editCompany.website || ''}
                                                    onChange={e => setEditCompany({ ...editCompany, website: e.target.value })}
                                                    className="w-full mt-1.5 p-3.5 bg-fill-subtle border border-hairline focus:border-ink-3 focus:ring-1 focus:ring-ink/10 transition-all rounded-row text-sm outline-none"
                                                    placeholder="https://company.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Logo URL</label>
                                                <input
                                                    type="text"
                                                    value={editCompany.logo_url || ''}
                                                    onChange={e => setEditCompany({ ...editCompany, logo_url: e.target.value })}
                                                    className="w-full mt-1.5 p-3.5 bg-fill-subtle border border-hairline focus:border-ink-3 focus:ring-1 focus:ring-ink/10 transition-all rounded-row text-sm outline-none"
                                                    placeholder="https://..."
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Profile Avatar B2B Fallback</label>
                                            <input
                                                type="text"
                                                value={editCompany.avatar_url || ''}
                                                onChange={e => setEditCompany({ ...editCompany, avatar_url: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-fill-subtle border border-hairline focus:border-ink-3 focus:ring-1 focus:ring-ink/10 transition-all rounded-row text-sm outline-none"
                                                placeholder="Alternatif avatar bagi profil B2B yang kosong"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Company Bio / Description</label>
                                            <textarea
                                                value={editCompany.bio || ''}
                                                onChange={e => setEditCompany({ ...editCompany, bio: e.target.value })}
                                                className="w-full mt-1.5 p-3.5 bg-fill-subtle border border-hairline focus:border-ink-3 focus:ring-1 focus:ring-ink/10 transition-all rounded-row text-sm outline-none min-h-[100px]"
                                                placeholder="Jelaskan deskripsi singkat profil company ini..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Extras and Devices */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-6 border-b border-hairline pb-3">
                                        <div className="w-8 h-8 rounded-lg bg-moss/40 flex items-center justify-center">
                                            <Settings className="w-4 h-4 text-ink" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-ink">Pengaturan Ekstra</h4>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-ink-2 uppercase ml-1">Social Links (JSON Configuration)</label>
                                        <p className="text-xs text-ink-3 mb-2 ml-1">Konfigurasi array format JSON untuk social links company.</p>
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
                                            className="w-full p-4 bg-ink text-ink-3 rounded-row font-mono text-xs outline-none min-h-[140px] focus:ring-2 focus:ring-ink/20 transition-all"
                                            placeholder='[{"platform": "instagram", "url": "..."}]'
                                        />
                                    </div>

                                    {/* Employees / Serials List (Only edit mode) */}
                                    {editCompany.id && (
                                        <div className="mt-8">
                                            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                                                <div className="w-8 h-8 rounded-lg bg-success-soft flex items-center justify-center">
                                                    <Smartphone className="w-4 h-4 text-success-soft-ink" />
                                                </div>
                                                <h4 className="text-lg font-semibold text-ink">Perangkat & Akun Tertaut</h4>
                                                <div className="ml-auto">
                                                    <span className="text-xs font-semibold text-success-soft-ink bg-success-soft px-3 py-1 rounded-full border border-hairline">
                                                        {serials.filter(s => s.company_id === editCompany.id).length} Perangkat
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="max-h-[220px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-track">
                                                {serials.filter(s => s.company_id === editCompany.id).length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-8 bg-fill-subtle rounded-card border border-dashed border-hairline">
                                                        <Search className="w-8 h-8 text-ink-3 mb-2" />
                                                        <p className="text-sm font-medium text-ink-2">Belum ada perangkat / kartu yang tertaut.</p>
                                                    </div>
                                                ) : (
                                                    serials.filter(s => s.company_id === editCompany.id).map(s => (
                                                        <div key={s.id} className="group flex flex-col p-4 bg-surface border border-hairline rounded-card hover:border-ink-3 transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm font-semibold text-ink group-hover:text-coral transition-colors uppercase">{s.display_name || 'Unclaimed'}</span>
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.is_claimed ? 'bg-success-soft text-success-soft-ink border-hairline' : 'bg-butter/40 text-ink border-hairline'}`}>
                                                                    {s.is_claimed ? 'Aktif' : 'Terbuka'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] uppercase font-semibold text-ink-3 mb-0.5">Kode Kartu (UUID)</span>
                                                                    <code className="text-xs text-ink-2 font-mono bg-fill-subtle px-1.5 py-0.5 rounded">{s.serial_uuid.substring(0, 13)}...</code>
                                                                </div>
                                                                {s.email && (
                                                                    <div className="flex flex-col border-l border-hairline pl-4">
                                                                        <span className="text-[10px] uppercase font-semibold text-ink-3 mb-0.5">Akun Pegawai</span>
                                                                        <span className="text-xs font-semibold text-ink truncate max-w-[120px]" title={s.email}>{s.email}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col border-l border-hairline pl-4 ml-auto text-right">
                                                                    <span className="text-[10px] uppercase font-semibold text-ink-3 mb-0.5">Analitik</span>
                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <span className="text-[11px] text-coral-soft-ink font-semibold flex items-center gap-1 bg-coral-soft px-1.5 py-0.5 rounded-md border border-hairline"><Activity className="w-3 h-3 text-coral" />{s.nfc_tap_count}</span>
                                                                        <span className="text-[11px] text-coral-soft-ink font-semibold flex items-center gap-1 bg-coral-soft px-1.5 py-0.5 rounded-md border border-purple-100"><Eye className="w-3 h-3 text-coral-soft-ink" />{s.view_count}</span>
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
                            <div className="px-8 py-5 border-t border-hairline bg-fill-subtle flex justify-end gap-3 items-center">
                                <button
                                    onClick={() => setEditCompany(null)}
                                    className="px-6 py-3 text-sm font-semibold text-ink-2 hover:bg-fill-subtle hover:text-ink rounded-row transition-colors"
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
                                    className="px-8 py-3 bg-ink text-white text-sm font-semibold rounded-row shadow-[0_8px_30px_rgb(37,99,235,0.2)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface rounded-card p-6 max-w-md w-full shadow-card"
                        >
                            <div className="w-12 h-12 bg-coral-soft rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6 text-coral-soft-ink" />
                            </div>
                            <h3 className="text-lg font-semibold text-ink mb-2">Hapus Serial Number?</h3>
                            <div className="space-y-4 mb-6">
                                <p className="text-sm text-ink-2">
                                    Apakah Anda yakin ingin menghapus serial number ini?
                                </p>
                                {serials.find(s => s.id === deleteConfirm)?.is_claimed ? (
                                    <div className="p-3 bg-butter/40 rounded-row border border-amber-100">
                                        <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Terdeteksi User Terhubung</p>
                                        <p className="text-[11px] text-ink leading-relaxed">
                                            Serial ini sudah diklaim oleh <strong>{serials.find(s => s.id === deleteConfirm)?.display_name}</strong>.
                                            Anda bisa menghapus hanya data fisiknya saja, atau menghapus seluruh akun user tersebut.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-ink-3 italic">Serial ini belum diklaim oleh siapapun.</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="px-4 py-2 text-sm font-medium text-ink-2 hover:bg-fill-subtle rounded-row transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => deleteSerial(deleteConfirm)}
                                        className="px-4 py-2 bg-fill-subtle text-ink text-sm font-semibold rounded-row hover:bg-fill-subtle transition-colors"
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
                                        className="w-full py-2.5 bg-coral text-white text-sm font-semibold rounded-row hover:bg-coral/90 transition-colors shadow-row mt-2"
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
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface rounded-card p-6 max-w-md w-full shadow-card"
                        >
                            <div className="w-12 h-12 bg-coral-soft rounded-full flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-coral-soft-ink" />
                            </div>
                            <h3 className="text-lg font-semibold text-ink mb-2">Hapus {selectedIds.size} Serial?</h3>
                            <p className="text-sm text-ink-2 mb-6">
                                Anda akan menghapus masal {selectedIds.size} serial number. Tindakan ini permanen.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setBulkDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-ink-2 hover:bg-fill-subtle rounded-row transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={bulkDelete}
                                    className="px-6 py-2 bg-coral text-white text-sm font-semibold rounded-row hover:bg-coral/90 transition-colors shadow-row "
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
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface rounded-card p-8 max-w-md w-full shadow-card border border-hairline"
                        >
                            <div className="w-16 h-16 bg-coral-soft rounded-card flex items-center justify-center mb-6 mx-auto rotate-3">
                                <Trash2 className="w-8 h-8 text-coral-soft-ink -rotate-3" />
                            </div>

                            <h3 className="text-xl font-semibold text-ink mb-2 text-center uppercase tracking-tight">Hapus Akun Permanent?</h3>
                            <p className="text-sm text-ink-2 mb-8 text-center leading-relaxed">
                                Anda akan menghapus akun <strong>{userToDelete.display_name || userToDelete.email}</strong>.<br />
                                {(() => {
                                    const linkedCount = serials.filter(s => s.owner_id === userToDelete.user_id).length;
                                    if (linkedCount > 1) {
                                        return (
                                            <span className="bg-coral-soft text-coral-soft-ink font-semibold px-3 py-1 rounded-lg mt-3 block border border-hairline">
                                                ⚠️ PERINGATAN: User ini memiliki {linkedCount} serial/kartu yang tertaut! Menghapus user akan memutuskan SEMUA kartu tersebut.
                                            </span>
                                        );
                                    }
                                    return <span className="text-coral-soft-ink font-semibold mt-2 block">Seluruh profile, links, dan aset NFC akan terputus selamanya!</span>;
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
                                        className="w-full py-4 bg-coral-soft text-coral-soft-ink text-sm font-semibold rounded-card hover:bg-coral-soft/80 transition-all border border-hairline flex flex-col items-center gap-1"
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
                                    className="w-full py-4 bg-butter/40 text-amber-800 text-sm font-semibold rounded-card hover:bg-amber-200 transition-all border border-hairline flex flex-col items-center gap-1"
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
                                    className="w-full py-4 bg-coral text-white text-sm font-semibold rounded-card hover:bg-coral/90 transition-all shadow-card shadow-red-200 flex flex-col items-center gap-1"
                                >
                                    <span className="uppercase tracking-widest">HAPUS PERMANEN</span>
                                    <span className="text-[10px] font-normal opacity-80">(Hapus user & putuskan serial number)</span>
                                </button>

                                <button
                                    onClick={() => setUserToDelete(null)}
                                    className="w-full py-3 bg-fill-subtle text-ink-2 text-sm font-semibold rounded-card hover:bg-fill-subtle transition-all uppercase tracking-widest mt-2"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-card bg-surface p-6 shadow-card">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-ink">Mode Kado</h3>
                                <p className="text-xs text-ink-2 mt-0.5">
                                    Kejutan yang muncul saat jam ini pertama kali ditempel penerima.
                                </p>
                            </div>
                            <button onClick={() => setGiftSerial(null)} className="p-2 text-ink-3 hover:text-ink">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {giftSerial.is_claimed && (
                            <p className="mt-4 rounded-lg bg-butter/40 border border-hairline px-3 py-2 text-xs text-ink">
                                Kartu ini sudah diklaim, jadi kejutannya tidak muncul lagi saat di-tap — cuma tersimpan
                                sebagai kenangan di dashboard pemiliknya.
                            </p>
                        )}
                        {giftSerial.gift_opened_at && (
                            <p className="mt-4 rounded-lg bg-fill-subtle border border-hairline px-3 py-2 text-xs text-ink-2">
                                Sudah dibuka penerimanya pada {new Date(giftSerial.gift_opened_at).toLocaleString('id-ID')}.
                                Pembeli tidak bisa mengubahnya lagi dari tautan isian.
                            </p>
                        )}

                        <label className="mt-5 block text-xs font-medium uppercase text-ink-2 mb-1.5">Link video kejutan</label>
                        <input
                            type="text"
                            value={giftForm.url}
                            onChange={(e) => setGiftForm({ ...giftForm, url: e.target.value })}
                            placeholder="youtube.com/watch?v=..."
                            className="w-full rounded-row border border-hairline bg-fill-subtle px-4 py-2.5 text-sm outline-none focus:border-ink-3"
                        />

                        <label className="mt-4 block text-xs font-medium uppercase text-ink-2 mb-1.5">Pesan buat penerima</label>
                        <textarea
                            value={giftForm.message}
                            onChange={(e) => setGiftForm({ ...giftForm, message: e.target.value })}
                            rows={3}
                            maxLength={300}
                            placeholder="Selamat ulang tahun!"
                            className="w-full resize-none rounded-row border border-hairline bg-fill-subtle px-4 py-2.5 text-sm outline-none focus:border-ink-3"
                        />

                        <label className="mt-4 block text-xs font-medium uppercase text-ink-2 mb-1.5">Dari siapa</label>
                        <input
                            type="text"
                            value={giftForm.from}
                            onChange={(e) => setGiftForm({ ...giftForm, from: e.target.value })}
                            placeholder="Nama pengirim"
                            className="w-full rounded-row border border-hairline bg-fill-subtle px-4 py-2.5 text-sm outline-none focus:border-ink-3"
                        />

                        <div className="mt-5 rounded-row border border-hairline bg-fill-subtle p-3">
                            <p className="text-[11px] font-medium uppercase text-ink-2">Tautan isian buat pembeli</p>
                            <div className="mt-2 flex items-center gap-2">
                                <code className="flex-1 truncate rounded-lg bg-surface border border-hairline px-3 py-2 text-[11px] text-ink-2">
                                    {siteUrl}/gift/{giftSerial.gift_token}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`${siteUrl}/gift/${giftSerial.gift_token}`, `gift-${giftSerial.id}`)}
                                    className="shrink-0 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                                >
                                    {copiedId === `gift-${giftSerial.id}` ? 'Tersalin' : 'Salin'}
                                </button>
                            </div>
                            <p className="mt-2 text-[10px] text-ink-3">
                                Kirim ke pembeli lewat WhatsApp/email supaya dia isi sendiri kejutannya.
                            </p>
                        </div>

                        <div className="mt-5 flex gap-2">
                            {giftSerial.gift_enabled && (
                                <button
                                    onClick={() => saveGift(false)}
                                    disabled={giftSaving}
                                    className="rounded-row border border-hairline px-4 py-2.5 text-sm font-semibold text-ink-2 hover:bg-fill-subtle disabled:opacity-40"
                                >
                                    Matikan kado
                                </button>
                            )}
                            <button
                                onClick={() => saveGift(true)}
                                disabled={giftSaving || !giftForm.url.trim()}
                                className="flex-1 rounded-row bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
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
