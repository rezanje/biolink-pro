'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { UnclaimedView } from './unclaimed-view'
import { ProfileView } from './profile-view'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { activeRedirectUrl, normalizeUrl } from '@/lib/redirect-mode.mjs'
import { hasGift } from '@/lib/gift.mjs'
import GiftView from '@/components/gift/GiftView'

// Default product info (used when no product join is available)
const DEFAULT_PRODUCT = {
    id: 'default-product',
    name: 'Gentanala Classic',
    slug: 'gentanala-classic',
    description: 'The flagship timepiece that started it all.',
    base_price: 3500000,
    product_type: 'ready_stock' as const,
    is_preorder: false,
    preorder_eta: null,
    preorder_cap: null,
    featured_image: '/images/products/classic-hero.jpg',
    gallery_images: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    story_content: {
        provenance: 'Crafted in our Jakarta atelier',
        story: 'Born from a vision to create watches that tell more than time.'
    }
}

export default function TapPage() {
    const params = useParams()
    const router = useRouter()
    const uuid = params?.uuid as string
    const [serial, setSerial] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    const searchParams = useSearchParams()
    const shouldClaim = searchParams.get('claim') === 'true'
    // Kartu kado: kejutan dulu, ajakan mengaktifkan kartu menyusul. Sekali
    // penerima menekan tombolnya, layar biasa yang tampil.
    const [claimOpen, setClaimOpen] = useState(false)

    useEffect(() => {
        const checkAndClaim = async () => {
            const cleanUuid = uuid?.trim()
            if (!cleanUuid) {
                setNotFound(true)
                setLoading(false)
                return
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(cleanUuid)) {
                setNotFound(true)
                setLoading(false)
                return
            }

            const supabase = createClient()

            // 1. Query Supabase for this serial
            const { data: dbSerial, error } = await supabase
                .from('serial_numbers')
                .select('*, products(*)')
                .eq('serial_uuid', cleanUuid)
                .single()

            if (error || !dbSerial) {
                console.log('Serial not found in Supabase:', cleanUuid)
                setNotFound(true)
                setLoading(false)
                return
            }

            // 2. Increment tap count in Supabase (fire and forget)
            supabase.rpc('increment_tap_count', { p_serial_uuid: cleanUuid }).then(() => {
                console.log('Tap count incremented')
            })

            // Kado dikunci begitu pertama kali dibuka, supaya pengirim tidak bisa
            // mengubah kejutan yang sudah dilihat penerimanya.
            if (hasGift(dbSerial) && !dbSerial.gift_opened_at) {
                supabase
                    .from('serial_numbers')
                    .update({ gift_opened_at: new Date().toISOString() })
                    .eq('serial_uuid', cleanUuid)
                    .then(() => console.log('Gift marked as opened'))
            }

            // 3. Handle Branding Sync & Profile Loading
            if (dbSerial.is_claimed && dbSerial.owner_id) {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', dbSerial.owner_id)
                    .single()

                const isSynced = dbSerial.sync_enabled !== false
                console.log('--- TAP DEBUG ---')
                console.log('Serial UUID:', cleanUuid)
                console.log('Sync Enabled (DB):', dbSerial.sync_enabled)
                console.log('Is Synced (Calculated):', isSynced)
                console.log('Owner Profile Slug:', ownerProfile?.slug)

                if (!ownerProfile) {
                    console.warn('Owner profile not found for serial:', cleanUuid)
                    setNotFound(true)
                    setLoading(false)
                    return
                }

                // CASE A: Independent Mode (Sync Stopped)
                // Use a dedicated profile link if it exists
                if (!isSynced && dbSerial.profile_id) {
                    const { data: independentProfile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', dbSerial.profile_id)
                        .single()

                    if (independentProfile) {
                        setSerial({
                            ...dbSerial,
                            product: dbSerial.products || DEFAULT_PRODUCT,
                            owner: independentProfile
                        })
                        setLoading(false)
                        return
                    }
                }

                // CASE B: Branding Sync Mode (B2B or Personal)
                if (isSynced) {
                    // B2B: Merge Company Branding if user is in a company
                    if (ownerProfile.company_id) {
                        const { data: company } = await supabase
                            .from('companies')
                            .select('*')
                            .eq('id', ownerProfile.company_id)
                            .single()

                        if (company) {
                            // MERGE LOGIC: Company theme/links + User name/title
                            const mergedProfile = {
                                ...ownerProfile,
                                // Overwrite specific fields with company branding if defined
                                bio: company.bio || ownerProfile.bio,
                                avatar_url: company.avatar_url || ownerProfile.avatar_url,
                                social_links: (company.social_links && company.social_links.length > 0)
                                    ? company.social_links
                                    : ownerProfile.social_links,
                                theme: {
                                    ...ownerProfile.theme,
                                    primary: company.theme?.primary || ownerProfile.theme?.primary,
                                    background: company.theme?.accent || ownerProfile.theme?.background
                                }
                            }

                            setSerial({
                                ...dbSerial,
                                product: dbSerial.products || DEFAULT_PRODUCT,
                                owner: mergedProfile
                            })
                            setLoading(false)
                            return
                        }
                    }

                    // Personal Sync Store: Redirect to primary slug (Existing behavior)
                    if (ownerProfile.slug) {
                        // INTERCEPT REDIRECT DIRECT: Mencegah double redirect delay
                        const theme = ownerProfile.theme || {};
                        const tapRedirectUrl = activeRedirectUrl(theme);
                        if (tapRedirectUrl && theme.redirect_type === 'direct') {
                            window.location.replace(normalizeUrl(tapRedirectUrl));
                            return; // Stop eksekusi agar tidak render
                        }

                        // Jika bukan redirect direct (atau berupa intro), lempar ke halaman profil yang akan handle sisanya
                        router.push(`/${ownerProfile.slug}`)
                        return
                    }
                }

                // Fallback: Just show the owner profile as-is
                setSerial({
                    ...dbSerial,
                    product: dbSerial.products || DEFAULT_PRODUCT,
                    owner: ownerProfile
                })
                setLoading(false)
                return
            }

            // 4. Build serial object for Unclaimed view
            const serialData = {
                ...dbSerial,
                product: dbSerial.products || DEFAULT_PRODUCT,
                owner: undefined
            }

            setSerial(serialData)
            setLoading(false)
        }

        checkAndClaim()
    }, [uuid, shouldClaim, router])

    if (loading) {
        return (
            <div className="min-h-screen bg-canvas font-kabut text-ink flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <Loader2 className="w-8 h-8 text-coral animate-spin mx-auto mb-4" />
                    <p className="text-ink-2">Loading...</p>
                </motion.div>
            </div>
        )
    }

    if (notFound || !serial) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-md"
                >
                    <div className="text-6xl mb-6">🔍</div>
                    <h1 className="text-2xl font-bold text-white mb-4">Serial Not Found</h1>
                    <p className="text-zinc-400 mb-6">
                        This serial number doesn&apos;t exist or hasn&apos;t been registered yet.
                    </p>
                    <p className="text-sm text-zinc-500">
                        UUID: <code className="text-blue-400">{uuid}</code>
                    </p>
                    <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-left">
                        <p className="text-sm text-blue-300">
                            <strong>Admin Tip:</strong> Make sure this UUID was generated in the Admin Panel
                            at <code className="text-blue-400">/admin</code>
                        </p>
                    </div>
                </motion.div>
            </div>
        )
    }

    // Render based on claim status
    if (serial.is_claimed && serial.owner) {
        // CASE: Sync Enabled - Auto-redirect to owner's master profile
        if (serial.sync_enabled === true || serial.sync_enabled === undefined || serial.sync_enabled === null) {
            console.log('Sync Active - Attempting Redirect to:', serial.owner.slug)
            const username = serial.owner.slug || serial.owner.username || serial.owner.user_id
            if (username) {
                router.push(`/${username}`)
                return (
                    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                        >
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                            <p className="text-zinc-400">Redirecting to verified profile...</p>
                        </motion.div>
                    </div>
                )
            }
        }

        // CASE: Sync Disabled (Independent) - Show ProfileView Directly
        return <ProfileView serial={serial} />
    }

    if (hasGift(serial) && !claimOpen) {
        return (
            <GiftView
                gift={{ url: serial.gift_url, message: serial.gift_message, from: serial.gift_from }}
                onClaim={() => setClaimOpen(true)}
            />
        )
    }

    return <UnclaimedView serial={serial} />
}
