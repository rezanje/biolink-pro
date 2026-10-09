import Link from 'next/link'

export function LegalLinks() {
    return (
        <nav aria-label="Dokumen hukum" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-500">
            <Link href="/privacy" className="underline underline-offset-4 hover:text-zinc-900">Privacy Policy</Link>
            <Link href="/terms" className="underline underline-offset-4 hover:text-zinc-900">Terms of Service</Link>
        </nav>
    )
}
