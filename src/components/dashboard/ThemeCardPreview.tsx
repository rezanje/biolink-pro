'use client'

import { useEffect, useRef, useState } from 'react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

const SCREEN_WIDTH = 375
const SCREEN_HEIGHT = 812

export default function ThemeCardPreview({ slug, template, revision, name }: { slug: string; template: string; revision: string; name: string }) {
    const { t } = useUiLanguage()
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SCREEN_WIDTH))
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    return <div ref={containerRef} aria-hidden="true" inert className="relative w-full overflow-hidden rounded-xl bg-fill-subtle" style={{ aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}` }}>
        {slug && scale > 0 && <iframe
            key={revision}
            title={t('Preview of {name}', { name })}
            src={`/${encodeURIComponent(slug)}?design-preview=1&template-preview=${encodeURIComponent(template)}`}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute left-0 top-0 border-0"
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />}
    </div>
}
