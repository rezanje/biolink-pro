'use client'

import { useState, useEffect } from 'react'
import { useOptionalUiLanguage } from '@/components/UiLanguageProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Share, Smartphone, Download, CheckCircle } from 'lucide-react'

export default function PWAHandler() {
    const language = useOptionalUiLanguage()
    const t = (message: string) => language?.t(message) ?? message
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showInstallBanner, setShowInstallBanner] = useState(false)
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null)
    const [isStandalone, setIsStandalone] = useState(false)

    useEffect(() => {
        // Check if already installed/standalone
        if (typeof window !== 'undefined') {
            const isWindowStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone ||
                document.referrer.includes('android-app://');
            setIsStandalone(isWindowStandalone);

            // Detect platform
            const userAgent = window.navigator.userAgent.toLowerCase();
            if (/iphone|ipad|ipod/.test(userAgent)) {
                setPlatform('ios');
            } else if (/android/.test(userAgent)) {
                setPlatform('android');
            } else {
                setPlatform('other');
            }

            // Register Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.error('SW registration failed:', err);
                });
            }

            // Listen for beforeinstallprompt
            const handleBeforeInstallPrompt = (e: any) => {
                e.preventDefault();
                setDeferredPrompt(e);

                // Show banner if not dismissed before
                if (!localStorage.getItem('pwa_dismissed') && !isWindowStandalone) {
                    setShowInstallBanner(true);
                }
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

            // Show IOS Guide if not standalone and not dismissed
            if (/iphone|ipad|ipod/.test(userAgent) && !isWindowStandalone && !localStorage.getItem('pwa_dismissed')) {
                // Short delay to not overwhelm on load
                const timer = setTimeout(() => setShowInstallBanner(true), 3000);
                return () => clearTimeout(timer);
            }

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }
    }, [isStandalone]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallBanner(false);
            setDeferredPrompt(null);
        }
    };

    const dismissBanner = () => {
        setShowInstallBanner(false);
        localStorage.setItem('pwa_dismissed', 'true');
    };

    if (isStandalone) return null;

    return (
        <AnimatePresence>
            {showInstallBanner && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-6 left-4 right-4 z-[9999] md:left-auto md:right-8 md:w-96"
                >
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-black/50 relative overflow-hidden group">
                        {/* Background Shine */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                        <button
                            onClick={dismissBanner}
                            aria-label={t('Close')}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg border border-zinc-800">
                                <img src="/logo.png" alt="Gentanala" className="w-8 h-8 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-lg">{t('Install GenHub App')}</h3>
                                <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                                    {platform === 'ios'
                                        ? t('Add GenHub to your home screen for the best experience.')
                                        : t('Get our app for faster access to your luxury watches ecosystem.')}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            {platform === 'ios' ? (
                                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                                            <Share className="w-4 h-4 text-zinc-300" />
                                        </div>
                                        <p className="text-xs text-white">{t('1. Tap the Share icon')}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                                            <Plus className="w-4 h-4 text-zinc-300 border border-zinc-500 rounded-sm p-0.5" />
                                        </div>
                                        <p className="text-xs text-white">{t('2. Select Add to Home Screen')}</p>
                                    </div>
                                </div>
                            ) : platform === 'android' ? (
                                <button
                                    onClick={handleInstall}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                >
                                    <Download className="w-5 h-5" />
                                    {t('Install Now')}
                                </button>
                            ) : (
                                <button
                                    onClick={handleInstall}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <Smartphone className="w-5 h-5" />
                                    {t('Launch App')}
                                </button>
                            )}

                            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">
                                <CheckCircle className="w-3 h-3 text-blue-500" />
                                {t('Offline Access Enabled')}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
