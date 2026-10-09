import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Public routes yang tidak perlu auth
    const publicRoutes = ['/privacy', '/terms', '/', '/login', '/register']
    const isPublicRoute = publicRoutes.includes(pathname)

    // Check if it's a public profile route (any slug at root level except reserved routes)
    const reservedPaths = ['privacy', 'terms', 'login', 'register', 'dashboard', 'activate', 'api', '_next', 'favicon.ico']
    const pathSegments = pathname.split('/').filter(Boolean)
    const isPublicProfile = pathSegments.length === 1 && !reservedPaths.includes(pathSegments[0])

    // If not logged in and trying to access protected route
    if (!user && !isPublicRoute && !isPublicProfile && !pathname.startsWith('/api')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // If logged in
    if (user) {
        // Redirect from login/register to dashboard if already logged in
        if (pathname === '/login' || pathname === '/register') {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }

        // Check activation status for protected routes
        if (pathname.startsWith('/dashboard')) {
            const { data: userData } = await supabase
                .from('users')
                .select('is_activated')
                .eq('id', user.id)
                .single()

            // If not activated, redirect to activation page
            if (!userData?.is_activated) {
                const url = request.nextUrl.clone()
                url.pathname = '/activate'
                return NextResponse.redirect(url)
            }
        }

        // If already activated but on activate page, redirect to dashboard
        if (pathname === '/activate') {
            const { data: userData } = await supabase
                .from('users')
                .select('is_activated')
                .eq('id', user.id)
                .single()

            if (userData?.is_activated) {
                const url = request.nextUrl.clone()
                url.pathname = '/dashboard'
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
