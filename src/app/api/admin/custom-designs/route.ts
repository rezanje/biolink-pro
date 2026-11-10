import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { canManageCnyAccess } from '@/lib/custom-design-access.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (!canManageCnyAccess(session.actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const { userId, design, enabled } = await request.json()
        if (typeof userId !== 'string' || !UUID.test(userId) || design !== 'cny' || typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid Custom Design request' }, { status: 400 })
        }

        const { data: target, error: readError } = await session.admin.from('profiles')
            .select('user_id').eq('user_id', userId).single()
        if (readError || !target) return NextResponse.json({ error: 'Profile not found or access unavailable' }, { status: readError?.code === 'PGRST116' ? 404 : 500 })

        const { data: updated, error: updateError } = await session.admin.from('profiles')
            .update({ cny_design_enabled: enabled }).eq('user_id', userId).select('cny_design_enabled, theme').single()
        if (updateError || !updated) return NextResponse.json({ error: 'Could not update Custom Design access' }, { status: 500 })

        return NextResponse.json({ cny_design_enabled: updated.cny_design_enabled, template_id: updated.theme?.template_id || 'classic' })
    } catch {
        return NextResponse.json({ error: 'Could not update Custom Design access' }, { status: 500 })
    }
}
