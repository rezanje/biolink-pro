'use client'

import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

/** Animate numeric data, keeping its accessible label at the final value. */
export default function AnimatedNumber({
    value, locale = 'en-US', decimals = 0, suffix = '',
}: { value: number; locale?: string; decimals?: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, amount: 0.2 })
    const reducedMotion = useReducedMotion()
    const counter = useMotionValue(0)
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })
    const display = useTransform(counter, latest => formatter.format(Number(latest.toFixed(decimals))) + suffix)

    useEffect(() => {
        if (!inView) return
        const controls = animate(counter, value, {
            duration: reducedMotion ? 0 : 1.2, ease: [0.22, 1, 0.36, 1],
        })
        return () => controls.stop()
    }, [counter, inView, reducedMotion, value])

    return (
        <span ref={ref} className="tabular-nums" aria-label={formatter.format(value) + suffix}>
            <motion.span aria-hidden="true">{display}</motion.span>
        </span>
    )
}
