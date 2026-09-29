'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SaveCardButton({ profileId, profileSlug, className }: { profileId: string; profileSlug: string; className: string }) {
    const supabase = createClient()
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showCollectionLink, setShowCollectionLink] = useState(false)

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('saved_profiles').select('profile_id').eq('user_id', user.id).eq('profile_id', profileId).maybeSingle()
                setSaved(Boolean(data))
            }
            setLoading(false)
        }
        void load()
    }, [profileId, supabase])

    const toggleSave = async () => {
        if (saving) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            window.location.assign(`/login?next=${encodeURIComponent(`/${profileSlug}`)}`)
            return
        }
        setSaving(true)
        if (saved) {
            const { error } = await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('profile_id', profileId)
            if (!error) { setSaved(false); setShowCollectionLink(false) }
        } else {
            const { error } = await supabase.from('saved_profiles').upsert({ user_id: user.id, profile_id: profileId }, { onConflict: 'user_id,profile_id' })
            if (!error) { setSaved(true); setShowCollectionLink(true) }
        }
        setSaving(false)
    }

    return <div className="relative shrink-0">
        <button onClick={() => void toggleSave()} disabled={loading || saving} className={className} title={saved ? 'Remove from saved cards' : 'Save this card'} aria-label={saved ? 'Remove from saved cards' : 'Save this card'}>
            {loading || saving ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </button>
        {showCollectionLink && <Link href="/dashboard/analytics#saved" className="absolute right-0 top-[calc(100%+0.5rem)] z-20 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white shadow-ink">Saved — view collection</Link>}
    </div>
}
