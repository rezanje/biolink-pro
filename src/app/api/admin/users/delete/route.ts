
import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { canManageTarget } from '@/lib/admin-authority.mjs'

export async function DELETE(request: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const { userId, serialId, action } = await request.json()
        const performAction = action || 'delete'

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        if (!['unclaim', 'reset', 'delete'].includes(performAction)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }
        const supabaseAdmin = session.admin

        // 2. Validate User ID & Resolve correct Auth ID
        let targetAuthId = userId

        // Check if user exists in Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (authError || !authUser.user) {
            console.log(`User ${userId} not found in Auth. Checking if it matches a Profile ID...`)

            // Try to find if this UUID belongs to a profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('user_id')
                .eq('id', userId)
                .single()

            if (profile && profile.user_id) {
                console.log(`FOUND: Input ID ${userId} was a Profile ID. Maps to Auth ID: ${profile.user_id}`)
                targetAuthId = profile.user_id
            } else {
                console.warn(`ID ${userId} not found in Auth or Profiles.`)
                // If we can't find the user, we can't delete them. 
                // However, maybe they are already deleted?
                // We proceed to cleanup serials just in case.
            }
        }

        const { data: targetProfile } = await supabaseAdmin.from('profiles')
            .select('company_id').eq('user_id', targetAuthId).single()
        const { data: serial } = performAction === 'unclaim' && serialId
            ? await supabaseAdmin.from('serial_numbers').select('owner_id, company_id').eq('id', serialId).single()
            : { data: null }
        if (!targetProfile || (performAction === 'unclaim' && !serial)
            || !canManageTarget(session.actor, targetProfile.company_id, performAction, targetAuthId, serial?.owner_id || null)
            || (performAction === 'unclaim' && serial?.owner_id !== targetAuthId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (performAction === 'unclaim') {
            // ACTION: UNCLAIM A SPECIFIC SERIAL (without touching user profile)
            if (!serialId) {
                return NextResponse.json({ error: 'Serial ID is required for unclaim' }, { status: 400 })
            }

            const { error: unclaimError } = await supabaseAdmin
                .from('serial_numbers')
                .update({
                    owner_id: null,
                    is_claimed: false,
                    claimed_at: null,
                    sync_enabled: true
                })
                .eq('id', serialId)
                .eq('owner_id', targetAuthId)

            if (unclaimError) return NextResponse.json({ error: unclaimError.message }, { status: 500 })

            return NextResponse.json({ success: true, message: 'Serial unclaimed successfully. User profile untouched.' })

        } else if (performAction === 'reset') {
            // ACTION: RESET PROFILE CONTENT (affects ALL serials of this user)
            const { error: resetError } = await supabaseAdmin
                .from('profiles')
                .update({
                    bio: null,
                    avatar_url: null,
                    company: null,
                    job_title: null,
                    social_links: [],
                    theme: {},
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', targetAuthId)

            if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

            return NextResponse.json({ success: true, message: 'Profile reset successfully' })

        } else {
            // ACTION: FULL DELETE

            // A. Cleanup serials first (Unlink)
            const { error: serialError } = await supabaseAdmin
                .from('serial_numbers')
                .update({
                    owner_id: null,
                    is_claimed: false,
                    claimed_at: null,
                    sync_enabled: true
                })
                .eq('owner_id', targetAuthId)

            if (serialError) console.error('Error cleaning up serials:', serialError)

            // B. Explicitly delete Profile row (in case cascade fails)
            const { error: profileDeleteError } = await supabaseAdmin
                .from('profiles')
                .delete()
                .eq('user_id', targetAuthId)

            if (profileDeleteError) console.error('Error deleting profile row:', profileDeleteError)

            // C. Delete Auth User
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetAuthId)

            if (deleteError) {
                console.error('Error deleting user from Auth:', deleteError)
                return NextResponse.json({
                    error: `Auth Delete Error: ${deleteError.message}`,
                    details: deleteError
                }, { status: 500 })
            }

            console.log('User deleted successfully from Auth and DB.')
            return NextResponse.json({ success: true, message: 'User deleted permanently' })
        }

    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
