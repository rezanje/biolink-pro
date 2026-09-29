'use client'

import { useUiLanguage } from '@/components/UiLanguageProvider'

export default function PublicCardPreview({ slug, revision }: { slug: string; revision: string }) {
    const { t } = useUiLanguage()
    return (
        <div className="phone-frame mx-auto overflow-hidden" aria-label={t('Public card preview')}>
            <iframe
                key={revision}
                title={t('Public card preview')}
                src={`/${encodeURIComponent(slug)}?design-preview=1`}
                className="border-0"
                style={{ width: 375, height: 750, transform: 'scale(0.68267)', transformOrigin: 'top left' }}
                tabIndex={-1}
            />
        </div>
    )
}
