'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const CARD_SELECTOR = '.rounded-card, .rounded-card-sm, .rounded-row'

export default function DashboardMotion({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const root = rootRef.current
        if (!root || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) return
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const seen = new WeakSet<Element>()
        const animations = new Set<Animation>()
        const observer = new IntersectionObserver(entries => {
            entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
                observer.unobserve(entry.target)
                if (media.matches || !root.contains(entry.target)) return
                const animation = entry.target.animate([
                    { opacity: 0, transform: 'translateY(12px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                ], { duration: 440, delay: Math.min(index, 4) * 45, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' })
                animations.add(animation)
                animation.onfinish = () => animations.delete(animation)
            })
        }, { threshold: 0.08 })
        const observe = (element: Element) => {
            if (!root.contains(element) || seen.has(element) || element.parentElement?.closest(CARD_SELECTOR) || element.querySelector('.fixed')) return
            seen.add(element)
            observer.observe(element)
        }
        root.querySelectorAll(CARD_SELECTOR).forEach(observe)
        const mutations = new MutationObserver(records => {
            records.forEach(record => {
                record.removedNodes.forEach(node => {
                    if (!(node instanceof Element) || root.contains(node)) return
                    observer.unobserve(node)
                    seen.delete(node)
                    node.querySelectorAll(CARD_SELECTOR).forEach(element => {
                        observer.unobserve(element)
                        seen.delete(element)
                    })
                })
                record.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return
                    if (node.matches(CARD_SELECTOR)) observe(node)
                    node.querySelectorAll(CARD_SELECTOR).forEach(observe)
                })
            })
        })
        mutations.observe(root, { childList: true, subtree: true })
        const preferenceChanged = () => {
            if (media.matches) {
                animations.forEach(animation => animation.cancel())
                animations.clear()
            }
        }
        media.addEventListener('change', preferenceChanged)
        return () => {
            observer.disconnect()
            mutations.disconnect()
            animations.forEach(animation => animation.cancel())
            media.removeEventListener('change', preferenceChanged)
        }
    }, [])
    return <div ref={rootRef} className="dashboard-motion">{children}</div>
}
