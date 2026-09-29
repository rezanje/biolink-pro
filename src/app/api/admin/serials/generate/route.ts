import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { adminSession } from '@/lib/admin-session'

export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin' && session.actor.role !== 'company_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const { count, company_id, special_edition } = await req.json()

        if (!Number.isInteger(count) || count < 1 || count > 100) {
            return NextResponse.json({ error: 'Count must be between 1 and 100' }, { status: 400 })
        }
        if (session.actor.role === 'company_admin' && (!session.actor.companyId || (company_id && company_id !== session.actor.companyId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Use service role to bypass RLS
        const supabaseAdmin = session.admin

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

        // 2. Generate serial numbers
        const newSerials = Array.from({ length: count }).map(() => ({
            serial_uuid: randomUUID(),
            product_id: product!.id,
            is_claimed: false,
            nfc_tap_count: 0,
            company_id: session.actor.role === 'company_admin' ? session.actor.companyId : company_id || null,
            special_edition: special_edition || null,
            special_editions: special_edition ? [special_edition] : []
        }))

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
            message: `Successfully generated ${inserted?.length || count} serials`
        })
    } catch (e: any) {
        console.error('Generate Serials API error:', e)
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
    }
}
