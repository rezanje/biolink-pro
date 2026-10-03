'use client'

import { useEffect, useRef } from 'react'

/** Reveal loaded sections once, including sections added after async data loads. */
export default function PageMotion({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = ref.current
        if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return
                entry.target.setAttribute('data-revealed', 'true')
                observer.unobserve(entry.target)
            })
        }, { threshold: 0.05 })
        const register = () => {
            root.querySelectorAll('header, section, .shadow-card, .shadow-row, .rounded-3xl').forEach((element, index) => {
                if (element.hasAttribute('data-motion-reveal')) return
                element.setAttribute('data-motion-reveal', '')
                ;(element as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 65}ms`)
                observer.observe(element)
            })
        }
        register()
        const mutations = new MutationObserver(records => {
            if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1))) register()
        })
        mutations.observe(root, { childList: true, subtree: true })
        return () => { observer.disconnect(); mutations.disconnect() }
    }, [])

    return <div ref={ref} className="motion-page">{children}</div>
}
