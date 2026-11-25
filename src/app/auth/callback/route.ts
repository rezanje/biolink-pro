import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
                    // 1. Auto-activate user
                    await supabase
                        .from('users')
                        .update({ is_activated: true, activated_at: new Date().toISOString() })
                        .eq('id', user.id)

                    // 2. Klaim. Server membuat profil kalau belum ada (profil lama
                    // tidak ditimpa), mengklaim pasangan bundel, menggabung edisi
                    // spesial, dan memberi hak paket promo.
                    const { data: claim } = await supabase
                        .rpc('nfc_claim_serial', { p_serial_uuid: serialUuid })

                    // Gagal (mis. sudah diklaim orang lain): kembali ke halaman tap.
                    if (!claim?.success) {
                        return NextResponse.redirect(`${origin}/tap/${serialUuid}`)
                    }

                    // 3. Go straight to dashboard
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
                    .select('id, role, company_id')
                    .eq('user_id', user.id)
                    .single()

                if (profile) {
                    // Admin perusahaan → dashboard perusahaan; lainnya → dashboard
                    const home = profile.role === 'company_admin' && profile.company_id ? '/company/dashboard' : '/dashboard'
                    return NextResponse.redirect(`${origin}${home}`)
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
