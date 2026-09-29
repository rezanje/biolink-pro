'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UI_LANGUAGES, translate, uiLanguage } from '@/lib/ui-language.mjs'

type Locale = 'en' | 'id' | 'zh-CN'
type LanguageContextValue = {
    locale: Locale
    setLocale: (value: Locale) => Promise<void>
    t: (message: string, variables?: Record<string, string | number>) => string
    error: string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const VISITOR_STORAGE = 'gentanala_public_language'
const OWNER_STORAGE = 'gentanala_owner_language'

export function UiLanguageProvider({ children, mode }: { children: React.ReactNode; mode: 'owner' | 'visitor' }) {
    const [locale, updateLocale] = useState<Locale>('en')
    const [error, setError] = useState('')

    useEffect(() => {
        let live = true
        const fallback = uiLanguage(navigator.language) as Locale
        const storage = mode === 'owner' ? OWNER_STORAGE : VISITOR_STORAGE
        const cached = localStorage.getItem(storage)
        queueMicrotask(() => { if (live) updateLocale(uiLanguage(cached || fallback)) })

        if (mode === 'owner') {
            createClient().auth.getUser().then(({ data: { user } }) => {
                if (!live || !user) return
                const saved = user.user_metadata?.gentanala_ui_language
                if (saved && UI_LANGUAGES.some(({ code }) => code === saved)) {
                    updateLocale(saved as Locale)
                    localStorage.setItem(storage, saved)
                }
            })
        }
        return () => { live = false }
    }, [mode])

    useEffect(() => {
        const previous = document.documentElement.lang
        document.documentElement.lang = locale
        return () => { document.documentElement.lang = previous }
    }, [locale])

    const setLocale = async (value: Locale) => {
        if (!UI_LANGUAGES.some(({ code }) => code === value)) return
        setError('')
        if (mode === 'owner') {
            const { error: saveError } = await createClient().auth.updateUser({ data: { gentanala_ui_language: value } })
            if (saveError) {
                setError(translate('Could not save language. Please try again.', locale))
                return
            }
        }
        localStorage.setItem(mode === 'owner' ? OWNER_STORAGE : VISITOR_STORAGE, value)
        updateLocale(value)
    }

    return <LanguageContext.Provider value={{ locale, setLocale, t: (message, variables) => translate(message, locale, variables), error }}>{children}</LanguageContext.Provider>
}

export function useUiLanguage() {
    const value = useContext(LanguageContext)
    if (!value) throw new Error('UiLanguageProvider is missing')
    return value
}

export function useOptionalUiLanguage() {
    return useContext(LanguageContext)
}

export function UiLanguageSelect({ className = '' }: { className?: string }) {
    const { locale, setLocale, t, error } = useUiLanguage()
    return <span className={`inline-flex items-center gap-2 ${className}`}>
        <label className="sr-only" htmlFor="gentanala-ui-language">{t('Language')}</label>
        <select id="gentanala-ui-language" aria-label={t('Language')} value={locale} onChange={event => void setLocale(event.target.value as Locale)} className="max-w-full rounded-full border border-current/15 bg-surface px-3 py-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
            {UI_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
        </select>
        {error && <span role="alert" className="text-xs text-coral-soft-ink">{error}</span>}
    </span>
}
