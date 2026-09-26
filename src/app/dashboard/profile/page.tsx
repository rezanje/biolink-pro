'use client'
// Triggering redeploy for AI Avatar feature


import { useState, useEffect, useRef, useCallback } from 'react'
import {
    User,
    Save,
    CheckCircle,
    Loader2,
    AlertCircle,
    Phone,
    MessageCircle,
    Building2,
    Briefcase,
    Camera,
    Upload,
    X,
    Image as ImageIcon,
    FileText,
    Trash2,
    Sparkles,
    Wand2,
    Bot,
    RefreshCw,
    Mail,
    LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DesktopPreview from '@/components/dashboard/DesktopPreview'
import { uploadAvatar, uploadGalleryImage, deleteFile } from '@/lib/storage'
import { getAvailableSpecialEditions, SPECIAL_EDITIONS, WELCOME_DURATIONS } from '@/lib/special-greeting.mjs'

const COUNTRY_CODES = [
    { code: '+62', label: 'ID +62' },
    { code: '+60', label: 'MY +60' },
    { code: '+65', label: 'SG +65' },
    { code: '+66', label: 'TH +66' },
    { code: '+63', label: 'PH +63' },
    { code: '+84', label: 'VN +84' },
    { code: '+86', label: 'CN +86' },
    { code: '+81', label: 'JP +81' },
    { code: '+82', label: 'KR +82' },
    { code: '+61', label: 'AU +61' },
    { code: '+1', label: 'US +1' },
    { code: '+44', label: 'UK +44' },
    { code: '+971', label: 'AE +971' }
] as const

const DEFAULT_COUNTRY_CODE = '+62'

function splitPhoneNumber(value: string | null | undefined) {
    const digits = (value || '').replace(/\D/g, '')
    const matchingCode = COUNTRY_CODES
        .map(({ code }) => code.replace(/\D/g, ''))
        .sort((a, b) => b.length - a.length)
        .find((code) => digits.startsWith(code))

    if (matchingCode) {
        return {
            countryCode: `+${matchingCode}`,
            number: digits.slice(matchingCode.length)
        }
    }

    return {
        countryCode: DEFAULT_COUNTRY_CODE,
        number: digits.replace(/^0+/, '')
    }
}

function formatPhoneNumber(countryCode: string, number: string) {
    const countryDigits = countryCode.replace(/\D/g, '')
    const localDigits = number.replace(/\D/g, '').replace(/^0+/, '')
    return localDigits ? `+${countryDigits}${localDigits}` : ''
}

export default function ProfileEditor() {
    const supabase = createClient()
    const [isLoading, setIsLoading] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [error, setError] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [userTier, setUserTier] = useState<string>('FREE')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showAddFile, setShowAddFile] = useState(false)
    const [newFileTitle, setNewFileTitle] = useState('')
    const [newFileUrl, setNewFileUrl] = useState('')
    const [mySerials, setMySerials] = useState<{ id: string; serial_uuid: string; created_at: string; is_claimed: boolean }[]>([])

    const [formData, setFormData] = useState({
        display_name: '',
        slug: '',
        bio: '',
        phone: '',
        phone_country_code: DEFAULT_COUNTRY_CODE,
        whatsapp: '',
        whatsapp_country_code: DEFAULT_COUNTRY_CODE,
        wechat_id: '',
        email: '',
        image_filter: 'normal',
        theme_mode: 'dark',
        welcome_word: 'hello',
        welcome_duration: 3,
        gallery: [] as { id: string; url: string; caption?: string }[],
        files: [] as { id: string; url: string; title: string; size?: string; type: 'pdf' | 'doc' }[],
        company: '',
        job_title: '',
        avatar_url: '',
        social_links: [] as any[],
        special_edition: null as string | null,
        special_editions: [] as string[],
        selected_special_greeting_anim: null as string | null,
        enable_special_greeting_anim: false
    })

    const [isGenerating, setIsGenerating] = useState(false)
    const [showAIModal, setShowAIModal] = useState(false)
    const [aiKeywords, setAiKeywords] = useState('')

    // AI Avatar Generator State
    const [isAvatarGenerating, setIsAvatarGenerating] = useState(false)
    const [avatarStyle, setAvatarStyle] = useState('professional')
    const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState('')
    const [originalAvatarUrl, setOriginalAvatarUrl] = useState('')
    const avatarInputRef = useRef<HTMLInputElement>(null)

    const handleAvatarGenerate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            alert('Maximum file size is 5 MB.')
            return
        }

        setIsAvatarGenerating(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('style', avatarStyle)

        try {
            const res = await fetch('/api/generate-avatar', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()

            if (res.ok) {
                setGeneratedAvatarUrl(data.generated_url)
                setOriginalAvatarUrl(data.original_url)
            } else {
                alert(data.error || 'Could not generate avatar.')
            }
        } catch (err) {
            console.error(err)
            alert('Error connecting to AI')
        } finally {
            setIsAvatarGenerating(false)
            if (avatarInputRef.current) avatarInputRef.current.value = ''
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('genhub_user')
        localStorage.removeItem('genhub_activated')
        localStorage.removeItem('genhub_profile')
        window.location.href = '/login'
    }

    const applyAiAvatar = async () => {
        updateField('avatar_url', generatedAvatarUrl)
        if (userId) {
            await supabase.from('profiles').update({ avatar_url: generatedAvatarUrl }).eq('user_id', userId)
        }
        setGeneratedAvatarUrl('')
        setOriginalAvatarUrl('')
        // Scroll to top to see change
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Load initial data from Supabase (with localStorage fallback)
    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                // Fallback: load from localStorage for dev/local sessions
                const localUser = localStorage.getItem('genhub_user')
                const localProfile = localStorage.getItem('genhub_profile')
                if (localUser) {
                    const parsed = JSON.parse(localUser)
                    setUserId(parsed.id)
                }
                if (localProfile) {
                    const parsed = JSON.parse(localProfile)
                    const phone = splitPhoneNumber(parsed.phone)
                    const whatsapp = splitPhoneNumber(parsed.whatsapp)
                    setFormData(prev => ({
                        ...prev,
                        ...parsed,
                        phone: phone.number,
                        phone_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.phone_country_code) ? parsed.phone_country_code : phone.countryCode,
                        whatsapp: whatsapp.number,
                        whatsapp_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.whatsapp_country_code) ? parsed.whatsapp_country_code : whatsapp.countryCode
                    }))
                }
                return
            }
            setUserId(user.id)

            // Load user's serial numbers
            const { data: userSerials } = await supabase
                .from('serial_numbers')
                .select('id, serial_uuid, created_at, is_claimed')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true })
            setMySerials(userSerials || [])

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                // Fallback to localStorage if Supabase query fails
                const localProfile = localStorage.getItem('genhub_profile')
                if (localProfile) {
                    const parsed = JSON.parse(localProfile)
                    const phone = splitPhoneNumber(parsed.phone)
                    const whatsapp = splitPhoneNumber(parsed.whatsapp)
                    setFormData(prev => ({
                        ...prev,
                        ...parsed,
                        phone: phone.number,
                        phone_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.phone_country_code) ? parsed.phone_country_code : phone.countryCode,
                        whatsapp: whatsapp.number,
                        whatsapp_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.whatsapp_country_code) ? parsed.whatsapp_country_code : whatsapp.countryCode
                    }))
                    if (parsed.tier) setUserTier(parsed.tier.toUpperCase())
                }
                return
            }

            if (profile) {
                const uiTheme = profile.theme || {}
                const phone = splitPhoneNumber(profile.phone)
                const whatsapp = splitPhoneNumber(profile.whatsapp || uiTheme.whatsapp)
                const loadedData = {
                    display_name: profile.display_name || '',
                    slug: profile.slug || '',
                    bio: profile.bio || '',
                    phone: phone.number,
                    phone_country_code: phone.countryCode,
                    whatsapp: whatsapp.number,
                    whatsapp_country_code: whatsapp.countryCode,
                    wechat_id: uiTheme.wechat_id || '',
                    email: profile.email || '',
                    company: profile.company || '',
                    job_title: profile.job_title || '',
                    avatar_url: profile.avatar_url || '',
                    image_filter: uiTheme.image_filter || 'normal',
                    theme_mode: uiTheme.theme_mode || 'dark',
                    welcome_word: uiTheme.welcome_word || 'hello',
                    welcome_duration: WELCOME_DURATIONS.includes(Number(uiTheme.welcome_duration)) ? Number(uiTheme.welcome_duration) : 3,
                    // Fitur Pintasan
                    active_mode: uiTheme.active_mode || 'profile',
                    redirect_url: uiTheme.redirect_url || '',
                    redirect_type: uiTheme.redirect_type || 'direct',
                    redirect_message: uiTheme.redirect_message || '',
                    gallery: uiTheme.gallery || [],
                    files: uiTheme.files || [],
                    documents: profile.documents || [],
                    social_links: profile.social_links || [],
                    tier: profile.tier || 'FREE',
                    special_edition: profile.special_edition || null,
                    special_editions: Array.isArray(profile.special_editions)
                        ? profile.special_editions
                        : profile.special_edition
                            ? [profile.special_edition]
                            : [],
                    selected_special_greeting_anim: profile.selected_special_greeting_anim || (
                        Array.isArray(profile.special_editions) && profile.special_editions.length > 0 ? null : profile.special_edition || null
                    ),
                    enable_special_greeting_anim: profile.enable_special_greeting_anim || false
                }
                setFormData(loadedData)
                // Normalize tier to uppercase to handle 'Free', 'free', 'FREE' consistently
                const detectedTier = (profile.tier || 'FREE').toUpperCase()
                setUserTier(detectedTier)
                // Sync to localStorage for the live preview bridge
                localStorage.setItem('genhub_profile', JSON.stringify(loadedData))
            } else {
                // Try localStorage fallback if no Supabase profile yet (edge case)
                const profileStr = localStorage.getItem('genhub_profile')
                if (profileStr) {
                    const parsed = JSON.parse(profileStr)
                    const phone = splitPhoneNumber(parsed.phone)
                    const whatsapp = splitPhoneNumber(parsed.whatsapp)
                    setFormData(prev => ({
                        ...prev,
                        ...parsed,
                        phone: phone.number,
                        phone_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.phone_country_code) ? parsed.phone_country_code : phone.countryCode,
                        whatsapp: whatsapp.number,
                        whatsapp_country_code: COUNTRY_CODES.some(({ code }) => code === parsed.whatsapp_country_code) ? parsed.whatsapp_country_code : whatsapp.countryCode
                    }))
                    setUserTier((parsed.tier || 'FREE').toUpperCase())
                }
            }
        }
        fetchProfile()
    }, [])

    // 🔴 LIVE UPDATE: Sync form changes to localStorage immediately for live preview
    const syncToPreview = useCallback((newFormData: typeof formData) => {
        try {
            // Updated local storage for the preview pane to pick up changes instantly
            localStorage.setItem('genhub_profile', JSON.stringify({
                ...newFormData,
                phone: formatPhoneNumber(newFormData.phone_country_code, newFormData.phone),
                whatsapp: formatPhoneNumber(newFormData.whatsapp_country_code, newFormData.whatsapp)
            }))
        } catch (err) {
            console.error('Storage quota occurred:', err)
        }
    }, [])

    // Update form data and sync to preview
    const updateField = (field: string, value: any) => {
        const newFormData = { ...formData, [field]: value }
        setFormData(newFormData)
        syncToPreview(newFormData)
    }

    const updateSpecialGreetingSelection = (editionId: string | null) => {
        const newFormData = {
            ...formData,
            selected_special_greeting_anim: editionId,
            enable_special_greeting_anim: Boolean(editionId)
        }
        setFormData(newFormData)
        syncToPreview(newFormData)
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('File must be an image (JPG, PNG, etc.).')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Maximum file size is 5 MB.')
            return
        }

        if (!userId) {
            setError('Please sign in first.')
            return
        }

        setIsUploading(true)
        setError('')

        try {
            const publicUrl = await uploadAvatar(file, userId)
            const newFormData = { ...formData, avatar_url: publicUrl }
            setFormData(newFormData)
            syncToPreview(newFormData)
            
            // Auto-save to database
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', userId)
        } catch (err) {
            console.error(err)
            setError('Could not upload image. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }


    const handleRemovePhoto = async () => {
        // Delete from storage if it's a storage URL
        if (formData.avatar_url && formData.avatar_url.includes('/storage/')) {
            await deleteFile('avatars', formData.avatar_url)
        }
        const newFormData = { ...formData, avatar_url: '' }
        setFormData(newFormData)
        syncToPreview(newFormData)
        
        // Auto-save to database
        if (userId) {
            await supabase.from('profiles').update({ avatar_url: '' }).eq('user_id', userId)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Free Tier Limit: Max 2 Photos
        if (userTier === 'FREE' && (formData.gallery?.length || 0) >= 2) {
            alert('The Free plan allows up to 2 gallery photos. Upgrade to Premium for unlimited photos.')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Gallery photos must be 5 MB or smaller.')
            return
        }

        if (!userId) {
            alert('Please sign in first.')
            return
        }

        // Check Limit for FREE Users
        const localProfile = localStorage.getItem('genhub_profile')
        const profileData = localProfile ? JSON.parse(localProfile) : null
        const isFree = profileData?.tier === 'FREE'

        if (isFree && formData.gallery.length >= 3) {
            alert('Free plan users can upload up to 3 photos. Upgrade for unlimited uploads.')
            return
        }

        try {
            const publicUrl = await uploadGalleryImage(file, userId)
            const newItem = {
                id: Date.now().toString(),
                url: publicUrl,
                caption: file.name
            }
            const newGallery = [...formData.gallery, newItem]
            updateField('gallery', newGallery)
        } catch (err) {
            console.error(err)
            alert('Could not upload gallery photo.')
        }
    }

    const removeGalleryItem = async (id: string) => {
        const item = formData.gallery.find(g => g.id === id)
        if (item?.url && item.url.includes('/storage/')) {
            await deleteFile('gallery', item.url)
        }
        const newGallery = formData.gallery.filter(item => item.id !== id)
        updateField('gallery', newGallery)
    }

    const addFileLink = () => {
        // Free Tier Limit: Max 1 Document
        if (userTier === 'FREE' && formData.files.length >= 1) {
            alert('The Free plan allows 1 document or link. Upgrade to Premium to add more.')
            return
        }

        if (!newFileTitle.trim() || !newFileUrl.trim()) {
            alert('Please enter a title and URL.')
            return
        }

        // Basic URL validation
        let url = newFileUrl.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url
        }

        const newItem = {
            id: Date.now().toString(),
            url: url,
            title: newFileTitle.trim(),
            type: 'link' as const
        }
        const newFiles = [...formData.files, newItem]
        updateField('files', newFiles)
        setNewFileTitle('')
        setNewFileUrl('')
        setShowAddFile(false)
    }

    const removeFileItem = (id: string) => {
        const newFiles = formData.files.filter(item => item.id !== id)
        updateField('files', newFiles)
    }

    const generateAIBio = async () => {
        if (!aiKeywords.trim()) {
            alert('Enter a few keywords first.')
            return
        }

        setIsGenerating(true)
        try {
            const response = await fetch('/api/generate-bio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: aiKeywords })
            })

            const data = await response.json()
            if (response.ok && data.bio) {
                updateField('bio', data.bio)
                setShowAIModal(false)
                setAiKeywords('')
            } else {
                console.error('AI API Error Details:', data)
                const errorMsg = data.error || 'Could not generate bio. Please try again.'
                alert(`Error: ${errorMsg}`)
            }
        } catch (err) {
            console.error(err)
            alert('There was a problem connecting to AI.')
        } finally {
            setIsGenerating(false)
        }
    }


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        setIsSaved(false)

        // FREE TIER RESTRICTION: Lock Slug
        if (userTier === 'FREE') {
            const localProfile = localStorage.getItem('genhub_profile')
            const storedSlug = localProfile ? JSON.parse(localProfile).slug : ''
            if (storedSlug && formData.slug !== storedSlug) {
                // Silently revert or warn? Warn.
                // Actually the input is disabled, but for safety:
                // We don't block save, we just ignore the slug change in the payload below.
            }
        }

        if (!formData.slug) {
            setError('A custom profile URL is required.')
            setIsLoading(false)
            return
        }

        if (!/^[a-z0-9-]+$/.test(formData.slug)) {
            setError('Your profile URL can only contain lowercase letters, numbers, and hyphens (-).')
            setIsLoading(false)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                // Local only logic (dev mode)
                syncToPreview(formData)
                localStorage.setItem('genhub_profile', JSON.stringify(formData))
                setIsSaved(true)
                setTimeout(() => setIsSaved(false), 3000)
                setIsLoading(false)
                return
            }

            // Check if slug is taken by another user
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('slug', formData.slug)
                .neq('user_id', user.id)
                .single()

            if (existingUser) {
                setError('This custom profile URL is already in use. Choose another one.')
                setIsLoading(false)
                return
            }

            // Construct Payload
            const updates: any = {
                display_name: formData.display_name,
                bio: formData.bio,
                company: formData.company,
                job_title: formData.job_title,
                avatar_url: formData.avatar_url,
                phone: formatPhoneNumber(formData.phone_country_code, formData.phone),
                email: formData.email,
                social_links: formData.social_links,
                special_edition: formData.special_editions[0] || formData.special_edition,
                special_editions: formData.special_editions,
                selected_special_greeting_anim: formData.selected_special_greeting_anim,
                enable_special_greeting_anim: formData.enable_special_greeting_anim,
                // Construct basic theme object if needed by DB, or flattened fields
                // DB expects 'theme' jsonb.
                theme: {
                    whatsapp: formatPhoneNumber(formData.whatsapp_country_code, formData.whatsapp),
                    wechat_id: formData.wechat_id.trim(),
                    image_filter: userTier === 'FREE' ? 'normal' : formData.image_filter,
                    theme_mode: userTier === 'FREE' ? 'light' : formData.theme_mode,
                    welcome_word: userTier === 'FREE' ? 'Hello' : formData.welcome_word,
                    gallery: formData.gallery,
                    files: formData.files,
                    links: formData.social_links // Legacy
                },
                updated_at: new Date().toISOString()
            }

            // Slug restriction logic
            if (userTier !== 'FREE') {
                updates.slug = formData.slug
            }

            // Welcome Word & Theme restrictions are already handled in the 'theme' object construction above.
            // We removed the redundant top-level assignment that caused schema cache errors.

            // Documents (Files) Restriction is handled in addFileLink, but safety check:
            if (userTier === 'FREE' && formData.files.length > 1) {
                // If they somehow have more than 1, we save it but maybe warn? 
                // Better to just let it be if existing, but preventing new ones.
            }

            // USE ADMIN API to bypass RLS for critical fields if needed, 
            // but 'profiles' UPDATE should be allowed for own user via standard RLS.
            // However, strictly enforcing "Tier" logic server-side or via Admin API is safer.
            // Given I implemented the Admin API specifically for "Subscription Updates" (B2B/Premium),
            // maybe standard profile updates are fine via client IF RLS allows it.
            // The previous issue was specifically dealing with Subscription/Tier changes.
            // Regular profile updates usually work fine client-side.
            // BUT, to be safe and consistent with my verified fix:

            const res = await fetch('/api/admin/users/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    ...updates
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Update failed')
            }

            setIsSaved(true)
            localStorage.setItem('genhub_profile', JSON.stringify({ ...formData }))
            setTimeout(() => setIsSaved(false), 3000)

        } catch (err: any) {
            console.error('Save error:', err)
            setError('Could not save profile: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const availableSpecialEditions = getAvailableSpecialEditions(formData)
    const selectedSpecialEdition = SPECIAL_EDITIONS.find((edition) => edition.id === formData.selected_special_greeting_anim)

    return (
        <div className="mx-auto flex max-w-[1200px] gap-8 px-5 pb-[150px] pt-6">
          <div className="min-w-0 flex-1">
            <header>
                <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Edit Profile</h1>
                <p className="mt-1.5 text-[13px] text-ink-2">Add the information shown on your digital card</p>
                <span
                    className="mt-3 inline-block rounded-full bg-fill-subtle px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink-2"
                    style={{ fontFamily: 'var(--font-mono)' }}
                >
                    {userTier} plan
                </span>
            </header>

            <form onSubmit={handleSave}>
                {/* Profile photo */}
                <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                            <Camera className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold">Profile Photo</h2>
                            <p className="text-[12px] text-ink-2">Your main image on the public profile</p>
                        </div>
                    </div>

                    <div className="mt-4 flex items-start gap-4">
                        <div className="relative shrink-0">
                            {formData.avatar_url ? (
                                <div className="group relative">
                                    <div
                                        className="h-28 w-28 overflow-hidden rounded-card-sm bg-fill-subtle"
                                        style={{
                                            backgroundImage: `url(${formData.avatar_url})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemovePhoto}
                                        aria-label="Remove photo"
                                        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink shadow-row"
                                    >
                                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center rounded-card-sm bg-ink/45 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <Camera className="h-5 w-5 text-white" strokeWidth={1.8} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-card-sm border border-dashed border-ink/15 bg-fill-subtle"
                                >
                                    {isUploading ? (
                                        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
                                    ) : (
                                        <>
                                            <Upload className="h-6 w-6 text-ink-3" strokeWidth={1.6} />
                                            <span className="text-[11px] text-ink-2">Upload</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>

                        <div className="min-w-0 flex-1 text-[12px] text-ink-2">
                            <p className="flex items-center gap-2">
                                <ImageIcon className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.8} />
                                JPG, PNG, atau WebP
                            </p>
                            <p className="mt-1.5 flex items-center gap-2">
                                <Upload className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.8} />
                                Maximum 5 MB
                            </p>
                            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
                                Use a portrait photo with a 3:4 ratio for the best fit.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Greeting */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                            <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold">Greeting</h2>
                            <p className="text-[12px] text-ink-2">Shown when someone first opens your card</p>
                        </div>
                    </div>

                    <div className="relative mt-4">
                        <input
                            type="text"
                            value={formData.welcome_word}
                            onChange={(e) => updateField('welcome_word', e.target.value)}
                            disabled={userTier === 'FREE'}
                            placeholder="hello"
                            maxLength={30}
                            className={`w-full rounded-row bg-fill-subtle px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-3 ${userTier === 'FREE' ? 'cursor-not-allowed opacity-70' : ''}`}
                            style={{ fontFamily: "var(--font-mono), 'JetBrains Mono', monospace" }}
                        />
                        {userTier === 'FREE' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-semibold text-coral-soft-ink">
                                PREMIUM
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-[11px] text-ink-3">Examples: hello, welcome, nice to meet you</p>

                    <div className="mt-4">
                        <div className="flex items-baseline justify-between gap-3">
                            <div>
                                <h3 className="text-[13.5px] font-semibold">Greeting Duration</h3>
                                <p className="mt-0.5 text-[12px] text-ink-2">How long the greeting stays on screen</p>
                            </div>
                            <span className="shrink-0 text-[12px] font-medium text-ink-2">{formData.welcome_duration} sec</span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {WELCOME_DURATIONS.map((duration) => (
                                <button
                                    key={duration}
                                    type="button"
                                    onClick={() => updateField('welcome_duration', duration)}
                                    aria-pressed={formData.welcome_duration === duration}
                                    className={`rounded-full py-2.5 text-[12px] font-medium transition-colors ${formData.welcome_duration === duration
                                        ? 'bg-ink text-white'
                                        : 'bg-fill-subtle text-ink-2 hover:text-ink'
                                        }`}
                                >
                                    {duration}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {availableSpecialEditions.length > 0 && (
                        <div className="mt-5 border-t border-ink/[0.08] pt-5">
                            <h3 className="text-[13.5px] font-semibold">Special Edition Animation</h3>
                            <p className="mt-0.5 text-[12px] text-ink-2">Choose an animation for the greeting screen</p>

                            <div className="mt-3 grid gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateSpecialGreetingSelection(null)}
                                    className={`w-full rounded-row px-4 py-3 text-left text-[13.5px] font-medium transition-colors ${!formData.selected_special_greeting_anim
                                        ? 'bg-ink text-white'
                                        : 'bg-fill-subtle text-ink-2'
                                        }`}
                                >
                                    No animation
                                </button>
                                {SPECIAL_EDITIONS.filter((edition) => availableSpecialEditions.includes(edition.id)).map((edition) => (
                                    <button
                                        key={edition.id}
                                        type="button"
                                        onClick={() => updateSpecialGreetingSelection(edition.id)}
                                        className={`w-full rounded-row px-4 py-3 text-left text-[13.5px] font-medium transition-colors ${formData.selected_special_greeting_anim === edition.id
                                            ? 'bg-ink text-white'
                                            : 'bg-fill-subtle text-ink-2'
                                            }`}
                                    >
                                        {edition.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                            <h4 className="text-[13.5px] font-semibold">Enable Animation</h4>
                                    <p className="mt-0.5 text-[12px] text-ink-2">
                                        {selectedSpecialEdition ? `Repeat ${selectedSpecialEdition.animationLabel} on the greeting screen.` : 'Choose an animation first.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    disabled={!formData.selected_special_greeting_anim}
                                    onClick={() => updateField('enable_special_greeting_anim', !formData.enable_special_greeting_anim)}
                                    aria-label="Enable special edition animation"
                                    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${formData.enable_special_greeting_anim ? 'bg-ink' : 'bg-track'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-row transition-transform ${formData.enable_special_greeting_anim ? 'translate-x-7' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Photo gallery */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[15px] font-semibold">Photo Gallery</h2>
                        <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-fill-subtle px-3.5 py-2 text-[12px] font-medium text-ink-2">
                            <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                            Upload
                            <input type="file" className="hidden" accept="image/*" onChange={handleGalleryUpload} />
                        </label>
                    </div>

                    {formData.gallery.length === 0 ? (
                        <div className="mt-4 rounded-row border border-dashed border-ink/15 p-8 text-center text-[12.5px] text-ink-3">
                            No gallery photos yet
                        </div>
                    ) : (
                        <div className="mt-4 grid grid-cols-3 gap-2.5">
                            {formData.gallery.map(item => (
                                <div key={item.id} className="group relative aspect-square overflow-hidden rounded-row bg-fill-subtle">
                                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeGalleryItem(item.id)}
                                        aria-label="Remove gallery photo"
                                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <X className="h-3 w-3" strokeWidth={2} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Documents and links */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[15px] font-semibold">Documents & Links</h2>
                        <button
                            type="button"
                            onClick={() => setShowAddFile(!showAddFile)}
                            className="flex items-center gap-1.5 rounded-full bg-fill-subtle px-3.5 py-2 text-[12px] font-medium text-ink-2"
                        >
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
                            Add
                        </button>
                    </div>

                    {showAddFile && (
                        <div className="mt-4 rounded-row bg-fill-subtle p-4">
                            <div>
                                <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Document title</label>
                                <input
                                    type="text"
                                    value={newFileTitle}
                                    onChange={(e) => setNewFileTitle(e.target.value)}
                                    placeholder="Example: Certificate of Authenticity"
                                    className="mt-1.5 w-full rounded-row bg-surface px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                            <div className="mt-3">
                                    <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Link URL</label>
                                <input
                                    type="text"
                                    value={newFileUrl}
                                    onChange={(e) => setNewFileUrl(e.target.value)}
                                    placeholder="https://drive.google.com/file/..."
                                    className="mt-1.5 w-full rounded-row bg-surface px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    onClick={addFileLink}
                                    className="flex-1 rounded-full bg-ink py-2.5 text-[12.5px] font-medium text-white"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddFile(false); setNewFileTitle(''); setNewFileUrl('') }}
                                    className="rounded-full bg-surface px-5 py-2.5 text-[12.5px] font-medium text-ink-2"
                                >
                                        Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {formData.files.length === 0 ? (
                        <div className="mt-4 rounded-row border border-dashed border-ink/15 p-8 text-center text-[12.5px] text-ink-3">
                            No documents yet. Add a Google Drive link, PDF, or another file.
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-2.5">
                            {formData.files.map(file => (
                                <div key={file.id} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-row bg-fill-subtle p-3">
                                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-2">
                                            <FileText className="h-4 w-4" strokeWidth={1.8} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13.5px] font-medium">{file.title}</p>
                                            <p className="truncate text-[11px] text-ink-3">{file.url}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFileItem(file.id)}
                                        aria-label="Delete document"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-coral-soft hover:text-coral-soft-ink"
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Informasi dasar */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                            <User className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <h2 className="text-[15px] font-semibold">Basic Information</h2>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Display name</label>
                            <input
                                type="text"
                                value={formData.display_name}
                                onChange={(e) => updateField('display_name', e.target.value)}
                                placeholder="Your full name"
                                className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Card URL</label>
                            <div className="relative mt-1.5">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
                                    my.gentanala.com/
                                </span>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                    disabled={userTier === 'FREE'}
                                    placeholder="yourname"
                                    className={`w-full rounded-row bg-fill-subtle py-3 pl-[8.6rem] pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3 ${userTier === 'FREE' ? 'cursor-not-allowed opacity-70' : ''}`}
                                />
                                {userTier === 'FREE' && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-semibold text-coral-soft-ink">
                                        PREMIUM
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Company</label>
                            <div className="relative mt-1.5">
                                <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => updateField('company', e.target.value)}
                                    placeholder="Company name"
                                    className="w-full rounded-row bg-fill-subtle py-3 pl-11 pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Job title</label>
                            <div className="relative mt-1.5">
                                <Briefcase className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                <input
                                    type="text"
                                    value={formData.job_title}
                                    onChange={(e) => updateField('job_title', e.target.value)}
                                    placeholder="CEO, Manager, etc."
                                    className="w-full rounded-row bg-fill-subtle py-3 pl-11 pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Short bio</label>
                            {userTier !== 'FREE' && (
                                <button
                                    type="button"
                                    onClick={() => setShowAIModal(true)}
                                    className="flex items-center gap-1.5 rounded-full bg-fill-subtle px-3 py-1.5 text-[11px] font-medium text-ink-2"
                                >
                                    <Sparkles className="h-3 w-3" strokeWidth={1.8} />
                                    Write with AI
                                </button>
                            )}
                        </div>

                        {showAIModal && (
                            <div className="mt-3 rounded-row bg-fill-subtle p-4">
                                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-2">What would you like to highlight?</p>
                                <input
                                    type="text"
                                    value={aiKeywords}
                                    onChange={(e) => setAiKeywords(e.target.value)}
                                    placeholder="Example: architect, watch founder, golf enthusiast"
                                    className="mt-2 w-full rounded-row bg-surface px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), generateAIBio())}
                                />
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={generateAIBio}
                                        disabled={isGenerating}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-[12.5px] font-medium text-white disabled:opacity-50"
                                    >
                                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
                                        {isGenerating ? 'Generating…' : 'Generate Bio'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAIModal(false)}
                                        className="rounded-full bg-surface px-5 py-2.5 text-[12.5px] font-medium text-ink-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="relative mt-1.5">
                            <textarea
                                value={formData.bio}
                                onChange={(e) => updateField('bio', e.target.value)}
                                placeholder="Write a short bio..."
                                rows={3}
                                maxLength={200}
                                className="w-full resize-none rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                            />
                            <span
                                className="absolute bottom-3 right-3 text-[10px] text-ink-3"
                                style={{ fontFamily: 'var(--font-mono)' }}
                            >
                                {formData.bio.length}/200
                            </span>
                        </div>
                    </div>
                </section>

                {/* Direct contact details */}
                <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                            <Phone className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <h2 className="text-[15px] font-semibold">Direct Contact</h2>
                    </div>

                    <div className="mt-4 grid gap-3">
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Phone Number</label>
                            <div className="mt-1.5 flex overflow-hidden rounded-row bg-fill-subtle">
                                <div className="relative shrink-0 border-r border-ink/[0.08]">
                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                    <select
                                        value={formData.phone_country_code}
                                        onChange={(e) => updateField('phone_country_code', e.target.value)}
                                        aria-label="Phone country code"
                                        className="h-full w-[108px] bg-transparent py-3 pl-9 pr-1 text-[13px] font-medium text-ink outline-none"
                                    >
                                        {COUNTRY_CODES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                                    </select>
                                </div>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
                                    inputMode="numeric"
                                    placeholder="812 3456 7890"
                                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">WhatsApp Number</label>
                            <div className="mt-1.5 flex overflow-hidden rounded-row bg-fill-subtle">
                                <div className="relative shrink-0 border-r border-ink/[0.08]">
                                    <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                    <select
                                        value={formData.whatsapp_country_code}
                                        onChange={(e) => updateField('whatsapp_country_code', e.target.value)}
                                        aria-label="WhatsApp country code"
                                        className="h-full w-[108px] bg-transparent py-3 pl-9 pr-1 text-[13px] font-medium text-ink outline-none"
                                    >
                                        {COUNTRY_CODES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                                    </select>
                                </div>
                                <input
                                    type="tel"
                                    value={formData.whatsapp}
                                    onChange={(e) => updateField('whatsapp', e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
                                    inputMode="numeric"
                                    placeholder="812 3456 7890"
                                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">WeChat ID</label>
                            <div className="relative mt-1.5">
                                <MessageCircle className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                <input
                                    type="text"
                                    value={formData.wechat_id}
                                    onChange={(e) => updateField('wechat_id', e.target.value)}
                                    placeholder="Your WeChat ID"
                                    className="w-full rounded-row bg-fill-subtle py-3 pl-11 pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Email</label>
                            <div className="relative mt-1.5">
                                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    placeholder="name@email.com"
                                    className="w-full rounded-row bg-fill-subtle py-3 pl-11 pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pemberitahuan */}
                <div className="mt-4 h-6">
                    {error && (
                        <p className="flex items-center gap-2 text-[12.5px] text-coral-soft-ink">
                            <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
                            {error}
                        </p>
                    )}
                    {isSaved && (
                        <p className="flex items-center gap-2 text-[12.5px] text-success-soft-ink">
                            <CheckCircle className="h-4 w-4" strokeWidth={1.8} />
                            Saved
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99] disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <Save className="h-4 w-4" strokeWidth={1.8} />
                            Save Changes
                        </>
                    )}
                </button>
            </form>

            {/* Connected NFC cards */}
            <section className="mt-7">
                <h2 className="text-[19px] font-semibold tracking-[-0.025em]">My NFC Cards</h2>
                <p className="mt-1.5 text-[12.5px] text-ink-2">
                    All cards connected to your account. You can unlink them one at a time without affecting other cards.
                </p>

                {mySerials.length === 0 ? (
                    <div className="mt-4 rounded-card border border-dashed border-ink/15 bg-surface/60 p-8 text-center text-[12.5px] text-ink-3">
                        No cards connected yet
                    </div>
                ) : (
                    <div className="mt-4 grid gap-2.5">
                        {mySerials.map((serial, idx) => (
                            <div key={serial.id} className="flex items-center justify-between gap-3 rounded-card-sm bg-surface p-4 shadow-row">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-ink-3">#{idx + 1}</span>
                                        <span
                                            className="truncate text-[12.5px] text-ink-2"
                                            style={{ fontFamily: 'var(--font-mono)' }}
                                        >
                                            {serial.serial_uuid.substring(0, 18)}...
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-ink-3">
                                        Claimed {new Date(serial.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm(`Unlink card #${idx + 1} (${serial.serial_uuid.substring(0, 8)}...) from your account?\n\nThis card will be unclaimed and can be claimed by someone else.\nYour profile and other cards will NOT be affected.`)) return

                                        try {
                                            const res = await fetch('/api/admin/users/delete', {
                                                method: 'DELETE',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: userId, serialId: serial.id, action: 'unclaim' })
                                            })
                                            const data = await res.json()
                                            if (data.error) {
                                                alert('Could not unlink card: ' + data.error)
                                            } else {
                                                alert('Card unlinked. Your profile is safe.')
                                                setMySerials(prev => prev.filter(s => s.id !== serial.id))
                                            }
                                        } catch (err) {
                                            alert('Could not unlink card. Please try again later.')
                                        }
                                    }}
                                    className="shrink-0 whitespace-nowrap rounded-full bg-coral-soft px-3.5 py-2 text-[11.5px] font-semibold text-coral-soft-ink transition-transform active:scale-[0.98]"
                                >
                                    Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
                    Unlinking removes that card from your account. Your profile and other cards stay as they are;
                    the unlinked card becomes available for someone else to claim.
                </p>
            </section>

            {/* Account sign-out */}
            <button
                type="button"
                onClick={handleLogout}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-surface py-3.5 text-[13px] font-medium text-ink-2 shadow-row transition-transform active:scale-[0.99]"
            >
                <LogOut className="h-4 w-4" strokeWidth={1.8} />
                Sign out
            </button>
          </div>

            <DesktopPreview />
        </div>
    )
}
