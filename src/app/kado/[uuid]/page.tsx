'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hasGift } from '@/lib/gift.mjs'
import GiftView from '@/components/gift/GiftView'

// Kenangan kado. Kartu yang sudah diaktifkan tidak lagi menampilkan kejutan
// saat di-tap, tapi pemiliknya tetap bisa membukanya lagi dari sini.
export default function GiftMemoryPage() {
    const params = useParams()
    const uuid = params?.uuid as string
    const [serial, setSerial] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .rpc('nfc_get_serial', { p_serial_uuid: uuid })
            setSerial(data)
            setLoading(false)
        }
        if (uuid) load()
    }, [uuid])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
            </div>
        )
    }

    if (!hasGift(serial)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-center font-kabut text-ink">
                <div>
                    <h1 className="text-[19px] font-semibold tracking-[-0.025em]">Tidak ada kado di kartu ini</h1>
                    <Link href="/dashboard" className="mt-4 inline-block text-[13px] text-ink-2 underline">
                        Balik ke dashboard
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="relative">
            <GiftView
                gift={{ url: serial.gift_url, message: serial.gift_message, from: serial.gift_from }}
                memory
            />
            <Link
                href="/dashboard"
                className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/80 bg-white/[0.72] px-6 py-3 text-[12.5px] font-medium text-ink-2 shadow-nav backdrop-blur-[26px]"
            >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                Balik ke dashboard
            </Link>
        </div>
    )
}
