'use client'

import { useEffect, useState } from 'react'
import { Plus, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PROMO_FEATURES, PROMO_TEMPLATES, describePromoPackage, emptyPromoPackage, promoPackagePayload, promoPackageStatus } from '@/lib/promo-packages.mjs'

export interface PromoPackage {
    id: string
    name: string
    description: string | null
    is_active: boolean
    applies_to_all: boolean
    starts_at: string | null
    ends_at: string | null
    premium_mode: 'none' | 'days' | 'unlimited'
    premium_days: number | null
    templates: string[]
    features: string[]
    created_at: string
}

type PromoForm = {
    name: string
    description: string
    is_active: boolean
    applies_to_all: boolean
    starts_at: string
    ends_at: string
    premium_mode: 'none' | 'days' | 'unlimited'
    premium_days: number
    templates: string[]
    features: string[]
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
    on: { text: 'Aktif', className: 'bg-success-soft text-success-soft-ink' },
    off: { text: 'Mati', className: 'bg-fill-subtle text-ink-2' },
    scheduled: { text: 'Terjadwal', className: 'bg-butter/40 text-ink' },
    ended: { text: 'Selesai', className: 'bg-fill-subtle text-ink-2' },
}

// datetime-local butuh "YYYY-MM-DDTHH:mm" dalam waktu lokal.
function toLocalInput(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formFromPackage(pkg: PromoPackage): PromoForm {
    return {
        name: pkg.name,
        description: pkg.description || '',
        is_active: pkg.is_active,
        applies_to_all: pkg.applies_to_all,
        starts_at: toLocalInput(pkg.starts_at),
        ends_at: toLocalInput(pkg.ends_at),
        premium_mode: pkg.premium_mode,
        premium_days: pkg.premium_days || 30,
        templates: pkg.templates || [],
        features: pkg.features || [],
    }
}

function toggle(list: string[], value: string, on: boolean) {
    return on ? Array.from(new Set([...list, value])) : list.filter(item => item !== value)
}

export function PromoPackagesPanel({ packages, serialCounts, onSaved }: {
    packages: PromoPackage[]
    serialCounts: Record<string, number>
    onSaved: () => Promise<void>
}) {
    const [editingId, setEditingId] = useState<string | 'new' | null>(null)
    const [form, setForm] = useState<PromoForm>(emptyPromoPackage() as PromoForm)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [grantCounts, setGrantCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        const load = async () => {
            const { data } = await createClient().from('promo_grants').select('package_id')
            const counts: Record<string, number> = {}
            for (const row of data || []) if (row.package_id) counts[row.package_id] = (counts[row.package_id] || 0) + 1
            setGrantCounts(counts)
        }
        void load()
    }, [packages])

    const startNew = () => { setForm(emptyPromoPackage() as PromoForm); setEditingId('new'); setError('') }
    const startEdit = (pkg: PromoPackage) => { setForm(formFromPackage(pkg)); setEditingId(pkg.id); setError('') }

    const save = async () => {
        const payload = promoPackagePayload(form)
        if ('error' in payload) { setError(payload.error as string); return }
        setBusy(true)
        setError('')
        const supabase = createClient()
        const { error: saveError } = editingId === 'new'
            ? await supabase.from('promo_packages').insert(payload)
            : await supabase.from('promo_packages').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
        setBusy(false)
        if (saveError) { setError('Gagal menyimpan: ' + saveError.message); return }
        setEditingId(null)
        await onSaved()
    }

    const setActive = async (pkg: PromoPackage, active: boolean) => {
        if (!active && !window.confirm(`Matikan "${pkg.name}"? Klaim baru tidak lagi dapat paket ini. Pelanggan yang sudah dapat tetap memegang haknya.`)) return
        setBusy(true)
        const { error: saveError } = await createClient().from('promo_packages')
            .update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', pkg.id)
        setBusy(false)
        if (saveError) { setError('Gagal mengubah status: ' + saveError.message); return }
        await onSaved()
    }

    const FIELD = 'mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:bg-surface focus:ring-1 focus:ring-ink/15'
    const LABEL = 'block text-[11px] font-medium uppercase tracking-wider text-ink-2'
    const CHIP = (on: boolean) => `inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-medium normal-case tracking-normal transition-colors ${on ? 'bg-ink text-white' : 'bg-fill-subtle text-ink hover:bg-track'}`

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-[12.5px] leading-relaxed text-ink-2">
                    Pasang paket ke serial tertentu (tab Serial → centang serial → Set promo) atau berlakukan untuk semua serial.
                    Mematikan paket hanya menghentikan pemberian baru; hak yang sudah diberikan tetap.
                </p>
                <button onClick={startNew} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white shadow-ink disabled:opacity-40">
                    <Plus className="h-4 w-4" strokeWidth={1.8} /> Paket baru
                </button>
            </div>

            {error && <p role="alert" className="mb-4 rounded-row bg-coral-soft px-4 py-3 text-[12.5px] text-coral-soft-ink">{error}</p>}

            {editingId && (
                <section className="mb-5 rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-soft text-coral-soft-ink"><Ticket className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                        <div>
                            <h2 className="text-[15px] font-semibold">{editingId === 'new' ? 'Paket baru' : 'Ubah paket'}</h2>
                            <p className="text-[12px] text-ink-2">Berlaku saat serial diaktifkan pelanggan</p>
                        </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className={LABEL}>Nama paket
                            <input value={form.name} maxLength={100} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Promo Awal Asta" className={FIELD} />
                        </label>
                        <label className={LABEL}>Catatan
                            <input value={form.description} maxLength={300} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Untuk pembeli batch awal" className={FIELD} />
                        </label>
                        <fieldset className={LABEL}>Premium
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                {([['none', 'Tidak'], ['days', 'Beberapa hari'], ['unlimited', 'Tanpa batas']] as const).map(([mode, label]) => (
                                    <label key={mode} className={CHIP(form.premium_mode === mode)}>
                                        <input type="radio" name="premium_mode" className="sr-only" checked={form.premium_mode === mode} onChange={() => setForm({ ...form, premium_mode: mode })} /> {label}
                                    </label>
                                ))}
                                {form.premium_mode === 'days' && (
                                    <span className="inline-flex items-center gap-2 text-[12.5px] font-normal normal-case tracking-normal text-ink-2">
                                        <input type="number" min={1} max={3650} aria-label="Lama Premium (hari)" value={form.premium_days} onChange={e => setForm({ ...form, premium_days: parseInt(e.target.value) || 0 })} className="w-20 rounded-full bg-fill-subtle px-3 py-2 text-[13px] text-ink outline-none" /> hari
                                    </span>
                                )}
                            </div>
                            <p className="mt-1.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ink-3">Membuka ganti link sendiri, desain kartu, dan fitur Premium lain. Tidak pernah menurunkan pelanggan B2B atau Premium tanpa batas.</p>
                        </fieldset>
                        <fieldset className={LABEL}>Tema & fitur tambahan
                            <div className="mt-1.5 flex flex-wrap gap-2">
                                {PROMO_TEMPLATES.map((template: { id: string; name: string }) => (
                                    <label key={template.id} className={CHIP(form.templates.includes(template.id))}>
                                        <input type="checkbox" className="sr-only" checked={form.templates.includes(template.id)} onChange={e => setForm({ ...form, templates: toggle(form.templates, template.id, e.target.checked) })} /> Tema {template.name}
                                    </label>
                                ))}
                                {PROMO_FEATURES.map((feature: { key: string; label: string }) => (
                                    <label key={feature.key} className={CHIP(form.features.includes(feature.key))}>
                                        <input type="checkbox" className="sr-only" checked={form.features.includes(feature.key)} onChange={e => setForm({ ...form, features: toggle(form.features, feature.key, e.target.checked) })} /> {feature.label}
                                    </label>
                                ))}
                            </div>
                            <p className="mt-1.5 text-[11px] font-normal normal-case tracking-normal text-ink-3">Tema eksklusif tetap bisa dipakai walau Premium-nya habis.</p>
                        </fieldset>
                        <label className={LABEL}>Mulai (opsional)
                            <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className={FIELD} />
                        </label>
                        <label className={LABEL}>Selesai (opsional)
                            <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} className={FIELD} />
                        </label>
                        <label className="flex items-center gap-2.5 text-[13px]">
                            <input type="checkbox" className="h-4 w-4 accent-ink" checked={form.applies_to_all} onChange={e => setForm({ ...form, applies_to_all: e.target.checked })} />
                            Berlaku untuk semua serial yang tidak punya paket khusus
                        </label>
                        <label className="flex items-center gap-2.5 text-[13px]">
                            <input type="checkbox" className="h-4 w-4 accent-ink" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                            Aktif
                        </label>
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} disabled={busy} className="rounded-full px-5 py-3 text-[13px] text-ink-2 hover:text-ink">Batal</button>
                        <button onClick={save} disabled={busy} className="rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-white shadow-ink disabled:opacity-40">Simpan paket</button>
                    </div>
                </section>
            )}

            <div className="overflow-hidden rounded-card bg-surface shadow-card">
                <ul className="divide-y divide-hairline">
                    {packages.map(pkg => {
                        const status = STATUS_LABEL[promoPackageStatus(pkg)]
                        return (
                            <li key={pkg.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-soft text-coral-soft-ink"><Ticket className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                                <div className="min-w-[220px] flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[14px] font-semibold">{pkg.name}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${status.className}`}>{status.text}</span>
                                        {pkg.applies_to_all && <span className="rounded-full bg-sky/35 px-2 py-0.5 text-[10.5px] font-medium text-ink">Semua serial</span>}
                                    </div>
                                    <p className="mt-0.5 text-[12px] text-ink-2">{describePromoPackage(pkg)}</p>
                                    <p className="mt-0.5 text-[11px] text-ink-3">
                                        {serialCounts[pkg.id] || 0} serial dipasang · {grantCounts[pkg.id] || 0} kali diberikan
                                        {pkg.starts_at && ` · mulai ${new Date(pkg.starts_at).toLocaleString('id-ID')}`}
                                        {pkg.ends_at && ` · selesai ${new Date(pkg.ends_at).toLocaleString('id-ID')}`}
                                    </p>
                                </div>
                                <button onClick={() => startEdit(pkg)} disabled={busy} className="rounded-full bg-fill-subtle px-4 py-2 text-[12px] font-medium hover:bg-track disabled:opacity-50">Ubah</button>
                                <button
                                    role="switch"
                                    aria-checked={pkg.is_active}
                                    aria-label={pkg.is_active ? `Matikan ${pkg.name}` : `Nyalakan ${pkg.name}`}
                                    onClick={() => setActive(pkg, !pkg.is_active)}
                                    disabled={busy}
                                    className={`inline-flex h-[26px] w-[46px] items-center rounded-full p-[3px] transition-colors disabled:opacity-50 ${pkg.is_active ? 'bg-ink' : 'bg-track'}`}
                                >
                                    <span className={`h-5 w-5 rounded-full bg-white shadow-row transition-transform ${pkg.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </li>
                        )
                    })}
                    {!packages.length && <li className="px-5 py-10 text-center text-[13px] text-ink-2">Belum ada paket.</li>}
                </ul>
            </div>
        </div>
    )
}
