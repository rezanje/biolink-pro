import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { adminSession } from '@/lib/admin-session'
import { adminSlug, normalizeAdminEmail } from '@/lib/company-admin-account.mjs'

// Jadikan akun yang SUDAH ADA admin perusahaan. Dicari berdasarkan email
// login; kalau tidak ketemu, berdasarkan email di kartu. Akun tanpa kartu
// (belum punya profil) dibuatkan profil privat.
export async function POST(req: Request) {
    try {
        const session = await adminSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (session.actor.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const { company_id, admin_email } = await req.json()
        const email = normalizeAdminEmail(admin_email)
        if (!company_id || !email) {
            return NextResponse.json({ error: 'Perusahaan dan email admin wajib diisi' }, { status: 400 })
        }

        const admin = session.admin
        const { data: company } = await admin.from('companies').select('id, name').eq('id', company_id).maybeSingle()
        if (!company) return NextResponse.json({ error: 'Perusahaan tidak ditemukan' }, { status: 404 })

        // 1. Email login
        let userId: string | null = null
        for (let page = 1; page <= 20 && !userId; page++) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
            if (error) break
            userId = data.users.find(u => (u.email || '').toLowerCase() === email)?.id || null
            if (data.users.length < 1000) break
        }
        // 2. Email di kartu
        if (!userId) {
            const { data: byCard } = await admin.from('profiles').select('user_id').ilike('email', email).limit(2)
            if (byCard?.length === 1) userId = byCard[0].user_id
        }
        if (!userId) {
            return NextResponse.json({ error: 'Akun dengan email ini belum ada. Pakai "Buat akun admin" untuk membuatkan akun baru.' }, { status: 404 })
        }

        const { data: profile } = await admin.from('profiles').select('id, company_id').eq('user_id', userId).maybeSingle()
        if (profile?.company_id && profile.company_id !== company.id) {
            return NextResponse.json({ error: 'Akun ini sudah terhubung ke perusahaan lain' }, { status: 409 })
        }

        const { error } = profile
            ? await admin.from('profiles').update({ role: 'company_admin', company_id: company.id, tier: 'B2B' }).eq('user_id', userId)
            : await admin.from('profiles').insert({
                user_id: userId,
                slug: adminSlug(email, String(randomInt(0, 10000)).padStart(4, '0')),
                display_name: email.split('@')[0],
                email,
                company: company.name,
                role: 'company_admin',
                company_id: company.id,
                tier: 'B2B',
                is_public: false,
            })
        if (error) {
            console.error('Assign company admin failed:', error.message)
            return NextResponse.json({ error: 'Gagal menjadikan admin perusahaan' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: `${email} sekarang admin ${company.name}` })
    } catch (e) {
        console.error('Assign Admin API error:', e instanceof Error ? e.message : 'unknown')
        return NextResponse.json({ error: 'Gagal menjadikan admin perusahaan' }, { status: 500 })
    }
}
