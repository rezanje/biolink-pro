'use client'

import { useId } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Folder, Pencil, Trash2 } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

export type CardPreview = {
    slug: string
    display_name: string | null
    company: string | null
    job_title: string | null
    avatar_url: string | null
}

export default function CardFolderTile({ name, cards, selected, disabled, onOpen, onRename, onDelete }: {
    name: string
    cards: CardPreview[]
    selected: boolean
    disabled: boolean
    onOpen: () => void
    onRename?: () => void
    onDelete?: () => void
}) {
    const { t } = useUiLanguage()
    const gradientId = useId()

    return <article className={`min-w-0 rounded-card-sm p-2.5 transition-colors sm:p-4 ${selected ? 'bg-surface shadow-row ring-1 ring-ink/15' : 'hover:bg-surface/60'}`}>
        <button type="button" onClick={onOpen} disabled={disabled} aria-pressed={selected} aria-label={t('Open folder {name}', { name })} className="group block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-50">
            <div className="relative mx-auto h-[155px] w-full max-w-[230px] sm:h-[180px]" aria-hidden="true">
                <div className="absolute inset-x-[8%] bottom-[12%] top-[16%] rounded-[18px] bg-track" />
                {[0, 1, 2].map(index => {
                    const card = cards[index]
                    return <div key={index} className={`absolute bottom-[25%] flex h-[66%] w-[46%] items-center justify-center overflow-hidden rounded-[12px] border-[4px] border-surface bg-avatar text-[30px] font-semibold text-avatar-ink shadow-row transition-transform duration-300 group-hover:-translate-y-1 ${index === 0 ? 'left-[5%] rotate-[-18deg]' : index === 1 ? 'left-[28%] z-[2] -rotate-2' : 'right-[3%] rotate-[18deg]'}`}>
                        {card?.avatar_url ? <Image src={card.avatar_url} alt="" width={160} height={180} unoptimized className="h-full w-full object-cover" /> : card ? card.display_name?.charAt(0).toUpperCase() || 'G' : <Folder className="h-6 w-6 opacity-30" strokeWidth={1.5} />}
                    </div>
                })}
                <svg viewBox="0 0 230 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[4%] z-[3] h-[60%] w-full drop-shadow-[0_8px_5px_rgba(27,26,24,0.12)]">
                    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stopColor="#aaa69f" stopOpacity=".94" /><stop offset=".5" stopColor="#d5d1cc" stopOpacity=".97" /><stop offset="1" stopColor="#f8f7f5" /></linearGradient></defs>
                    <path d="M 16 2 H 105 Q 113 2 118 11 L 131 28 Q 135 33 143 33 H 213 Q 228 33 228 48 V 101 Q 228 118 211 118 H 19 Q 2 118 2 101 V 19 Q 2 2 16 2 Z" fill={`url(#${gradientId})`} stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
                </svg>
                <span className="absolute bottom-[48%] left-[8%] z-[4] text-[7px] font-medium tracking-[0.14em] text-white/85 sm:text-[8px]">GENTANALA</span>
                <span className="absolute bottom-[13%] right-[7%] z-[4] flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ink text-white sm:h-10 sm:w-10"><ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} /></span>
            </div>
            <p title={name} className="mt-2 truncate text-center text-[14px] font-semibold tracking-[-0.02em] sm:text-[17px]">{name}</p>
            <p className="mt-1 text-center text-[11px] text-ink-2">{t('{count} cards', { count: cards.length })}</p>
        </button>
        {onRename && onDelete && <div className="mt-1 flex justify-center gap-1">
            <button type="button" onClick={onRename} disabled={disabled} aria-label={t('Rename folder {name}', { name })} className="rounded-full p-2 text-ink-2 hover:bg-track hover:text-ink disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={onDelete} disabled={disabled} aria-label={t('Delete folder {name}', { name })} className="rounded-full p-2 text-ink-2 hover:bg-coral-soft hover:text-coral-soft-ink disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>}
    </article>
}
