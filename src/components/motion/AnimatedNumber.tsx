'use client'

import { useEffect, useRef } from 'react'

export default function AnimatedNumber({ value, locale = 'en-US', decimals = 0, suffix = '' }: { value: number; locale?: string; decimals?: number; suffix?: string }) {
    const rootRef = useRef<HTMLSpanElement>(null)
    const textRef = useRef<HTMLSpanElement>(null)
    const currentRef = useRef(0)
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })

    useEffect(() => {
        const root = rootRef.current
        const text = textRef.current
        if (!root || !text) return
        const nf = new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        })
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        let frame = 0
        let observer: IntersectionObserver | undefined
        const finish = () => {
            cancelAnimationFrame(frame)
            currentRef.current = value
            text.textContent = nf.format(value)
            observer?.disconnect()
        }
        const start = () => {
            observer?.disconnect()
            const from = currentRef.current
            const began = performance.now()
            const tick = (now: number) => {
                const progress = Math.min(1, (now - began) / 1100)
                currentRef.current = from + (value - from) * (1 - (1 - progress) ** 3)
                text.textContent = nf.format(currentRef.current)
                if (progress < 1) frame = requestAnimationFrame(tick)
                else finish()
            }
            frame = requestAnimationFrame(tick)
        }
        const preferenceChanged = () => { if (media.matches) finish() }
        media.addEventListener('change', preferenceChanged)
        if (media.matches || !('IntersectionObserver' in window)) finish()
        else {
            observer = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) start()
            }, { threshold: 0.15 })
            observer.observe(root)
        }
        return () => {
            cancelAnimationFrame(frame)
            observer?.disconnect()
            media.removeEventListener('change', preferenceChanged)
        }
    }, [value, decimals, locale])

    return <span ref={rootRef} className="tabular-nums" data-count-target={value}>
        <span ref={textRef} aria-hidden="true" data-count-display>{formatter.format(0)}</span>
        <span className="sr-only">{formatter.format(value)}</span>{suffix}
    </span>
}
