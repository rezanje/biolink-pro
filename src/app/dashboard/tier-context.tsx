'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canUseInterpreter } from '@/lib/profile-display.mjs'

type Tier = 'FREE' | 'PREMIUM' | 'B2B'

interface TierConfigs {
    [key: string]: boolean
}

interface TierContextType {
    tier: Tier
    isLoading: boolean
    canTranslate: boolean
    hasFeature: (feature: string) => boolean
    features: TierConfigs
}

const TierContext = createContext<TierContextType>({
    tier: 'FREE',
    isLoading: true,
    canTranslate: false,
    hasFeature: () => false,
    features: {}
})

export function TierProvider({ children }: { children: React.ReactNode }) {
    const [tier, setTier] = useState<Tier>('FREE')
    const [tierConfigs, setTierConfigs] = useState<Record<Tier, TierConfigs>>({
        FREE: {},
        PREMIUM: {},
        B2B: {}
    })
    const [isLoading, setIsLoading] = useState(true)
    // Fitur tambahan per pelanggan dari paket promo / admin, di luar tier.
    const [featureGrants, setFeatureGrants] = useState<string[]>([])
    const [canTranslate, setCanTranslate] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Get current user
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                setCanTranslate(!authError && canUseInterpreter(user?.id))

                if (user) {
                    // 2. Get profile tier
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('tier, subscription_valid_until, feature_grants')
                        .eq('user_id', user.id)
                        .single()

                    setFeatureGrants(Array.isArray(profile?.feature_grants) ? profile.feature_grants : [])

                    if (profile?.tier) {
                        let currentTier = profile.tier as Tier

                        // Check for expiration if not B2B (B2B usually permanent or managed differently)
                        if (currentTier === 'PREMIUM' && profile.subscription_valid_until) {
                            const expiry = new Date(profile.subscription_valid_until)
                            if (expiry < new Date()) {
                                currentTier = 'FREE'
                                // Optional: Update DB to reflect downgrade? 
                                // For now just client-side downgrade is safer/faster
                            }
                        }

                        setTier(currentTier)
                    }
                }

                // 3. Get all tier configs
                const { data: configs } = await supabase
                    .from('tier_configs')
                    .select('*')

                if (configs) {
                    const configMap: Record<Tier, TierConfigs> = { FREE: {}, PREMIUM: {}, B2B: {} }
                    configs.forEach((c: { tier: Tier; features: TierConfigs }) => {
                        configMap[c.tier] = c.features
                    })
                    setTierConfigs(configMap)
                }

            } catch (error) {
                console.error('Failed to load tier context:', error)
            } finally {
                setIsLoading(false)
            }
        }

        init()
    }, [])

    const hasFeature = (feature: string): boolean => {
        // If still loading, default to false (safe) or maybe true for basic features?
        // Safe default: false
        if (isLoading) return false

        // Get features for current tier
        const tierFeatures = tierConfigs[tier] || {}

        return tierFeatures[feature] === true || featureGrants.includes(feature)
    }

    return (
        <TierContext.Provider value={{
            tier,
            isLoading,
            canTranslate,
            hasFeature,
            features: {
                ...(tierConfigs[tier] || {}),
                ...Object.fromEntries(featureGrants.map(f => [f, true])),
            }
        }}>
            {children}
        </TierContext.Provider>
    )
}

export const useTier = () => useContext(TierContext)
