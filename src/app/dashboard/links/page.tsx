'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    GripVertical,
    Trash2,
    ExternalLink,
    Save,
    Loader2,
    Instagram,
    Twitter,
    Linkedin,
    Globe,
    PlusCircle,
    X
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

import { createClient } from '@/lib/supabase/client'

interface Link {
    id: string
    title: string
    url: string
    icon: string
    is_active: boolean
}

const ICON_OPTIONS = [
    { label: 'Instagram', value: 'instagram', icon: Instagram },
    { label: 'Twitter/X', value: 'twitter', icon: Twitter },
    { label: 'LinkedIn', value: 'linkedin', icon: Linkedin },
    { label: 'Website', value: 'globe', icon: Globe },
]

export default function LinkManager() {
    const supabase = createClient()
    const [links, setLinks] = useState<Link[]>([])
    const [isAdding, setIsAdding] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [tier, setTier] = useState<string>('FREE')
    const [newLink, setNewLink] = useState({ title: '', url: '', icon: 'globe' })

    useEffect(() => {
        const fetchLinks = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            const { data: profile } = await supabase
                .from('profiles')
                .select('social_links, theme, tier')
                .eq('user_id', user.id)
                .single()

            if (profile) {
                // Determine if we use social_links or legacy theme.links
                const dbLinks = profile.social_links && profile.social_links.length > 0
                    ? profile.social_links
                    : (profile.theme?.links || [])
                setLinks(dbLinks)
                setTier((profile.tier || 'FREE').toUpperCase())
            }
        }
        fetchLinks()
    }, [])

    const saveLinksToStorage = async (updatedLinks: Link[]) => {
        setLinks(updatedLinks)

        // Always sync to localStorage for preview
        const profileStr = localStorage.getItem('genhub_profile')
        if (profileStr) {
            const p = JSON.parse(profileStr)
            p.links = updatedLinks
            p.tier = tier // Ensure tier is preserved
            localStorage.setItem('genhub_profile', JSON.stringify(p))
        }

        // Save to Supabase
        if (userId) {
            try {
                await supabase
                    .from('profiles')
                    .update({
                        social_links: updatedLinks,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
            } catch (err) {
                console.error('Error saving links to Supabase:', err)
            }
        }
    }

    const handleAddLink = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newLink.title || !newLink.url) return

        if (tier === 'FREE' && links.length >= 3) {
            alert('The Free plan allows up to 3 links. Upgrade to add more.')
            return
        }

        const link: Link = {
            id: 'link-' + Date.now(),
            title: newLink.title,
            url: newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`,
            icon: newLink.icon,
            is_active: true
        }

        saveLinksToStorage([...links, link])
        setNewLink({ title: '', url: '', icon: 'globe' })
        setIsAdding(false)
    }

    const handleDeleteLink = (id: string) => {
        saveLinksToStorage(links.filter(l => l.id !== id))
    }

    const onDragEnd = (result: any) => {
        if (!result.destination) return

        const items = Array.from(links)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        saveLinksToStorage(items)
    }

    return (
        <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Manage Links</h1>
                    <p className="mt-1.5 text-[13px] text-ink-2">Add and arrange links on your digital card</p>
                    {tier === 'FREE' && (
                        <p className="mt-3 inline-block rounded-full bg-coral-soft px-2.5 py-1 text-[11px] font-semibold text-coral-soft-ink">
                            Free plan · {links.length}/3 links used
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    aria-label="Add link"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-ink transition-transform active:scale-95"
                >
                    <Plus className="h-5 w-5" strokeWidth={2} />
                </button>
            </header>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-5 rounded-card bg-surface p-5 shadow-card">
                            <form onSubmit={handleAddLink}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[15px] font-semibold">New Link</h3>
                                    <button type="button" onClick={() => setIsAdding(false)} aria-label="Close" className="text-ink-3 hover:text-ink">
                                        <X className="h-5 w-5" strokeWidth={1.8} />
                                    </button>
                                </div>

                                <div className="mt-4 grid gap-3">
                                    <div>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Title</label>
                                        <input
                                            type="text"
                                            value={newLink.title}
                                            onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                                            placeholder="Example: My Instagram"
                                            className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Icon</label>
                                        <select
                                            value={newLink.icon}
                                            onChange={e => setNewLink({ ...newLink, icon: e.target.value })}
                                            className="mt-1.5 w-full appearance-none rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none"
                                        >
                                            {ICON_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Link URL</label>
                                        <input
                                            type="text"
                                            value={newLink.url}
                                            onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                                            placeholder="instagram.com/yourname"
                                            className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="mt-5 w-full rounded-full bg-ink py-3.5 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                                >
                                    Add Link
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drag links to change their order */}
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="links-list">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="mt-5 grid gap-2.5">
                            {links.map((link, index) => (
                                <Draggable key={link.id} draggableId={link.id} index={index}>
                                    {(provided, snapshot) => (
                                        <motion.div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`flex items-center gap-3 rounded-row bg-surface p-3.5 shadow-row ${snapshot.isDragging ? 'z-50 shadow-card' : ''
                                                }`}
                                        >
                                            <div {...provided.dragHandleProps} className="shrink-0 text-ink-3">
                                                <GripVertical className="h-5 w-5" strokeWidth={1.8} />
                                            </div>

                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fill-subtle text-ink-2">
                                                {renderIcon(link.icon)}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate text-[14px] font-medium">{link.title}</h3>
                                                <p className="truncate text-[11.5px] text-ink-3">{link.url}</p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    onClick={() => window.open(link.url, '_blank')}
                                                    aria-label="Open link"
                                                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-fill-subtle hover:text-ink"
                                                >
                                                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLink(link.id)}
                                                    aria-label="Delete link"
                                                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-coral-soft hover:text-coral-soft-ink"
                                                >
                                                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            {links.length === 0 && !isAdding && (
                <div className="mt-5 rounded-card border border-dashed border-ink/15 bg-surface/60 p-10 text-center">
                    <PlusCircle className="mx-auto mb-3 h-10 w-10 text-ink-3" strokeWidth={1.5} />
                    <h3 className="text-[15px] font-medium">No links yet</h3>
                    <p className="mt-1.5 text-[12.5px] text-ink-2">Select the add button above to get started</p>
                </div>
            )}
        </div>
    )
}

function renderIcon(iconName: string) {
    switch (iconName) {
        case 'instagram': return <Instagram className="h-5 w-5" strokeWidth={1.8} />
        case 'twitter': return <Twitter className="h-5 w-5" strokeWidth={1.8} />
        case 'linkedin': return <Linkedin className="h-5 w-5" strokeWidth={1.8} />
        default: return <Globe className="h-5 w-5" strokeWidth={1.8} />
    }
}
