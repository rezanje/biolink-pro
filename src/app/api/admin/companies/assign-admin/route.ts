import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'

export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const { company_id, admin_email } = await req.json()

        if (!company_id || !admin_email) {
            return NextResponse.json({ error: 'Company ID and Admin Email are required' }, { status: 400 })
        }

        // Use service role key to bypass RLS and update any user's profile
        const supabaseAdmin = session.admin

        // Find profile by email
        const { data: profile, error: searchError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, email')
            .eq('email', admin_email)
            .single()

        if (searchError || !profile) {
            return NextResponse.json({ error: 'User with this email not found in profiles' }, { status: 404 })
        }

        // Update the profile to be a company_admin for this company
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                role: 'company_admin',
                company_id: company_id
            })
            .eq('user_id', profile.user_id)

        if (updateError) {
            console.error('Error assigning company admin:', updateError)
            return NextResponse.json({ error: 'Failed to assign company admin role' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: `Successfully assigned ${admin_email} as Company Admin` })
    } catch (e: any) {
        console.error('Assign Admin API error:', e)
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
    }
}
