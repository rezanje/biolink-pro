import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { canManageTarget } from '@/lib/admin-authority.mjs'

export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const { userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        // Use service role key to bypass RLS
        const supabaseAdmin = session.admin

        // Verify if requester is allowed
        const { data: targetProfile } = await supabaseAdmin.from('profiles')
            .select('company_id').eq('user_id', userId).single()
        if (!targetProfile || !canManageTarget(session.actor, targetProfile.company_id, 'reset', userId, null)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 1. Clear Profile Data
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                bio: 'Profil telah direset oleh Admin',
                links: [],
                avatar_url: null,
                theme: {}
            })
            .eq('user_id', userId)

        if (profileError) throw profileError

        // 2. Detach Serial Number
        const { error: serialError } = await supabaseAdmin
            .from('serial_numbers')
            .update({
                is_claimed: false,
                owner_id: null,
                claimed_at: null,
                nfc_tap_count: 0
            })
            .eq('owner_id', userId)

        if (serialError) throw serialError

        // Note: The auth user account is not deleted. The physical NFC card is now claimable by someone else,
        // or the same user can claim a new card. This satisfies the "Handover" requirement for B2B.

        return NextResponse.json({ success: true, message: 'Profil dan kaitan kartu berhasil direset.' })
    } catch (e: any) {
        console.error('Reset User API error:', e)
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
    }
}
