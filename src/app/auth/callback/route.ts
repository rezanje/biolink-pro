import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeSpecialEditions } from '@/lib/special-greeting.mjs'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next')

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()

            // Check if this is an NFC claim flow (next contains /tap/ and claim=true)
            if (user && next && next.includes('/tap/') && next.includes('claim=true')) {
                // Extract UUID from the next URL: /tap/UUID?claim=true
                const tapMatch = next.match(/\/tap\/([a-f0-9-]+)/)
                const serialUuid = tapMatch?.[1]

                if (serialUuid) {
                    const { data: serialInfo } = await supabase
                        .from('serial_numbers')
                        .select('special_edition, special_editions')
                        .eq('serial_uuid', serialUuid)
                        .maybeSingle()

                    const targetSpecialEditions = normalizeSpecialEditions(
                        serialInfo?.special_editions?.length ? serialInfo.special_editions : serialInfo?.special_edition
                    )
                    const targetSpecialEdition = targetSpecialEditions[0] || null

                    // 1. Auto-activate user
                    await supabase
                        .from('users')
                        .update({ is_activated: true, activated_at: new Date().toISOString() })
                        .eq('id', user.id)

                    // 2. Claim the serial
                    await supabase
                        .from('serial_numbers')
                        .update({
                            is_claimed: true,
                            owner_id: user.id,
                            claimed_at: new Date().toISOString(),
                        })
                        .eq('serial_uuid', serialUuid)

                    // 3. Create profile if doesn't exist
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('id, special_edition, special_editions')
                        .eq('user_id', user.id)
                        .single()

                    if (!existingProfile) {
                        const slug = (user.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-4)
                        await supabase
                            .from('profiles')
                            .insert({
                                user_id: user.id,
                                slug: slug,
                                display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                                bio: 'Gentanala Owner',
                                email: user.email,
                                tier: 'PREMIUM',
                                subscription_valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 Days Trial
                                special_edition: targetSpecialEdition,
                                special_editions: targetSpecialEditions
                            })
                    } else if (targetSpecialEditions.length > 0) {
                        const mergedSpecialEditions = Array.from(new Set([
                            ...normalizeSpecialEditions(existingProfile.special_editions?.length ? existingProfile.special_editions : existingProfile.special_edition),
                            ...targetSpecialEditions
                        ]))

                        await supabase
                            .from('profiles')
                            .update({
                                special_edition: mergedSpecialEditions[0] || targetSpecialEdition,
                                special_editions: mergedSpecialEditions
                            })
                            .eq('user_id', user.id)
                    }

                    // 4. Go straight to dashboard
                    return NextResponse.redirect(`${origin}/dashboard?claim_success=true`)
                }
            }

            // If a specific "next" path was requested (non-claim), honor it
            if (next) {
                return NextResponse.redirect(`${origin}${next}`)
            }

            // Otherwise, auto-detect: check if user has a profile (= has claimed a card)
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('user_id', user.id)
                    .single()

                if (profile) {
                    // Returning user with profile → Dashboard
                    return NextResponse.redirect(`${origin}/dashboard`)
                }

                // User exists but NO profile = hasn't claimed any card yet
                // Sign them out and redirect back to login with error
                await supabase.auth.signOut()
                return NextResponse.redirect(`${origin}/login?error=unclaimed`)
            }

            // New user without profile → redirect to login with unclaimed error
            return NextResponse.redirect(`${origin}/login?error=unclaimed`)
        }
    }

    // Return the user to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
