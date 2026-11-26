import { NextResponse } from 'next/server'
import { arConfigSummary } from '@/lib/ar-pilot.mjs'

// Verifikasi konfigurasi hologram di deployment non-production: hanya jumlah,
// tanpa nilai. Di production tidak tersedia.
export async function GET() {
    if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(arConfigSummary(process.env), { headers: { 'Cache-Control': 'no-store' } })
}
