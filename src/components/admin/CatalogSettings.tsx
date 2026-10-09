'use client'

import { useState } from 'react'

export interface CatalogItem { id: string; name: string; is_active: boolean }

function CatalogRow({ item, busy, save }: { item: CatalogItem; busy: boolean; save: (name: string, active: boolean, id?: string) => Promise<boolean> }) {
    const [name, setName] = useState(item.name)
    return <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 py-3">
        <input aria-label={`Nama ${item.name}`} value={name} onChange={e => setName(e.target.value)} maxLength={100} className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <button disabled={busy || !name.trim()} onClick={() => save(name, item.is_active, item.id)} className="rounded-lg px-3 py-2 text-sm text-blue-600 disabled:opacity-50">Simpan</button>
        <button disabled={busy} onClick={() => save(item.name, !item.is_active, item.id)} className="rounded-lg bg-zinc-100 px-3 py-2 text-sm disabled:opacity-50">{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <span className={`text-xs ${item.is_active ? 'text-emerald-600' : 'text-zinc-400'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
    </div>
}

export function CatalogSettings({ kind, title, items, onSaved }: { kind: 'device_types' | 'events'; title: string; items: CatalogItem[]; onSaved: () => Promise<void> }) {
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const save = async (value: string, active: boolean, id?: string) => {
        setBusy(true)
        setError('')
        try {
            const res = await fetch('/api/admin/catalogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, name: value, is_active: active }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
            if (!id) setName('')
            await onSaved()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menyimpan')
            return false
        } finally { setBusy(false) }
    }
    return <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">Tambah pilihan sendiri. Pilihan nonaktif tetap tersimpan pada akun lama.</p>
        <form onSubmit={e => { e.preventDefault(); void save(name, true) }} className="my-4 flex gap-2">
            <input aria-label={`Tambah ${title}`} placeholder={`Nama ${kind === 'events' ? 'event' : 'device'} baru`} required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <button disabled={busy || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Tambah</button>
        </form>
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        {items.map(item => <CatalogRow key={`${item.id}-${item.name}`} item={item} busy={busy} save={save} />)}
        {!items.length && <p className="text-sm text-zinc-400">Belum ada pilihan.</p>}
    </section>
}
