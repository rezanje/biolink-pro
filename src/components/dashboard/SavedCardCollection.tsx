'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bookmark, ChevronRight, ExternalLink, FolderPlus, Loader2, Search, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiLanguage } from '@/components/UiLanguageProvider'
import CardFolderTile, { type CardPreview } from './CardFolderTile'

type SavedCard = { profile_id: string; folder_id: string | null; created_at: string; profile: CardPreview | null }
type SavedCardRow = Omit<SavedCard, 'profile'> & { profile: CardPreview | CardPreview[] | null }
type CardFolder = { id: string; name: string; created_at: string }
type FolderAction = { kind: 'create' } | { kind: 'rename' | 'delete'; folder: CardFolder }

export default function SavedCardCollection() {
    const { t, locale } = useUiLanguage()
    const supabase = createClient()
    const [userId, setUserId] = useState<string | null>(null)
    const [cards, setCards] = useState<SavedCard[]>([])
    const [folders, setFolders] = useState<CardFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [action, setAction] = useState<FolderAction | null>(null)
    const dateLocale = locale === 'id' ? 'id-ID' : locale === 'zh-CN' ? 'zh-CN' : 'en-US'

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError) throw authError
            if (!user) { window.location.assign('/login?next=/dashboard/analytics'); return }
            setUserId(user.id)
            const [saved, folderResult] = await Promise.all([
                supabase.from('saved_profiles').select('profile_id,folder_id,created_at,profile:profiles(slug,display_name,company,job_title,avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('card_folders').select('id,name,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
            ])
            if (saved.error) throw saved.error
            if (folderResult.error) throw folderResult.error
            const rows = (saved.data || []) as unknown as SavedCardRow[]
            setCards(rows.map(({ profile, ...card }) => ({ ...card, profile: Array.isArray(profile) ? profile[0] || null : profile })))
            const nextFolders = folderResult.data || []
            setFolders(nextFolders)
            setSelectedFolder(current => current && current !== 'unfiled' && !nextFolders.some(folder => folder.id === current) ? null : current)
            setLoadError(false)
        } catch {
            setLoadError(true)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        const refresh = () => { if (!document.hidden && !busy && !action) void load() }
        window.addEventListener('focus', refresh)
        document.addEventListener('visibilitychange', refresh)
        return () => {
            window.removeEventListener('focus', refresh)
            document.removeEventListener('visibilitychange', refresh)
        }
    }, [load, busy, action])

    const saveFolder = async (name: string) => {
        if (!userId || !action || busy) return
        setBusy(true)
        setError('')
        try {
            if (action.kind === 'delete') {
                const { data, error: saveError } = await supabase.from('card_folders').delete().eq('user_id', userId).eq('id', action.folder.id).select('id').single()
                if (saveError) throw saveError
                setFolders(current => current.filter(folder => folder.id !== data.id))
                setCards(current => current.map(card => card.folder_id === data.id ? { ...card, folder_id: null } : card))
                setSelectedFolder(current => current === data.id ? 'unfiled' : current)
            } else {
                const query = action.kind === 'create'
                    ? supabase.from('card_folders').insert({ user_id: userId, name: name.trim() })
                    : supabase.from('card_folders').update({ name: name.trim() }).eq('user_id', userId).eq('id', action.folder.id)
                const { data, error: saveError } = await query.select('id,name,created_at').single()
                if (saveError) throw saveError
                setFolders(current => action.kind === 'create' ? [...current, data] : current.map(folder => folder.id === data.id ? data : folder))
            }
            setAction(null)
        } catch (failure) {
            setError(failure && typeof failure === 'object' && 'code' in failure && failure.code === '23505' ? 'A folder with this name already exists.' : 'Could not save folder. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    const moveCard = async (card: SavedCard, folderId: string) => {
        if (!userId || busy) return
        setBusy(true)
        setError('')
        try {
            const { error: saveError } = await supabase.from('saved_profiles').update({ folder_id: folderId || null }).eq('user_id', userId).eq('profile_id', card.profile_id).select('profile_id').single()
            if (saveError) throw saveError
            setCards(current => current.map(item => item.profile_id === card.profile_id ? { ...item, folder_id: folderId || null } : item))
        } catch {
            setError('Could not move card. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    const removeCard = async (profileId: string) => {
        if (!userId || busy) return
        setBusy(true)
        setError('')
        try {
            const { error: saveError } = await supabase.from('saved_profiles').delete().eq('user_id', userId).eq('profile_id', profileId).select('profile_id').single()
            if (saveError) throw saveError
            setCards(current => current.filter(card => card.profile_id !== profileId))
        } catch {
            setError('Could not remove card. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    const openAction = (nextAction: FolderAction) => { setError(''); setAction(nextAction) }
    const visibleCards = cards.filter(card => card.profile !== null)
    const folderCards = (folderId: string | null) => visibleCards.filter(card => card.folder_id === folderId).map(card => card.profile!)
    const folderName = selectedFolder === 'unfiled' ? t('Unfiled') : folders.find(folder => folder.id === selectedFolder)?.name
    const filteredCards = visibleCards.filter(card => {
        const inFolder = selectedFolder !== null && (selectedFolder === 'unfiled' ? card.folder_id === null : card.folder_id === selectedFolder)
        return inFolder && [card.profile?.display_name, card.profile?.company, card.profile?.job_title].filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    })

    return <section id="saved" aria-labelledby="card-collection-heading" className="scroll-mt-6">
        <div className="flex items-start justify-between gap-3">
            <div><h2 id="card-collection-heading" className="text-[20px] font-semibold tracking-[-0.025em]">{t('Cards Collection')}</h2><p className="mt-1 text-[12.5px] text-ink-2">{t('Your network, organized your way.')}</p></div>
            <button type="button" onClick={() => openAction({ kind: 'create' })} disabled={loading || loadError || busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2.5 text-[12px] font-medium text-white shadow-ink disabled:opacity-50"><FolderPlus className="h-4 w-4" />{t('New folder')}</button>
        </div>

        {error && !action && <p role="alert" className="mt-4 rounded-xl bg-coral-soft p-3 text-[12px] text-coral-soft-ink">{t(error)}</p>}
        {loading ? <div className="flex h-52 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /><span className="sr-only">{t('Loading collection')}</span></div> : loadError ? <div role="alert" className="mt-5 rounded-card bg-surface p-6 text-center shadow-row"><p className="text-[13px] text-ink-2">{t('Could not load collection. Please try again.')}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-full bg-ink px-4 py-2 text-[12px] text-white">{t('Try again')}</button></div> : <>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {folders.map(folder => <CardFolderTile key={folder.id} name={folder.name} cards={folderCards(folder.id)} selected={selectedFolder === folder.id} disabled={busy} onOpen={() => { setSelectedFolder(folder.id); setSearch('') }} onRename={() => openAction({ kind: 'rename', folder })} onDelete={() => openAction({ kind: 'delete', folder })} />)}
                <CardFolderTile name={t('Unfiled')} cards={folderCards(null)} selected={selectedFolder === 'unfiled'} disabled={busy} onOpen={() => { setSelectedFolder('unfiled'); setSearch('') }} />
            </div>

            {selectedFolder !== null && <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
                <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
                    <button type="button" onClick={() => { setSelectedFolder(null); setSearch('') }} className="shrink-0 rounded-md py-1 font-medium text-ink-2 hover:underline">{t('Back to folders')}</button>
                    {folderName && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" /><span className="truncate font-semibold">{folderName}</span></>}
                </div>
                <label className="relative block w-full sm:w-60"><span className="sr-only">{t('Search cards')}</span><Search className="absolute left-3 top-3 h-4 w-4 text-ink-3" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search cards')} className="w-full rounded-full bg-surface py-2.5 pl-9 pr-3 text-[12px] shadow-row outline-none focus-visible:ring-2 focus-visible:ring-ink/30" /></label>
            </div>

            {filteredCards.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredCards.map(card => <article key={card.profile_id} className="relative min-w-0 rounded-card-sm bg-surface p-3 shadow-row">
                    <Link href={`/${card.profile!.slug}`} target="_blank" rel="noopener noreferrer" aria-label={t('Open card for {name}', { name: card.profile!.display_name || t('Gentanala member') })} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                        <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-fill-subtle text-[30px] font-semibold text-ink-2">{card.profile!.avatar_url ? <Image src={card.profile!.avatar_url} alt="" width={240} height={160} unoptimized className="h-full w-full object-cover" /> : card.profile!.display_name?.charAt(0).toUpperCase() || 'G'}</div>
                        <p className="mt-3 truncate text-[13px] font-semibold">{card.profile!.display_name || t('Gentanala member')}</p>
                        <p className="mt-1 truncate text-[11px] text-ink-2">{[card.profile!.job_title, card.profile!.company].filter(Boolean).join(' · ') || t('Digital business card')}</p>
                        <p className="mt-2 flex items-center justify-between text-[10px] text-ink-3"><span>{t('Saved')} {new Date(card.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</span><ExternalLink className="h-3 w-3 shrink-0" /></p>
                    </Link>
                    <label className="mt-3 block"><span className="mb-1 block text-[10px] text-ink-2">{t('Move to folder')}</span><select aria-label={t('Folder for {name}', { name: card.profile!.display_name || t('Card') })} value={card.folder_id || ''} onChange={event => void moveCard(card, event.target.value)} disabled={busy} className="w-full min-w-0 rounded-lg border border-hairline bg-fill-subtle p-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-50"><option value="">{t('Unfiled')}</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
                    <button type="button" onClick={() => void removeCard(card.profile_id)} disabled={busy} aria-label={t('Remove {name} from saved cards', { name: card.profile!.display_name || t('Card') })} className="absolute right-2 top-2 rounded-full bg-surface/95 p-2 text-ink-2 shadow-row hover:bg-coral-soft hover:text-coral-soft-ink disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </article>)}
            </div> : <div className="mt-4 rounded-card border border-dashed border-ink/15 bg-surface/60 px-5 py-8 text-center"><Bookmark className="mx-auto mb-3 h-8 w-8 text-ink-3" strokeWidth={1.5} /><h3 className="text-[14px] font-medium">{t(search ? 'No matching cards' : selectedFolder ? 'This folder is empty' : 'No saved cards yet')}</h3><p className="mt-2 text-[12px] text-ink-2">{t(search ? 'Try another name or company.' : selectedFolder ? 'Choose a folder from the menu on any saved card to move it here.' : 'Bookmark any Gentanala card to build your personal network collection.')}</p></div>}
            </>}
        </>}

        {action && <FolderDialog key={action.kind === 'create' ? 'create' : `${action.kind}-${action.folder.id}`} action={action} busy={busy} error={error} onClose={() => { if (!busy) { setAction(null); setError('') } }} onSave={name => void saveFolder(name)} />}
    </section>
}

function FolderDialog({ action, busy, error, onClose, onSave }: { action: FolderAction; busy: boolean; error: string; onClose: () => void; onSave: (name: string) => void }) {
    const { t } = useUiLanguage()
    const dialog = useRef<HTMLDialogElement>(null)
    const [name, setName] = useState(action.kind === 'create' ? '' : action.folder.name)
    useEffect(() => { dialog.current?.showModal() }, [])
    const title = action.kind === 'create' ? 'New folder' : action.kind === 'rename' ? 'Rename folder' : 'Delete folder'

    return <dialog ref={dialog} aria-labelledby="folder-dialog-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-card border-0 bg-surface p-0 text-ink shadow-card backdrop:bg-ink/25 backdrop:backdrop-blur-sm">
        <form onSubmit={event => { event.preventDefault(); if (action.kind === 'delete' || name.trim()) onSave(name) }} className="p-6">
            <div className="flex items-center justify-between gap-3"><h3 id="folder-dialog-title" className="text-[19px] font-semibold">{t(title)}</h3><button type="button" onClick={onClose} disabled={busy} aria-label={t('Close')} className="rounded-full p-2 text-ink-2"><X className="h-4 w-4" /></button></div>
            {action.kind === 'delete' ? <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{t('Delete "{name}"? Its cards will move to Unfiled and stay in your collection.', { name: action.folder.name })}</p> : <label className="mt-4 block text-[12px] font-medium">{t('Folder name')}<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder={t('e.g. Clients, Friends, Events')} disabled={busy} className="mt-2 w-full rounded-xl border border-hairline bg-fill-subtle px-3 py-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ink/30" /></label>}
            {error && <p role="alert" className="mt-3 text-[12px] text-coral-soft-ink">{t(error)}</p>}
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-full bg-fill-subtle px-4 py-2.5 text-[12px] font-medium disabled:opacity-50">{t('Cancel')}</button><button type="submit" disabled={busy || (action.kind !== 'delete' && !name.trim())} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-medium disabled:opacity-50 ${action.kind === 'delete' ? 'bg-coral-soft text-coral-soft-ink' : 'bg-ink text-white'}`}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t(action.kind === 'delete' ? 'Delete folder' : 'Save')}</button></div>
        </form>
    </dialog>
}
