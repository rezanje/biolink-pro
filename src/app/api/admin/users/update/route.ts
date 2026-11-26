
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildProfileUpdates, canOwnerUpdate, touchesSuperAdminFields } from '@/lib/profile-updates.mjs'
import { slugError, isReservedSlug } from '@/lib/slug-rules.mjs'
import { canUsePremiumDesign, CARD_TEMPLATES } from '@/lib/card-design.mjs'
import { createClient as createSessionClient } from '@/lib/supabase/server'

// Helper to get admin client
const getAdminClient = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

const TIERS = ['FREE', 'PREMIUM', 'B2B']
const TEMPLATE_IDS = new Set(CARD_TEMPLATES.map((template: { id: string }) => template.id))

function superAdminFieldError(updates: Record<string, unknown>): string | null {
    if ('tier' in updates && !TIERS.includes(String(updates.tier))) return 'Tier tidak dikenal'
    if ('subscription_valid_until' in updates) {
        const value = updates.subscription_valid_until
        if (value !== null && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) return 'Tanggal berlaku tidak valid'
    }
    if ('unlocked_templates' in updates) {
        const value = updates.unlocked_templates
        if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !TEMPLATE_IDS.has(id))) return 'Template tidak dikenal'
    }
    if ('ar_access' in updates && !['off', 'preview', 'pilot'].includes(String(updates.ar_access))) return 'Mode hologram tidak dikenal'
    if ('feature_grants' in updates) {
        const value = updates.feature_grants
        if (!Array.isArray(value) || value.some(key => typeof key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(key))) return 'Fitur tidak valid'
    }
    return null
}

export async function POST(request: Request) {
    try {
        const payload = await request.json()
        const { userId, serialId, ...updates } = payload

        if (!userId && !serialId) {
            return NextResponse.json({ error: 'User ID or Serial ID is required' }, { status: 400 })
        }

        const sessionClient = await createSessionClient()
        const { data: { user } } = await sessionClient.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 1. Init Admin Client
        let supabaseAdmin
        try {
            supabaseAdmin = getAdminClient()
        } catch (err) {
            console.error('Server configuration error:', err)
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }

        const { data: requester, error: requesterError } = await supabaseAdmin
            .from('profiles').select('role, company_id').eq('user_id', user.id).single()
        if (requesterError || !requester) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const isSuperAdmin = requester.role === 'super_admin'
        const isCompanyAdmin = requester.role === 'company_admin' && !!requester.company_id
        if (!isSuperAdmin && !isCompanyAdmin) {
            if (userId !== user.id || !canOwnerUpdate(updates, serialId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        // Tier, masa Premium, template eksklusif, dan fitur tambahan: super admin saja.
        if (!isSuperAdmin && touchesSuperAdminFields(updates)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (isSuperAdmin) {
            const invalid = superAdminFieldError(updates)
            if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
        }

        // Ganti link profil: format selalu dicek; selain super admin, butuh Premium
        // aktif / B2B dan tidak boleh memakai nama yang dicadangkan.
        if (userId && typeof updates.slug === 'string') {
            const { data: target } = await supabaseAdmin.from('profiles')
                .select('slug, tier, subscription_valid_until').eq('user_id', userId).single()
            if (target && updates.slug !== target.slug) {
                if (!/^[a-z0-9-]{3,40}$/.test(updates.slug)) {
                    return NextResponse.json({ error: slugError(updates.slug) }, { status: 400 })
                }
                if (!isSuperAdmin) {
                    if (!canUsePremiumDesign(target.tier, target.subscription_valid_until)) {
                        return NextResponse.json({ error: 'Changing the profile URL needs Premium.' }, { status: 403 })
                    }
                    if (isReservedSlug(updates.slug)) {
                        return NextResponse.json({ error: slugError(updates.slug) }, { status: 400 })
                    }
                }
            }
        }

        if (isCompanyAdmin) {
            if ('company_id' in updates && updates.company_id !== requester.company_id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
            if (userId) {
                const { data: target } = await supabaseAdmin.from('profiles')
                    .select('company_id').eq('user_id', userId).single()
                if (target?.company_id !== requester.company_id) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
            }
            if (serialId) {
                const { data: serial } = await supabaseAdmin.from('serial_numbers')
                    .select('company_id, owner_id').eq('id', serialId).single()
                if (!serial || serial.company_id !== requester.company_id) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
                if (userId && serial.owner_id && serial.owner_id !== userId) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
            }
        }

        // 2. If Serial ID is provided, update serial_numbers table
        if (serialId) {
            const serialUpdates: any = {}
            if ('special_edition' in updates) {
                serialUpdates.special_edition = updates.special_edition
            }
            if ('special_editions' in updates) {
                serialUpdates.special_editions = updates.special_editions
            }
            if ('company_id' in updates) {
                serialUpdates.company_id = updates.company_id
            }

            if (Object.keys(serialUpdates).length > 0) {
                const { error: serialError } = await supabaseAdmin
                    .from('serial_numbers')
                    .update(serialUpdates)
                    .eq('id', serialId)

                if (serialError) {
                    console.error('Serial update failed:', serialError)
                    return NextResponse.json({ error: serialError.message }, { status: 500 })
                }
            }
        }

        // 3. If User ID is provided, update profiles table
        if (userId) {
            const profileUpdates = buildProfileUpdates(updates) as Record<string, unknown>

            if (userId === user.id && profileUpdates.theme && typeof profileUpdates.theme === 'object') {
                const { data: current, error: currentError } = await supabaseAdmin
                    .from('profiles').select('theme').eq('user_id', userId).single()
                if (currentError) return NextResponse.json({ error: 'Could not read profile' }, { status: 500 })
                profileUpdates.theme = { ...(current?.theme || {}), ...profileUpdates.theme }
            }

            if (Object.keys(profileUpdates).length > 0) {
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update(profileUpdates)
                    .eq('user_id', userId)

                if (profileError) {
                    console.error('Profile update failed:', profileError)
                    return NextResponse.json({ error: profileError.message }, { status: 500 })
                }
            }

            // 4. Handle Side Effects (e.g. Sync Disable for Free Tier)
            if (updates.tier === 'FREE') {
                console.log('Downgrade to FREE detected. Disabling sync...')
                const { error: syncError } = await supabaseAdmin
                    .from('serial_numbers')
                    .update({ sync_enabled: false })
                    .eq('owner_id', userId)

                if (syncError) console.warn('Failed to auto-disable sync:', syncError)
            }
        }

        return NextResponse.json({ success: true, message: 'Updated successfully' })

    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
