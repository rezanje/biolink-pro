'use client'

import { useEffect, useState } from 'react'
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
    on: { text: 'Aktif', className: 'bg-emerald-100 text-emerald-700' },
    off: { text: 'Mati', className: 'bg-zinc-100 text-zinc-500' },
    scheduled: { text: 'Terjadwal', className: 'bg-amber-100 text-amber-700' },
    ended: { text: 'Selesai', className: 'bg-zinc-100 text-zinc-500' },
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

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Paket Promo</h2>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                        Hak yang diberikan otomatis saat pelanggan mengaktifkan jam/kartu. Paket bisa dipasang ke nomor seri
                        tertentu (tab Profiles → pilih seri → Set paket) atau berlaku untuk semua seri. Mematikan paket hanya
                        menghentikan pemberian baru; hak yang sudah diberikan tetap.
                    </p>
                </div>
                <button onClick={startNew} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Paket baru</button>
            </div>

            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

            {editingId && (
                <div className="mt-4 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase text-zinc-500">Nama paket
                        <input value={form.name} maxLength={100} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Promo Awal Asta" className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal normal-case text-zinc-900" />
                    </label>
                    <label className="text-xs font-semibold uppercase text-zinc-500">Catatan
                        <input value={form.description} maxLength={300} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Untuk pembeli batch awal" className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal normal-case text-zinc-900" />
                    </label>
                    <fieldset className="text-xs font-semibold uppercase text-zinc-500">Premium
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm font-normal normal-case text-zinc-800">
                            {([['none', 'Tidak'], ['days', 'Beberapa hari'], ['unlimited', 'Tanpa batas']] as const).map(([mode, label]) => (
                                <label key={mode} className="flex items-center gap-1.5">
                                    <input type="radio" name="premium_mode" checked={form.premium_mode === mode} onChange={() => setForm({ ...form, premium_mode: mode })} /> {label}
                                </label>
                            ))}
                            {form.premium_mode === 'days' && (
                                <input type="number" min={1} max={3650} aria-label="Lama Premium (hari)" value={form.premium_days} onChange={e => setForm({ ...form, premium_days: parseInt(e.target.value) || 0 })} className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm" />
                            )}
                        </div>
                        <p className="mt-1 text-[11px] font-normal normal-case text-zinc-400">Premium membuka ganti link sendiri, desain kartu, dan fitur Premium lain. Tidak pernah menurunkan pelanggan B2B atau Premium tanpa batas.</p>
                    </fieldset>
                    <fieldset className="text-xs font-semibold uppercase text-zinc-500">Tema & fitur tambahan
                        <div className="mt-1 flex flex-wrap gap-3 text-sm font-normal normal-case text-zinc-800">
                            {PROMO_TEMPLATES.map((template: { id: string; name: string }) => (
                                <label key={template.id} className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={form.templates.includes(template.id)} onChange={e => setForm({ ...form, templates: toggle(form.templates, template.id, e.target.checked) })} /> Tema {template.name}
                                </label>
                            ))}
                            {PROMO_FEATURES.map((feature: { key: string; label: string }) => (
                                <label key={feature.key} className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={form.features.includes(feature.key)} onChange={e => setForm({ ...form, features: toggle(form.features, feature.key, e.target.checked) })} /> {feature.label}
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-[11px] font-normal normal-case text-zinc-400">Tema eksklusif tetap bisa dipakai walau Premium-nya habis.</p>
                    </fieldset>
                    <label className="text-xs font-semibold uppercase text-zinc-500">Mulai (opsional)
                        <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900" />
                    </label>
                    <label className="text-xs font-semibold uppercase text-zinc-500">Selesai (opsional)
                        <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" checked={form.applies_to_all} onChange={e => setForm({ ...form, applies_to_all: e.target.checked })} />
                        Berlaku untuk semua seri yang tidak punya paket khusus
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                        Aktif
                    </label>
                    <div className="flex gap-2 md:col-span-2">
                        <button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Simpan paket</button>
                        <button onClick={() => setEditingId(null)} disabled={busy} className="rounded-lg px-4 py-2 text-sm text-zinc-500">Batal</button>
                    </div>
                </div>
            )}

            <div className="mt-4 divide-y divide-zinc-100">
                {packages.map(pkg => {
                    const status = STATUS_LABEL[promoPackageStatus(pkg)]
                    return (
                        <div key={pkg.id} className="flex flex-wrap items-center gap-3 py-3">
                            <div className="min-w-[220px] flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-zinc-900">{pkg.name}</span>
                                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.className}`}>{status.text}</span>
                                    {pkg.applies_to_all && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Semua seri</span>}
                                </div>
                                <p className="mt-0.5 text-xs text-zinc-500">{describePromoPackage(pkg)}</p>
                                <p className="mt-0.5 text-[11px] text-zinc-400">
                                    {serialCounts[pkg.id] || 0} seri dipasang · {grantCounts[pkg.id] || 0} kali diberikan
                                    {pkg.starts_at && ` · mulai ${new Date(pkg.starts_at).toLocaleString('id-ID')}`}
                                    {pkg.ends_at && ` · selesai ${new Date(pkg.ends_at).toLocaleString('id-ID')}`}
                                </p>
                            </div>
                            <button onClick={() => startEdit(pkg)} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-blue-600 disabled:opacity-50">Ubah</button>
                            <button onClick={() => setActive(pkg, !pkg.is_active)} disabled={busy} className="rounded-lg bg-zinc-100 px-3 py-2 text-sm disabled:opacity-50">{pkg.is_active ? 'Matikan' : 'Nyalakan'}</button>
                        </div>
                    )
                })}
                {!packages.length && <p className="py-3 text-sm text-zinc-400">Belum ada paket.</p>}
            </div>
        </section>
    )
}
