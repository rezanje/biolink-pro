import Link from 'next/link'
import type { ReactNode } from 'react'
import { LegalLinks } from '@/components/legal/LegalLinks'

export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
        <div lang="id" className="min-h-screen bg-[#f0f0ec] text-zinc-900">
            <header className="border-b border-zinc-200 bg-white/70">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
                    <Link href="/" className="text-lg font-bold tracking-tight">Gentanala</Link>
                    <LegalLinks />
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
                <article className="space-y-9 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:leading-7 [&_p]:text-zinc-600 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-7 [&_li]:text-zinc-600 [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-zinc-400 [&_a:hover]:text-zinc-900">
                    {children}
                </article>
            </main>
            <footer className="border-t border-zinc-200 px-6 py-8">
                <LegalLinks />
                <p className="mt-4 text-center text-xs text-zinc-500">© 2026 Gentanala</p>
            </footer>
        </div>
    )
}
