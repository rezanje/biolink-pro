'use client'

import { useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [forgotMode, setForgotMode] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotSent, setForgotSent] = useState(false)
    const [forgotLoading, setForgotLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Determine if this is an admin login flow
    const nextUrlParam = searchParams.get('next')
    const isAdminLogin = nextUrlParam === '/admin'

    // Show error from callback (e.g., unclaimed Google login)
    const callbackError = searchParams.get('error')

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        if (!email || !password) {
            setError('Email dan password harus diisi')
            return
        }

        setIsLoading(true)
        setError('')

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (authError) {
            setError(authError.message === 'Invalid login credentials'
                ? 'Email atau password salah'
                : authError.message)
            setIsLoading(false)
            return
        }

        // Admin perusahaan langsung ke dashboard perusahaannya.
        let nextUrl = searchParams.get('next')
        if (!nextUrl) {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: me } = user
                ? await supabase.from('profiles').select('role, company_id').eq('user_id', user.id).maybeSingle()
                : { data: null }
            nextUrl = me?.role === 'company_admin' && me.company_id ? '/company/dashboard' : '/dashboard'
        }
        router.push(nextUrl)
    }

    async function handleGoogleLogin() {
        setIsGoogleLoading(true)
        setError('')

        const nextUrl = searchParams.get('next') || '/dashboard'
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${nextUrl}`,
                // Aplikasi yang dipasang di layar utama punya penyimpanan sendiri,
                // terpisah dari browser — Google tidak mengenali sesi apa pun di sana
                // dan bisa berhenti di halaman kosong tanpa daftar akun. Memaksa
                // pemilih akun membuatnya selalu menampilkan pilihan atau form masuk.
                queryParams: { prompt: 'select_account' },
            },
        })

        if (authError) {
            setError(authError.message)
            setIsGoogleLoading(false)
        }
    }

    async function handleForgotPassword(e: React.FormEvent) {
        e.preventDefault()
        if (!forgotEmail) {
            setError('Masukkan email Anda')
            return
        }

        setForgotLoading(true)
        setError('')

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
            redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        })

        if (resetError) {
            setError(resetError.message)
        } else {
            setForgotSent(true)
        }
        setForgotLoading(false)
    }

    const displayError = error || (callbackError === 'unclaimed'
        ? 'Akun Google Anda belum terdaftar. Silakan beli produk Gentanala dan claim kartu Anda terlebih dahulu.'
        : callbackError === 'auth_failed'
            ? 'Login gagal. Silakan coba lagi.'
            : '')

    return (
        <div className="min-h-screen bg-white text-zinc-900 flex items-center justify-center p-6 relative overflow-hidden">

            {/* 🌈 Aura Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] opacity-30 blur-[120px]">
                    <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-pink-200 rounded-full mix-blend-multiply opacity-70" />
                    <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-orange-100 rounded-full mix-blend-multiply opacity-60" />
                    <div className="absolute bottom-[20%] left-[30%] w-[40%] h-[40%] bg-purple-100 rounded-full mix-blend-multiply opacity-50" />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-6">
                        {isAdminLogin ? (
                            <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <Shield className="w-8 h-8 text-blue-600" />
                            </div>
                        ) : (
                            <img
                                src="/logo.png"
                                alt="Gentanala Logo"
                                className="h-12 w-auto object-contain mx-auto"
                            />
                        )}
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-900">
                        {forgotMode ? 'Reset Password' : (isAdminLogin ? 'Admin Sign In' : 'Sign In')}
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm font-medium">
                        {forgotMode
                            ? 'Masukkan email untuk reset password'
                            : (isAdminLogin ? 'Login khusus Administrator' : 'Lanjutkan ke profil digital Anda')}
                    </p>
                </div>

                {displayError && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50/50 border border-red-100 text-red-500 px-5 py-4 rounded-2xl mb-8 text-sm font-bold text-center backdrop-blur-sm"
                    >
                        {displayError}
                    </motion.div>
                )}

                {forgotMode ? (
                    /* ─── Forgot Password Form ─── */
                    forgotSent ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-4"
                        >
                            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                                <Mail className="w-7 h-7 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900">Email Terkirim!</h3>
                            <p className="text-zinc-500 text-sm">
                                Kami telah mengirimkan link reset password ke <strong className="text-zinc-900">{forgotEmail}</strong>. Silakan cek inbox Anda.
                            </p>
                            <button
                                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); setError('') }}
                                className="text-zinc-900 font-semibold text-sm hover:underline mt-4 inline-block"
                            >
                                ← Kembali ke Sign In
                            </button>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-6">
                            <div>
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block ml-1">Email</label>
                                <input
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    placeholder="name@email.com"
                                    className="w-full px-5 py-4 bg-white/50 border border-zinc-100 rounded-2xl text-zinc-900 placeholder-zinc-300 focus:bg-white focus:border-black transition-all outline-none font-medium backdrop-blur-sm shadow-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={forgotLoading}
                                className="w-full py-5 bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-black/10 hover:bg-zinc-800"
                            >
                                {forgotLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Kirim Link Reset <ArrowRight className="w-5 h-5" /></>}
                            </button>
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => { setForgotMode(false); setError('') }}
                                    className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors"
                                >
                                    ← Kembali ke Sign In
                                </button>
                            </div>
                        </form>
                    )
                ) : (
                    /* ─── Sign In Form ─── */
                    <>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block ml-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@email.com"
                                    className="w-full px-5 py-4 bg-white/50 border border-zinc-100 rounded-2xl text-zinc-900 placeholder-zinc-300 focus:bg-white focus:border-black transition-all outline-none font-medium backdrop-blur-sm shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block ml-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-5 py-4 bg-white/50 border border-zinc-100 rounded-2xl text-zinc-900 placeholder-zinc-300 focus:bg-white focus:border-black transition-all outline-none font-medium backdrop-blur-sm shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                <div className="mt-2 text-right">
                                    <button
                                        type="button"
                                        onClick={() => { setForgotMode(true); setError('') }}
                                        className="text-xs text-zinc-400 hover:text-zinc-700 font-medium transition-colors"
                                    >
                                        Lupa password?
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-5 bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-black/10 hover:bg-zinc-800"
                            >
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-zinc-100" />
                            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest">atau</span>
                            <div className="flex-1 h-px bg-zinc-100" />
                        </div>

                        {/* Google Sign-In */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isGoogleLoading}
                            className="w-full py-4 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm"
                        >
                            {isGoogleLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            )}
                            Sign in with Google
                        </button>
                    </>
                )}

                {!forgotMode && (
                    <div className="text-center mt-8">
                        <p className="text-zinc-500 text-sm">
                            Don&apos;t have an account?{' '}
                            <Link href="https://gentanala.com" target="_blank" className="text-zinc-900 font-semibold hover:underline">
                                Get your Gentanala here
                            </Link>
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}
