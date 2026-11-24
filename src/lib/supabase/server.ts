import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SerialWithOwner, Profile, Product } from '@/types/database'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

/**
 * Fetch serial number by UUID with product and owner data
 */
export async function getSerialByUuid(serialUuid: string): Promise<SerialWithOwner | null> {
    const supabase = await createClient()

    const { data: row, error } = await supabase
        .rpc('nfc_get_serial', { p_serial_uuid: serialUuid })

    if (error || !row) return null

    const { products, ...serialFields } = row as Record<string, unknown>
    const data = { ...serialFields, product: products ?? null } as unknown as SerialWithOwner

    // If claimed, fetch owner profile
    if (data.is_claimed && data.owner_id) {
        const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', data.owner_id)
            .single()

        return {
            ...data,
            owner: ownerProfile || undefined
        } as SerialWithOwner
    }

    return data as SerialWithOwner
}

/**
 * Increment tap count for analytics
 */
export async function incrementTapCount(serialUuid: string): Promise<void> {
    const supabase = await createClient()

    await supabase.rpc('increment_tap_count', { p_serial_uuid: serialUuid })
}

/**
 * Claim a serial number for the current user
 */
export async function claimSerial(serialUuid: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('claim_serial_number', {
        p_serial_uuid: serialUuid,
        p_user_id: userId
    })

    if (error) {
        return { success: false, error: error.message }
    }

    return data as { success: boolean; error?: string }
}

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

    return profile
}

/**
 * Get products for shop
 */
export async function getProducts(): Promise<Product[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    return data || []
}

/**
 * Get product by slug with configurator options
 */
export async function getProductBySlug(slug: string) {
    const supabase = await createClient()

    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

    if (!product) return null

    const { data: options } = await supabase
        .from('configurator_options')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_available', true)
        .order('display_order')

    return {
        ...product,
        configurator_options: options || []
    }
}
