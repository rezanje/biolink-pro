'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Eye, Gift, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hasGiftContent, youtubeEmbedUrl } from '@/lib/gift.mjs'
import GiftView from '@/components/gift/GiftView'

type GiftSerial = {
    id: string
    serial_uuid: string
    gift_url: string | null
    gift_message: string | null
    gift_from: string | null
    gift_opened_at: string | null
    is_claimed: boolean
}

// Halaman isian kado milik pembeli. Dibuka lewat tautan rahasia yang dikirim
// setelah pesanan masuk — tim Gentanala membuka isian yang sama dari admin.
export default function GiftEditorPage() {
    const params = useParams()
    const token = params?.token as string
    const supabase = createClient()

    const [serial, setSerial] = useState<GiftSerial | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [preview, setPreview] = useState(false)
    const [form, setForm] = useState({ url: '', message: '', from: '' })

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .rpc('nfc_get_gift_by_token', { p_token: token })

            if (data) {
                setSerial(data)
                setForm({
                    url: data.gift_url || '',
                    message: data.gift_message || '',
                    from: data.gift_from || '',
                })
            }
            setLoading(false)
        }
        if (token) load()
    }, [token])

    const save = async () => {
        if (!serial) return
        setSaving(true)
        setSaveError('')
        const { data, error } = await supabase
            .rpc('nfc_save_gift', {
                p_token: token,
                p_url: form.url.trim(),
                p_message: form.message.trim(),
                p_from: form.from.trim(),
            })
        setSaving(false)
        if (error || !data?.success) {
            setSaveError(data?.error === 'Gift link is invalid or already opened'
                ? 'Kadonya sudah dibuka penerima atau link isian sudah tidak berlaku.'
                : 'Gagal menyimpan. Coba lagi sebentar lagi.')
            return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
            </div>
        )
    }

    if (!serial) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6 font-kabut text-center text-ink">
                <div>
                    <h1 className="text-[19px] font-semibold tracking-[-0.025em]">Tautan tidak berlaku</h1>
                    <p className="mt-2 text-[13px] text-ink-2">Minta tautan isian kado yang baru ke tim Gentanala.</p>
                </div>
            </div>
        )
    }

    // Kado yang sudah dibuka penerimanya tidak bisa diubah lagi.
    const locked = Boolean(serial.gift_opened_at)

    if (preview && hasGiftContent(form.url, form.message)) {
        return (
            <div className="relative">
                <GiftView gift={{ url: form.url, message: form.message, from: form.from }} />
                <button
                    onClick={() => setPreview(false)}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-6 py-3 text-[12.5px] font-medium text-white shadow-ink"
                >
                    Tutup pratinjau
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-canvas font-kabut text-ink">
            <div className="mx-auto max-w-[560px] px-5 py-10">
                <header className="text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral-soft text-coral-soft-ink">
                        <Gift className="h-6 w-6" strokeWidth={1.7} />
                    </span>
                    <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.03em]">Siapkan kejutannya</h1>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                        Ini yang muncul saat jamnya pertama kali ditempelkan ke HP penerima.
                    </p>
                </header>

                {locked ? (
                    <div className="mt-6 flex items-start gap-3 rounded-card bg-surface p-5 shadow-card">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                        <p className="text-[12.5px] leading-relaxed text-ink-2">
                            Kadonya sudah dibuka penerimanya, jadi isinya dikunci. Hubungi tim Gentanala kalau ada yang
                            perlu diperbaiki.
                        </p>
                    </div>
                ) : null}

                <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Link video kejutan <span className="normal-case tracking-normal text-ink-3">(opsional)</span></label>
                    <input
                        type="text"
                        value={form.url}
                        disabled={locked}
                        onChange={(e) => setForm({ ...form, url: e.target.value })}
                        placeholder="youtube.com/watch?v=..."
                        className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
                    />
                    <p className="mt-2 text-[11px] text-ink-3">
                        {youtubeEmbedUrl(form.url)
                            ? 'Videonya akan diputar langsung di halaman kejutan.'
                            : 'Paling pas pakai link YouTube. Link lain tetap bisa, cuma dibuka di tab baru.'}
                    </p>

                    <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-ink-2">Pesan buat penerima <span className="normal-case tracking-normal text-ink-3">(opsional)</span></label>
                    <textarea
                        value={form.message}
                        disabled={locked}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        rows={4}
                        maxLength={300}
                        placeholder="Selamat ulang tahun! Semoga tahun ini semua rencana kamu jalan."
                        className="mt-1.5 w-full resize-none rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
                    />

                    <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-ink-2">Dari siapa</label>
                    <input
                        type="text"
                        value={form.from}
                        disabled={locked}
                        onChange={(e) => setForm({ ...form, from: e.target.value })}
                        placeholder="Nama kamu"
                        className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
                    />
                </section>

                <p className="mt-3 text-center text-[11px] text-ink-3">Isi link video, ucapan, atau keduanya.</p>
                {saveError && (
                    <p role="alert" className="mt-2 text-center text-[12px] text-red-600">{saveError}</p>
                )}
                <div className="mt-4 flex gap-2.5">
                    <button
                        onClick={() => setPreview(true)}
                        disabled={!hasGiftContent(form.url, form.message)}
                        className="flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-3.5 text-[13px] font-medium text-ink-2 shadow-row disabled:opacity-40"
                    >
                        <Eye className="h-4 w-4" strokeWidth={1.8} />
                        Lihat dulu
                    </button>
                    <button
                        onClick={save}
                        disabled={locked || saving || !hasGiftContent(form.url, form.message)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99] disabled:opacity-40"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : saved ? (
                            <>
                                <Check className="h-4 w-4" strokeWidth={2} />
                                Tersimpan
                            </>
                        ) : (
                            'Simpan kejutan'
                        )}
                    </button>
                </div>

                <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-3">
                    Masih bisa diubah kapan saja sampai jamnya ditempelkan pertama kali.
                </p>
            </div>
        </div>
    )
}
