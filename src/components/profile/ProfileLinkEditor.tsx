'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    GripVertical,
    Trash2,
    ExternalLink,
    Instagram,
    Twitter,
    Linkedin,
    Globe,
    PlusCircle,
    X
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'

import { useUiLanguage } from '@/components/UiLanguageProvider'

export interface CardLink {
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

export default function ProfileLinkEditor({ links, tier, onChange }: {
    links: CardLink[]
    tier: string
    onChange: (links: CardLink[]) => void
}) {
    const { t } = useUiLanguage()
    const [isAdding, setIsAdding] = useState(false)
    const [newLink, setNewLink] = useState({ title: '', url: '', icon: 'globe' })

    const handleAddLink = () => {
        if (!newLink.title || !newLink.url) return

        if (tier === 'FREE' && links.length >= 3) {
            alert(t('The Free plan allows up to 3 links. Upgrade to add more.'))
            return
        }

        const link: CardLink = {
            id: 'link-' + crypto.randomUUID(),
            title: newLink.title,
            url: newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`,
            icon: newLink.icon,
            is_active: true
        }

        onChange([...links, link])
        setNewLink({ title: '', url: '', icon: 'globe' })
        setIsAdding(false)
    }

    const handleDeleteLink = (id: string) => {
        onChange(links.filter(l => l.id !== id))
    }

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return

        const items = Array.from(links)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        onChange(items)
    }

    return (
        <section id="profile-links" className="mt-3 scroll-mt-6 rounded-card bg-surface p-5 shadow-card">
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold">{t('Manage Links')}</h2>
                    <p className="mt-1.5 text-[13px] text-ink-2">{t('Add and arrange links on your digital card')}</p>
                    <p className="mt-1 text-[12px] text-ink-2">{t('Changes to links are saved with your profile.')}</p>
                    {tier === 'FREE' && (
                        <p className="mt-3 inline-block rounded-full bg-coral-soft px-2.5 py-1 text-[11px] font-semibold text-coral-soft-ink">
                            {t('Free plan · {count}/3 links used', { count: links.length })}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    aria-label={t('Add link')}
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
                            <div onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); handleAddLink() } }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[15px] font-semibold">{t('New Link')}</h3>
                                    <button type="button" onClick={() => setIsAdding(false)} aria-label={t('Close')} className="text-ink-3 hover:text-ink">
                                        <X className="h-5 w-5" strokeWidth={1.8} />
                                    </button>
                                </div>

                                <div className="mt-4 grid gap-3">
                                    <div>
                                        <label htmlFor="new-card-link-title" className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{t('Title')}</label>
                                        <input
                                            type="text"
                                            id="new-card-link-title"
                                            value={newLink.title}
                                            onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                                            placeholder={t('Example: My Instagram')}
                                            className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="new-card-link-icon" className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{t('Icon')}</label>
                                        <select
                                            id="new-card-link-icon"
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
                                        <label htmlFor="new-card-link-url" className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{t('Link URL')}</label>
                                        <input
                                            type="text"
                                            id="new-card-link-url"
                                            value={newLink.url}
                                            onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                                            placeholder="instagram.com/yourname"
                                            className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddLink}
                                    className="mt-5 w-full rounded-full bg-ink py-3.5 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99]"
                                >
                                    {t('Add Link')}
                                </button>
                            </div>
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
                                                    type="button"
                                                    onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                                                    aria-label={t('Open link')}
                                                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-fill-subtle hover:text-ink"
                                                >
                                                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteLink(link.id)}
                                                    aria-label={t('Delete link')}
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
                    <h3 className="text-[15px] font-medium">{t('No links yet')}</h3>
                    <p className="mt-1.5 text-[12.5px] text-ink-2">{t('Select the add button above to get started')}</p>
                </div>
            )}
        </section>
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
