'use client'

import { Lock } from 'lucide-react'
import { motion } from 'framer-motion'

interface PremiumLockProps {
    children: React.ReactNode
    isLocked: boolean
    featureName: string
    description?: string
}

export default function PremiumLock({ children, isLocked, featureName, description }: PremiumLockProps) {
    if (!isLocked) return <>{children}</>

    return (
        <div className="relative group">
            {/* Blurred Content */}
            <div className="filter blur-md opacity-50 pointer-events-none select-none">
                {children}
            </div>

            {/* Lock Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-sm rounded-card bg-surface p-8 text-center shadow-card"
                >
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-soft">
                        <Lock className="h-6 w-6 text-coral-soft-ink" strokeWidth={1.8} />
                    </div>

                    <h3 className="text-[19px] font-semibold tracking-[-0.025em]">Premium feature</h3>
                    <p className="mt-2 text-[13px] text-ink-2">
                        <span className="font-medium text-ink">{featureName}</span> is available to Premium members only.
                    </p>

                    {description && (
                        <p className="mt-3 text-[11.5px] italic text-ink-3">{description}</p>
                    )}

                    <button className="mt-6 w-full rounded-full bg-ink py-3 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.98]">
                        Upgrade Sekarang
                    </button>
                </motion.div>
            </div>
        </div>
    )
}
