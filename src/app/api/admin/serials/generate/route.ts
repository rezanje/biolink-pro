import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { adminSession } from '@/lib/admin-session'
import { validateSerialAssignment } from '@/lib/serial-assignment.mjs'

export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin' && session.actor.role !== 'company_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const input = await req.json()
        const { count, company_id, special_edition, device_type_id, event_id, promo_package_id, bundle_device_type_id } = input
        const validation = validateSerialAssignment(session.actor, input)
        if (validation) return NextResponse.json({ error: validation }, { status: validation === 'Forbidden' ? 403 : 400 })
        const supabaseAdmin = session.admin
        // Paket promo dan pasangan bundel hanya untuk super admin.
        if ((promo_package_id || bundle_device_type_id) && session.actor.role !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (promo_package_id) {
            const { data: pkg } = await supabaseAdmin.from('promo_packages').select('id').eq('id', promo_package_id).maybeSingle()
            if (!pkg) return NextResponse.json({ error: 'Paket promo tidak ditemukan' }, { status: 400 })
        }
        for (const [table, id] of [['device_types', device_type_id], ['device_types', bundle_device_type_id], ['events', event_id], ['companies', company_id]]) {
            if (!id) continue
            let query = supabaseAdmin.from(table).select('id').eq('id', id)
            if (table !== 'companies') query = query.eq('is_active', true)
            const { data, error } = await query.maybeSingle()
            if (error || !data) return NextResponse.json({ error: `Pilihan ${table} tidak tersedia atau sudah nonaktif` }, { status: 400 })
        }

        // 1. Find or create a master product
        let { data: product } = await supabaseAdmin
            .from('products')
            .select('id')
            .limit(1)
            .maybeSingle()

        if (!product) {
            // Auto-seed default product
            const { data: newProduct, error: prodError } = await supabaseAdmin
                .from('products')
                .insert({
                    name: 'Gentanala Classic',
                    slug: 'gentanala-classic',
                    base_price: 0,
                    product_type: 'ready_stock',
                    is_active: true
                })
                .select('id')
                .single()

            if (prodError || !newProduct) {
                return NextResponse.json({
                    error: 'Failed to create master product: ' + (prodError?.message || 'Unknown')
                }, { status: 500 })
            }
            product = newProduct
        }

        // 2. Generate serial numbers. Dengan pasangan bundel, tiap paket = 2 serial
        // (device utama + pasangan) dengan bundle_id yang sama: aktivasi salah
        // satunya mengaktifkan keduanya.
        const serialFor = (deviceTypeId: string | null, bundleId: string | null) => ({
            serial_uuid: randomUUID(),
            product_id: product!.id,
            device_type_id: deviceTypeId,
            event_id: event_id || null,
            is_claimed: false,
            nfc_tap_count: 0,
            company_id: session.actor.role === 'company_admin' ? session.actor.companyId : company_id || null,
            special_edition: special_edition || null,
            special_editions: special_edition ? [special_edition] : [],
            ...(promo_package_id ? { promo_package_id } : {}),
            ...(bundleId ? { bundle_id: bundleId } : {}),
        })
        const newSerials = Array.from({ length: count }).flatMap(() => {
            if (!bundle_device_type_id) return [serialFor(device_type_id || null, null)]
            const bundleId = randomUUID()
            return [serialFor(device_type_id || null, bundleId), serialFor(bundle_device_type_id, bundleId)]
        })

        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('serial_numbers')
            .insert(newSerials)
            .select('id, serial_uuid')

        if (insertError) {
            return NextResponse.json({
                error: 'Failed to generate serials: ' + insertError.message
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            count: inserted?.length || count,
            message: bundle_device_type_id
                ? `Berhasil membuat ${count} paket (${inserted?.length || count * 2} serial)`
                : `Successfully generated ${inserted?.length || count} serials`
        })
    } catch (e) {
        console.error('Generate Serials API error:', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal Server Error' }, { status: 500 })
    }
}
