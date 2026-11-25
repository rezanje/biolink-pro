import { NextResponse } from 'next/server'
import { randomBytes, randomInt } from 'crypto'
import { adminSession } from '@/lib/admin-session'
import { adminSlug, generateAdminPassword, normalizeAdminEmail } from '@/lib/company-admin-account.mjs'

const PRIVATE = { 'Cache-Control': 'private, no-store' }

// Super admin membuat akun admin perusahaan (tanpa kartu). Password dibuat
// server dan hanya dikembalikan sekali di respons ini; tidak disimpan di mana pun.
export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE })
        if (session.actor.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: PRIVATE })

        const body = await req.json()
        const email = normalizeAdminEmail(body.email)
        const name = String(body.name || '').trim().slice(0, 80)
        const companyId = String(body.company_id || '')
        if (!email) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400, headers: PRIVATE })

        const admin = session.admin
        const { data: company } = await admin.from('companies').select('id, name').eq('id', companyId).maybeSingle()
        if (!company) return NextResponse.json({ error: 'Perusahaan tidak ditemukan' }, { status: 404, headers: PRIVATE })

        const password = generateAdminPassword(randomBytes)
        const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name || null, company_admin_of: company.id },
        })
        if (createError || !created?.user) {
            const exists = /already|registered|exists/i.test(createError?.message || '')
            return NextResponse.json({
                error: exists
                    ? 'Email ini sudah punya akun. Pakai "Jadikan admin" untuk menunjuk akun yang sudah ada.'
                    : 'Akun gagal dibuat',
            }, { status: exists ? 409 : 500, headers: PRIVATE })
        }

        const userId = created.user.id
        const { error: profileError } = await admin.from('profiles').insert({
            user_id: userId,
            slug: adminSlug(email, String(randomInt(0, 10000)).padStart(4, '0')),
            display_name: name || email.split('@')[0],
            email,
            company: company.name,
            role: 'company_admin',
            company_id: company.id,
            tier: 'B2B',
            is_public: false,
        })
        if (profileError) {
            await admin.auth.admin.deleteUser(userId)
            console.error('Create company admin profile failed:', profileError.message)
            return NextResponse.json({ error: 'Akun gagal dibuat' }, { status: 500, headers: PRIVATE })
        }

        return NextResponse.json({ email, password, company: company.name }, { headers: PRIVATE })
    } catch (error) {
        console.error('Create company admin error:', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json({ error: 'Akun gagal dibuat' }, { status: 500, headers: PRIVATE })
    }
}
