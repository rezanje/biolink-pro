import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'

export async function GET() {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (!['super_admin', 'company_admin'].includes(session.actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const [devices, events] = await Promise.all([
            session.admin.from('device_types').select('id, name, is_active').order('created_at'),
            session.admin.from('events').select('id, name, is_active').order('created_at'),
        ])
        if (devices.error || events.error) return NextResponse.json({ error: 'Gagal memuat daftar device/event. Coba refresh.' }, { status: 500 })
        return NextResponse.json({ device_types: devices.data, events: events.data })
    } catch {
        return NextResponse.json({ error: 'Gagal memuat pengaturan' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const { kind, id, name, is_active } = await req.json()
        if (!['device_types', 'events'].includes(kind) || typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'Nama wajib diisi (maksimal 100 karakter)' }, { status: 400 })
        }
        const value = { name: name.trim(), is_active }
        const query = id ? session.admin.from(kind).update(value).eq('id', id) : session.admin.from(kind).insert(value)
        const { data, error } = await query.select('id, name, is_active').single()
        if (error) return NextResponse.json({ error: error.code === '23505' ? 'Nama sudah digunakan' : 'Gagal menyimpan pengaturan' }, { status: 400 })
        return NextResponse.json({ item: data })
    } catch {
        return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
    }
}
