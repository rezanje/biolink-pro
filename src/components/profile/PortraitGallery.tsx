'use client'

import { useUiLanguage } from '@/components/UiLanguageProvider'

type GalleryItem = { id: string; url: string; caption?: string }
export default function PortraitGallery({ items, onOpen }: { items: GalleryItem[]; onOpen: (url: string) => void }) {
    const { t } = useUiLanguage()
    if (!items.length) return null
    return <section className="card-portrait-gallery mb-6 min-w-0" aria-label={t('Gallery')}>
        <h2 className="mb-3 text-base font-bold">{t('Gallery')}</h2>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2">
            {items.map((item, index) => <button type="button" key={item.id} onClick={() => onOpen(item.url)} className="w-[72px] shrink-0 snap-start rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={t('Open photo {number}', { number: index + 1 })}>
                {/* Uploaded profile media, reused in the full Gallery tab. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.caption || ''} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                {item.caption && <span className="mt-2 block truncate text-center text-[11px] opacity-75">{item.caption}</span>}
            </button>)}
        </div>
    </section>
}
