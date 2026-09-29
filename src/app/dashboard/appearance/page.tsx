'use client'

import { useState, useEffect } from 'react'
import {
    Palette,
    Check,
    Save,
    Loader2,
    Type,
    Sun,
    Moon,
    ImageIcon,
    Sparkles
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import PublicCardPreview from '@/components/dashboard/PublicCardPreview'
import { CARD_TEMPLATES, CARD_FONTS, CARD_COLORS, cardTemplate, cardFont, cardAccent, accentTextColor, canUsePremiumDesign } from '@/lib/card-design.mjs'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function AppearancePage() {
    const { t } = useUiLanguage()
    const supabase = createClient()
    const [isLoading, setIsLoading] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [primaryColor, setPrimaryColor] = useState('#3B82F6')
    const [themeMode, setThemeMode] = useState('dark')
    const [imageFilter, setImageFilter] = useState('normal')
    const [template, setTemplate] = useState('classic')
    const [fontPair, setFontPair] = useState('classic')
    const [userTier, setUserTier] = useState<string>('FREE')
    const [previewSlug, setPreviewSlug] = useState('')
    const [previewName, setPreviewName] = useState('Your name')
    const [previewAvatar, setPreviewAvatar] = useState('')
    const [previewExpanded, setPreviewExpanded] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [savedAppearance, setSavedAppearance] = useState({ mode: 'dark', filter: 'normal', color: '#3B82F6', template: 'classic', font: 'classic' })
    const hasUnsavedChanges = themeMode !== savedAppearance.mode || imageFilter !== savedAppearance.filter || primaryColor !== savedAppearance.color || template !== savedAppearance.template || fontPair !== savedAppearance.font
    const previewRevision = `${themeMode}-${imageFilter}-${primaryColor}-${template}-${fontPair}`

    const syncDraftPreview = (mode: string, filter: string, color: string, nextTemplate = template, nextFont = fontPair) => {
        if (!previewSlug) return
        sessionStorage.setItem(`gentanala_design_preview_${previewSlug}`, JSON.stringify({
            theme_mode: mode,
            image_filter: filter,
            primary: color,
            template_id: nextTemplate,
            font_pair: nextFont,
        }))
    }

    useEffect(() => {
        const fetchSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('theme, tier, subscription_valid_until, slug, display_name, avatar_url')
                .eq('user_id', user.id)
                .single()

            if (profile) {
                const t = profile.theme || {}
                const initial = { mode: t.theme_mode || 'dark', filter: t.image_filter || 'normal', color: cardAccent(t.primary), template: cardTemplate(t.template_id), font: cardFont(t.font_pair) }
                setPrimaryColor(initial.color)
                setThemeMode(initial.mode)
                setImageFilter(initial.filter)
                setTemplate(initial.template)
                setFontPair(initial.font)
                setSavedAppearance(initial)
                setUserTier(canUsePremiumDesign(profile.tier, profile.subscription_valid_until) ? profile.tier : 'FREE')
                setPreviewName(profile.display_name || 'Your name')
                setPreviewAvatar(profile.avatar_url || '')
                if (profile.slug) {
                    sessionStorage.setItem(`gentanala_design_preview_${profile.slug}`, JSON.stringify({
                        theme_mode: initial.mode, image_filter: initial.filter, primary: initial.color,
                        template_id: initial.template, font_pair: initial.font,
                    }))
                    setPreviewSlug(profile.slug)
                }
            }
        }

        fetchSettings()
    }, [])

    useEffect(() => {
        if (!previewSlug) return
        return () => sessionStorage.removeItem(`gentanala_design_preview_${previewSlug}`)
    }, [previewSlug])

    useEffect(() => {
        if (!hasUnsavedChanges) return
        const warnBeforeLeave = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        const confirmLinkNavigation = (event: MouseEvent) => {
            const link = event.target instanceof Element ? event.target.closest('a[href]') : null
            if (link && !window.confirm(t('Leave without saving your appearance changes?'))) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        window.addEventListener('beforeunload', warnBeforeLeave)
        document.addEventListener('click', confirmLinkNavigation, true)
        return () => {
            window.removeEventListener('beforeunload', warnBeforeLeave)
            document.removeEventListener('click', confirmLinkNavigation, true)
        }
    }, [hasUnsavedChanges, t])

    const handleThemeModeChange = (mode: string) => {
        setSaveError('')
        syncDraftPreview(mode, imageFilter, primaryColor)
        setThemeMode(mode)
    }

    // Handle image filter change with instant preview sync
    const handleImageFilterChange = (filter: string) => {
        setSaveError('')
        syncDraftPreview(themeMode, filter, primaryColor)
        setImageFilter(filter)
    }

    // Handle primary color change with instant sync
    const handleColorChange = (color: string) => {
        setSaveError('')
        const safeColor = cardAccent(color)
        syncDraftPreview(themeMode, imageFilter, safeColor)
        setPrimaryColor(safeColor)
    }

    const handleTemplateChange = (value: string) => {
        const safeTemplate = cardTemplate(value)
        const preset = safeTemplate === 'atelier'
            ? { mode: 'light', color: '#345648', font: 'editorial' }
            : safeTemplate === 'dial'
                ? { mode: 'dark', color: '#B49964', font: 'modern' }
                : { mode: themeMode, color: primaryColor, font: fontPair }
        setSaveError('')
        syncDraftPreview(preset.mode, imageFilter, preset.color, safeTemplate, preset.font)
        setTemplate(safeTemplate)
        setThemeMode(preset.mode)
        setPrimaryColor(preset.color)
        setFontPair(preset.font)
    }

    const handleFontChange = (value: string) => {
        const safeFont = cardFont(value)
        setSaveError('')
        syncDraftPreview(themeMode, imageFilter, primaryColor, template, safeFont)
        setFontPair(safeFont)
    }

    const handleDiscard = () => {
        setSaveError('')
        syncDraftPreview(savedAppearance.mode, savedAppearance.filter, savedAppearance.color, savedAppearance.template, savedAppearance.font)
        setThemeMode(savedAppearance.mode)
        setImageFilter(savedAppearance.filter)
        setPrimaryColor(savedAppearance.color)
        setTemplate(savedAppearance.template)
        setFontPair(savedAppearance.font)
    }

    const handleSave = async () => {
        setIsLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setIsLoading(false)
            alert(t('Please sign in first.'))
            return
        }

        // Get existing profile theme data
        const { data: profile } = await supabase
            .from('profiles')
            .select('theme')
            .eq('user_id', user.id)
            .single()

        const existingTheme = profile?.theme || {}

        // Merge appearance settings into existing theme
        const updatedTheme = {
            ...existingTheme,
            primary: userTier === 'FREE' ? '#3B82F6' : primaryColor,
            theme_mode: userTier === 'FREE' ? 'light' : themeMode,
            image_filter: userTier === 'FREE' ? 'normal' : imageFilter,
            template_id: userTier === 'FREE' ? 'classic' : cardTemplate(template),
            font_pair: userTier === 'FREE' ? 'classic' : cardFont(fontPair),
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                theme: updatedTheme
            })
            .eq('user_id', user.id)

        if (error) {
            console.error('Error saving appearance:', error)
            setSaveError(t('Could not save appearance settings. Your draft is still here; please try again.'))
            setIsLoading(false)
            return
        }

        setSavedAppearance({ mode: updatedTheme.theme_mode, filter: updatedTheme.image_filter, color: updatedTheme.primary, template: updatedTheme.template_id, font: updatedTheme.font_pair })
        setSaveError('')

        setIsSaved(true)
        setIsLoading(false)
        setTimeout(() => setIsSaved(false), 3000)
    }

    return (
        <div className="mx-auto flex max-w-[1200px] gap-8 px-5 pb-[150px] pt-6">
          <div className="min-w-0 flex-1">
            <header>
                <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t('Appearance')}</h1>
                <p className="mt-1.5 text-[13px] text-ink-2">{t('Customize colors, themes, and photo filters on your public card')}</p>
                {hasUnsavedChanges && <p className="mt-2 text-[12px] font-medium text-coral-soft-ink">{t('Unsaved changes — only you can see this preview')}</p>}
            </header>

            {previewSlug && (
                <div className="mt-5 xl:hidden">
                    <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-ink-2">{t('Live preview')}</p>
                    <div className={previewExpanded ? '' : 'max-h-[260px] overflow-hidden'}>
                        <PublicCardPreview slug={previewSlug} revision={previewRevision} />
                    </div>
                    <button onClick={() => setPreviewExpanded(!previewExpanded)} className="mt-2 w-full text-center text-[12px] font-medium underline underline-offset-4">
                        {previewExpanded ? t('Show less') : t('Expand preview')}
                    </button>
                </div>
            )}

            <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2"><Palette className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                    <div>
                        <h2 className="text-[15px] font-semibold">{t('Card Layout')}</h2>
                        <p className="text-[12px] text-ink-2">{t('Same card, three ways to show it')}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {CARD_TEMPLATES.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => handleTemplateChange(option.id)}
                            disabled={userTier === 'FREE' && option.id !== 'classic'}
                            aria-pressed={template === option.id}
                            className={`min-w-0 rounded-2xl border p-2 text-left transition-colors ${template === option.id ? 'border-ink ring-1 ring-ink' : 'border-black/10 hover:border-ink-3'} ${userTier === 'FREE' && option.id !== 'classic' ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            <div className={`relative h-24 overflow-hidden rounded-xl ${option.id === 'dial' ? 'bg-[#162524]' : option.id === 'atelier' ? 'bg-[#f2efe9]' : 'bg-zinc-100'}`}>
                                {option.id === 'dial' ? (
                                    <div className="flex items-center gap-2 p-3">
                                        <div className="h-9 w-9 shrink-0 rounded-full border-[3px] border-[#c9b68a] bg-cover bg-center" style={{ backgroundImage: previewAvatar ? `url(${previewAvatar})` : undefined }} />
                                        <span className="truncate text-[11px] font-semibold text-[#f1f0e8]">{previewName}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`h-12 bg-cover bg-center ${option.id === 'atelier' ? 'rounded-b-lg' : ''}`} style={{ backgroundImage: previewAvatar ? `url(${previewAvatar})` : undefined }} />
                                        <span className={`block truncate px-2 pt-1 text-[11px] ${option.id === 'atelier' ? 'font-serif text-[#203c33]' : 'font-semibold text-zinc-900'}`}>{previewName}</span>
                                    </>
                                )}
                                <span className={`absolute bottom-2 left-2 h-1.5 w-12 rounded-full ${option.id === 'dial' ? 'bg-[#c9b68a]' : option.id === 'atelier' ? 'bg-[#315846]' : 'bg-blue-500'}`} />
                            </div>
                            <span className="mt-2 block text-[12px] font-semibold">{t(option.name)}</span>
                            <span className="block text-[10px] leading-tight text-ink-2">{t(option.description)}</span>
                        </button>
                    ))}
                </div>
                {userTier === 'FREE' && <p className="mt-3 text-[11px] text-ink-2">{t('Atelier and Dial are available on Premium.')}</p>}
            </section>

            {/* Tema kartu publik */}
            <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                        {themeMode === 'dark' ? (
                            <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        ) : themeMode === 'liquid_glass' ? (
                            <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        ) : (
                            <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        )}
                    </span>
                    <div>
                        <h2 className="text-[15px] font-semibold">{t('Card Theme')}</h2>
                        <p className="text-[12px] text-ink-2">{t('The look of your public profile')}</p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-fill-subtle p-1">
                    <button
                        onClick={() => handleThemeModeChange('light')}
                        className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${themeMode === 'light' ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                            }`}
                    >
                        <Sun className="h-4 w-4" strokeWidth={1.8} />
                        {t('Light')}
                    </button>
                    <button
                        onClick={() => handleThemeModeChange('dark')}
                        disabled={userTier === 'FREE'}
                        className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${themeMode === 'dark' ? 'bg-ink text-white' : userTier === 'FREE' ? 'cursor-not-allowed text-ink-3' : 'text-ink-2 hover:text-ink'
                            }`}
                    >
                        <Moon className="h-4 w-4" strokeWidth={1.8} />
                        {t('Dark')}
                    </button>
                    <button
                        onClick={() => handleThemeModeChange('liquid_glass')}
                        disabled={userTier === 'FREE'}
                        className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${themeMode === 'liquid_glass' ? 'bg-ink text-white' : userTier === 'FREE' ? 'cursor-not-allowed text-ink-3' : 'text-ink-2 hover:text-ink'
                            }`}
                    >
                        <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                        {t('Glass')}
                    </button>
                </div>

                {userTier === 'FREE' && (
                    <p className="mt-3 rounded-row bg-coral-soft px-3 py-2 text-center text-[11.5px] font-medium text-coral-soft-ink">
                        {t('Dark and Glass themes are available on the Premium plan')}
                    </p>
                )}
                {themeMode === 'liquid_glass' && (
                    <p className="mt-3 text-[11.5px] text-ink-2">{t('The transparent glass effect works best with a bright profile photo')}</p>
                )}
            </section>

            {/* Filter foto */}
            <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                        <ImageIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div>
                        <h2 className="text-[15px] font-semibold">{t('Photo Filter')}</h2>
                        <p className="text-[12px] text-ink-2">{t('Choose how your profile photo appears on your public card')}</p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-fill-subtle p-1">
                    <button
                        onClick={() => handleImageFilterChange('normal')}
                        className={`rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${imageFilter === 'normal' ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                            }`}
                    >
                        {t('Normal')}
                    </button>
                    <button
                        onClick={() => handleImageFilterChange('grayscale')}
                        disabled={userTier === 'FREE'}
                        className={`rounded-full py-2.5 text-[12.5px] font-medium transition-colors ${imageFilter === 'grayscale' ? 'bg-ink text-white' : userTier === 'FREE' ? 'cursor-not-allowed text-ink-3' : 'text-ink-2 hover:text-ink'
                            }`}
                    >
                        {t('Black and White')}{userTier === 'FREE' ? ' · Premium' : ''}
                    </button>
                </div>
            </section>

            {/* Warna utama */}
            <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                        <Palette className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div>
                        <h2 className="text-[15px] font-semibold">{t('Accent Color')}</h2>
                        <p className="text-[12px] text-ink-2">{t('Used for buttons on your public profile')}</p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
                    {CARD_COLORS.map((color) => (
                        <button
                            key={color.value}
                            onClick={() => handleColorChange(color.value)}
                            disabled={userTier === 'FREE' && color.value !== '#3B82F6'}
                            aria-label={t('{color} accent', { color: t(color.name) })}
                            title={t(color.name)}
                            style={{ backgroundColor: color.value, color: accentTextColor(color.value) }}
                            className={`flex aspect-square w-full items-center justify-center rounded-2xl transition-transform ${primaryColor === color.value ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-105'
                                } ${userTier === 'FREE' && color.value !== '#3B82F6' ? 'cursor-not-allowed opacity-20 grayscale' : ''}`}
                        >
                            {primaryColor === color.value && <Check className="h-5 w-5" strokeWidth={2.2} />}
                        </button>
                    ))}
                </div>

                {userTier !== 'FREE' && (
                    <label className="mt-4 flex items-center gap-3 text-[12px] font-medium text-ink-2">
                        {t('Custom accent')}
                        <input type="color" value={cardAccent(primaryColor)} onChange={event => handleColorChange(event.target.value)} aria-label={t('Custom accent color')} className="h-10 w-14 cursor-pointer rounded-lg border border-black/10 bg-transparent p-1" />
                        <span className="font-mono text-[11px]">{primaryColor}</span>
                    </label>
                )}

                {userTier === 'FREE' && (
                    <p className="mt-4 rounded-row bg-coral-soft px-3 py-2 text-center text-[11.5px] font-medium text-coral-soft-ink">
                        {t('Upgrade to Premium to unlock all colors')}
                    </p>
                )}
            </section>

            {/* Curated font pairings */}
            <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                        <Type className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div>
                        <h2 className="text-[15px] font-semibold">{t('Typography')}</h2>
                        <p className="text-[12px] text-ink-2">{t('Choose how your name and content read')}</p>
                    </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {CARD_FONTS.map(option => (
                        <button key={option.id} type="button" onClick={() => handleFontChange(option.id)} disabled={userTier === 'FREE' && option.id !== 'classic'} aria-pressed={fontPair === option.id}
                            className={`rounded-row border px-4 py-3 text-left ${fontPair === option.id ? 'border-ink bg-fill-subtle' : 'border-black/10'} ${userTier === 'FREE' && option.id !== 'classic' ? 'cursor-not-allowed opacity-40' : ''}`}>
                            <span className={`block text-[19px] ${option.id === 'editorial' ? 'font-serif' : option.id === 'modern' ? 'font-kabut' : 'font-sans'}`}>Aa</span>
                            <span className="block text-[12px] font-semibold">{t(option.name)}</span>
                            <span className="block text-[10px] text-ink-2">{t(option.description)}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Tombol simpan */}
            {saveError && <p role="alert" className="mt-4 rounded-row bg-coral-soft px-4 py-3 text-[12px] text-coral-soft-ink">{saveError}</p>}
            <div className="sticky bottom-[110px] mt-5 flex justify-center">
                {hasUnsavedChanges && <button onClick={handleDiscard} className="mr-2 rounded-full bg-surface px-5 py-3.5 text-[13px] font-medium shadow-row">{t('Discard')}</button>}
                <button
                    onClick={handleSave}
                    disabled={isLoading || !hasUnsavedChanges}
                    className="flex items-center gap-2 rounded-full bg-ink px-8 py-3.5 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.98]"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isSaved ? (
                        <>
                            <Check className="h-4 w-4" strokeWidth={2} />
                            {t('Saved')}
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" strokeWidth={1.8} />
                            {t('Save Appearance')}
                        </>
                    )}
                </button>
            </div>
          </div>

            {previewSlug && (
                <aside className="sticky top-6 hidden h-fit shrink-0 xl:block">
                    <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-widest text-ink-2">{t('Live preview')}</p>
                    <PublicCardPreview slug={previewSlug} revision={previewRevision} />
                </aside>
            )}
        </div>
    )
}
