'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Loader2, LogIn, User, Mail } from 'lucide-react'
import type { SerialWithOwner } from '@/types/database'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ArunaAnimation from '@/components/special/ArunaAnimation'
import PrabowoAnimation from '@/components/special/PrabowoAnimation'

interface UnclaimedViewProps {
    serial: SerialWithOwner
}

export function UnclaimedView({ serial }: UnclaimedViewProps) {
    const isAruna = serial.special_edition === 'aruna' ||
                    serial.product?.slug === 'aruna' || 
                    serial.product?.name?.toLowerCase().includes('aruna')
    const isPrabowo = serial.special_edition === 'prabowo'
    const hasSpecialIntro = isAruna || isPrabowo
    const [showIntro, setShowIntro] = useState(hasSpecialIntro)
    const [isLoading, setIsLoading] = useState(false)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [showEmailForm, setShowEmailForm] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    useEffect(() => {
        if (hasSpecialIntro && showIntro) {
            const timer = setTimeout(() => {
                setShowIntro(false)
            }, 4000)
            return () => clearTimeout(timer)
        }
    }, [hasSpecialIntro, showIntro])

    const handleLogin = async (provider: 'google' | 'email') => {
        setIsLoading(true)
        const supabase = createClient()

        if (provider === 'google') {
            // Set claim flag so TapPage knows this is an intentional claim
            sessionStorage.setItem('claim_initiated', serial.serial_uuid)
            const next = encodeURIComponent(`/tap/${serial.serial_uuid}?claim=true`)
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=${next}`
                }
            })
        }
    }

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const userEmail = email
        let userId = ''
        const supabase = createClient()

        try {
            // 1. Try to Sign Up
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        is_activated: true // Auto-activate for claim flow
                    }
                }
            })

            if (signUpError) {
                // If user exists, try to Sign In
                if (signUpError.message.includes('already registered') || signUpError.status === 400) { // Check status too
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    })

                    if (signInError) {
                        alert('Login failed: ' + signInError.message)
                        setIsLoading(false)
                        return
                    }

                    if (signInData.user) userId = signInData.user.id
                } else {
                    if (signUpError.message.toLowerCase().includes('rate limit')) {
                        alert('Terlalu banyak percobaan daftar (Rate Limit Supabase). Mohon tunggu beberapa saat atau gunakan email lain.')
                    } else {
                        alert('Signup failed: ' + signUpError.message)
                    }
                    setIsLoading(false)
                    return
                }
            } else if (signUpData.user) {
                userId = signUpData.user.id
            }

            if (!userId) {
                alert('Authentication failed. Please try again.')
                setIsLoading(false)
                return
            }

            // 2. Claim Serial
            const { error: claimError } = await supabase
                .from('serial_numbers')
                .update({
                    is_claimed: true,
                    owner_id: userId,
                    claimed_at: new Date().toISOString(),
                })
                .eq('serial_uuid', serial.serial_uuid)

            if (claimError) {
                console.error('Claim error:', claimError)
                alert('Failed to claim serial number. Please contact support.')
                setIsLoading(false)
                return
            }

            // 3. Create or Update Profile with PREMIUM Trial
            const slug = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-4)
            const trialEndsAt = new Date()
            trialEndsAt.setDate(trialEndsAt.getDate() + 30) // 30 Days Trial

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    user_id: userId,
                    slug: slug,
                    display_name: userEmail.split('@')[0],
                    bio: 'Gentanala Owner',
                    email: userEmail,
                    tier: 'PREMIUM', // Grant Premium
                    subscription_valid_until: trialEndsAt.toISOString(), // Set Expiry
                    lead_capture_enabled: true // Enable features by default
                }, { onConflict: 'user_id' })

            if (profileError) {
                console.error('Profile creation error:', profileError)
                // Continue anyway, profile might exist
            }

            // 4. Set Local Storage for immediate Dashboard access (Optimistic)
            const profile = {
                id: userId,
                user_id: userId,
                slug: slug,
                display_name: userEmail.split('@')[0],
                bio: 'Gentanala Owner',
                avatar_url: null,
                theme: { primary: '#3B82F6', background: '#0F172A', style: 'default' },
                links: [],
                email: userEmail,
                tier: 'PREMIUM'
            }
            localStorage.setItem('genhub_profile', JSON.stringify(profile))
            localStorage.setItem('genhub_user', JSON.stringify({ id: userId, email: userEmail }))
            localStorage.setItem('genhub_activated', 'true')

            // 5. Redirect to Dashboard
            window.location.href = '/dashboard?claim_success=true'

        } catch (err: unknown) {
            console.error('Unexpected error:', err)
            alert('An unexpected error occurred: ' + (err instanceof Error ? err.message : String(err)))
            setIsLoading(false)
        }
    }

    return (
        <>
            <AnimatePresence>
                {showIntro && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center"
                    >
                        {isAruna && (
                            <>
                                <ArunaAnimation 
                                    mode="loop" 
                                    size={180} 
                                />
                                <p className="text-amber-500/80 text-sm font-semibold tracking-widest uppercase mt-4 animate-pulse">
                                    Aruna Limited Edition
                                </p>
                            </>
                        )}
                        {isPrabowo && (
                            <>
                                <PrabowoAnimation 
                                    mode="loop" 
                                    size={180} 
                                />
                                <p className="text-red-500/80 text-sm font-semibold tracking-widest uppercase mt-4 animate-pulse">
                                    Prabowo Limited Edition
                                </p>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="min-h-screen bg-canvas font-kabut text-ink flex flex-col items-center justify-center px-5 py-10 sm:py-14">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[480px]"
            >
                <header className="mb-6 flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold tracking-[-0.04em]">Gentanala<span className="text-coral">.</span></span>
                    <span className="rounded-full bg-coral-soft px-3 py-2 text-[11px] font-medium text-coral-soft-ink">Awaiting owner</span>
                </header>
                {/* Intro video */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative mb-4"
                >
                    <div className="w-full rounded-card border border-hairline bg-surface shadow-card overflow-hidden">
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls
                            preload="metadata"
                            aria-label="Gentanala intro"
                            className="block w-full aspect-video"
                        >
                            <source src="/videos/gentanala-intro.mp4" type="video/mp4" />
                            Browser Anda tidak mendukung pemutaran video.
                        </video>
                    </div>

                </motion.div>

                <section className="rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8" aria-labelledby="claim-title">
                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                >
                    <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-coral-soft-ink">
                        Your digital identity
                    </p>

                    <h1 id="claim-title" className="text-[32px] sm:text-[36px] font-semibold leading-[1.1] tracking-[-0.045em]">
                        Make it yours.
                    </h1>

                    <p className="text-sm leading-relaxed text-ink-2">
                        Your Gentanala carries a unique digital identity.
                        Sign in to claim it and start building your personal profile.
                    </p>
                </motion.div>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6"
                >
                    {!showAuthModal ? (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full min-h-14 py-4 px-5 bg-ink text-surface font-medium rounded-row transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 flex items-center gap-3 shadow-ink"
                        >
                            <LogIn className="w-5 h-5" />
                            <span className="flex-1 text-left text-sm">Sign in & claim ownership</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-4"
                        >
                            {!showEmailForm ? (
                                <>
                                    <button
                                        onClick={() => setShowEmailForm(true)}
                                        disabled={isLoading}
                                        className="w-full min-h-14 py-4 px-5 bg-fill-subtle hover:bg-track border border-hairline text-ink font-medium rounded-row transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <Mail className="w-5 h-5" />
                                        Continue with Email
                                    </button>

                                    <button
                                        onClick={() => handleLogin('google')}
                                        disabled={isLoading}
                                        className="w-full min-h-14 py-4 px-5 bg-ink hover:bg-ink/90 text-surface font-medium rounded-row transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</> : 'Continue with Google'}
                                    </button>
                                </>
                            ) : (
                                <form onSubmit={handleEmailAuth} className="space-y-4">
                                    <div>
                                        <label htmlFor="claim-email" className="mb-2 block text-xs font-medium text-ink-2">Email address</label>
                                        <input
                                            id="claim-email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="Email address"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full p-4 bg-fill-subtle border border-hairline rounded-row text-ink placeholder:text-ink-2 focus:outline-none focus:border-coral transition-colors"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="claim-password" className="mb-2 block text-xs font-medium text-ink-2">Password</label>
                                        <input
                                            id="claim-password"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="At least 6 characters"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full p-4 bg-fill-subtle border border-hairline rounded-row text-ink placeholder:text-ink-2 focus:outline-none focus:border-coral transition-colors"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full min-h-14 py-4 px-5 bg-ink hover:bg-ink/90 text-surface font-medium rounded-row transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Claiming...</>
                                        ) : (
                                            <>Create Account & Claim <User className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            <button
                                onClick={() => {
                                    setShowAuthModal(false)
                                    setShowEmailForm(false)
                                }}
                                disabled={isLoading}
                                className="w-full py-3 px-6 rounded-row text-ink-2 hover:text-ink text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    )}
                </motion.div>
                </section>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-center text-ink-2 text-[11px] leading-5 mt-6"
                >
                    Serial: {serial.serial_uuid.split('-')[0]}...
                    <br />
                    Powered by Gentanala
                </motion.p>
            </motion.div>
        </main>
        </>
    )
}
