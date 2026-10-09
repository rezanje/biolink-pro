import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { validateSerialAssignment } from '@/lib/serial-assignment.mjs'

export async function PATCH(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const input = await req.json()
        const validation = validateSerialAssignment(session.actor, { ...input, count: 1 })
        if (validation || typeof input.id !== 'string') return NextResponse.json({ error: validation || 'Serial wajib dipilih' }, { status: 400 })
        const { data: serial, error: serialError } = await session.admin.from('serial_numbers').select('id, device_type_id, event_id').eq('id', input.id).maybeSingle()
        if (serialError || !serial) return NextResponse.json({ error: 'Serial tidak ditemukan' }, { status: 404 })
        for (const [table, field] of [['device_types', 'device_type_id'], ['events', 'event_id'], ['companies', 'company_id']]) {
            const id = input[field]
            if (!id) continue
            let query = session.admin.from(table).select('id').eq('id', id)
            // Existing archived choices may be retained, but cannot be newly assigned.
            if (table !== 'companies' && id !== serial[field as 'device_type_id' | 'event_id']) query = query.eq('is_active', true)
            const { data, error } = await query.maybeSingle()
            if (error || !data) return NextResponse.json({ error: 'Pilihan tidak tersedia atau sudah nonaktif' }, { status: 400 })
        }
        const { error } = await session.admin.from('serial_numbers').update({
            device_type_id: input.device_type_id || null,
            company_id: input.company_id || null,
            event_id: input.event_id || null,
        }).eq('id', input.id)
        if (error) return NextResponse.json({ error: 'Gagal menyimpan device/event' }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Gagal menyimpan device/event' }, { status: 500 })
    }
}
