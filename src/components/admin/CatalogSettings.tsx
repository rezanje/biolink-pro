'use client'

import { useState } from 'react'

export interface CatalogItem { id: string; name: string; is_active: boolean }

function CatalogRow({ item, busy, save }: { item: CatalogItem; busy: boolean; save: (name: string, active: boolean, id?: string) => Promise<boolean> }) {
    const [name, setName] = useState(item.name)
    return <div className="flex flex-wrap items-center gap-2 border-t border-hairline py-3">
        <input aria-label={`Nama ${item.name}`} value={name} onChange={e => setName(e.target.value)} maxLength={100} className="min-w-0 flex-1 rounded-full bg-fill-subtle px-4 py-2.5 text-[13px] outline-none focus:bg-surface focus:ring-1 focus:ring-ink/15" />
        <button disabled={busy || !name.trim()} onClick={() => save(name, item.is_active, item.id)} className="rounded-full px-3 py-2 text-[12px] font-medium text-coral disabled:opacity-50">Simpan</button>
        <button disabled={busy} onClick={() => save(item.name, !item.is_active, item.id)} className="rounded-full bg-fill-subtle px-3.5 py-2 text-[12px] font-medium hover:bg-track disabled:opacity-50">{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${item.is_active ? 'bg-success-soft text-success-soft-ink' : 'bg-fill-subtle text-ink-2'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
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
    return <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[12px] text-ink-2">Tambah pilihan sendiri. Pilihan nonaktif tetap tersimpan pada akun lama.</p>
        <form onSubmit={e => { e.preventDefault(); void save(name, true) }} className="my-4 flex gap-2">
            <input aria-label={`Tambah ${title}`} placeholder={`Nama ${kind === 'events' ? 'event' : 'device'} baru`} required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 rounded-full bg-fill-subtle px-4 py-3 text-[13px] outline-none focus:bg-surface focus:ring-1 focus:ring-ink/15" />
            <button disabled={busy || !name.trim()} className="rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white shadow-ink disabled:opacity-40">Tambah</button>
        </form>
        {error && <p role="alert" className="mb-3 rounded-row bg-coral-soft px-4 py-2.5 text-[12.5px] text-coral-soft-ink">{error}</p>}
        {items.map(item => <CatalogRow key={`${item.id}-${item.name}`} item={item} busy={busy} save={save} />)}
        {!items.length && <p className="text-[13px] text-ink-3">Belum ada pilihan.</p>}
    </section>
}
