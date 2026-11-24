import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Klaim lewat API. Semua aturan (profil, bundel, edisi spesial, paket promo)
// ada di fungsi database nfc_claim_serial.
export async function POST(request: NextRequest) {
    try {
        const { serial_uuid } = await request.json()

        if (!serial_uuid || typeof serial_uuid !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Serial UUID is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            )
        }

        const { data, error } = await supabase.rpc('nfc_claim_serial', { p_serial_uuid: serial_uuid })

        if (error) {
            console.error('Claim error:', error)
            return NextResponse.json({ success: false, error: 'Claim failed' }, { status: 500 })
        }

        if (!data?.success) {
            return NextResponse.json(
                { success: false, error: data?.error || 'Claim failed' },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            serial_id: data.serial_id,
            bundle_claimed: data.bundle_claimed || 0,
            message: 'Watch claimed successfully! Welcome to the Gentanala family.'
        })
    } catch (error) {
        console.error('Claim API error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
