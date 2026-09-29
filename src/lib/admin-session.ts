import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

export async function adminSession() {
    const session = await createSessionClient()
    const { data: { user } } = await session.auth.getUser()
    if (!user) return null

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) throw new Error('Admin service key missing')
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: profile } = await admin.from('profiles')
        .select('role, company_id').eq('user_id', user.id).single()
    if (!profile) return null
    return { admin, actor: { userId: user.id, role: profile.role, companyId: profile.company_id } }
}
