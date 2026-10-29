'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany, type Company } from '@/app/company/company-context'
import { companyBrand } from '@/lib/company-brand.mjs'

function safeUrl(value: string) {
    if (!value.trim()) return true
    try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' } catch { return false }
}

export default function CompanySettingsPage() {
    const { company } = useCompany()
    return company ? <CompanySettingsForm key={company.id} company={company} /> : null
}

function CompanySettingsForm({ company }: { company: Company }) {
    const [form, setForm] = useState(() => {
        const brand = companyBrand(company)
        return { name: company.name, website: company.website || '', logo_url: company.logo_url || '', primary: brand.primary, accent: brand.accent }
    })
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState('')
    async function save(event: React.FormEvent) {
        event.preventDefault()
        if (!company) return
        if (!form.name.trim() || !safeUrl(form.website) || !safeUrl(form.logo_url) || !/^#[0-9a-f]{6}$/i.test(form.primary) || !/^#[0-9a-f]{6}$/i.test(form.accent)) {
            setNotice('Periksa nama, URL, dan kode warna enam digit.'); return
        }
        setSaving(true); setNotice('')
        const { error } = await createClient().from('companies').update({
            name: form.name.trim(), website: form.website.trim() || null, logo_url: form.logo_url.trim() || null,
            theme: { primary: form.primary, accent: form.accent },
        }).eq('id', company.id)
        setSaving(false)
        if (error) setNotice('Gagal menyimpan pengaturan perusahaan.')
        else window.location.reload()
    }
    return <div className="max-w-3xl space-y-7">
        <div><p className="uppercase tracking-[.22em] text-xs font-bold text-[var(--company-accent)]">Identitas perusahaan</p><h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-3">Pengaturan</h1><p className="text-[#637268] mt-3">Atur tampilan workspace perusahaan Anda.</p></div>
        <form onSubmit={save} className="bg-white border border-[#dce3d9] rounded-2xl p-6 sm:p-8 space-y-6">
            <div><label htmlFor="company-name" className="block text-sm font-semibold mb-2">Nama perusahaan</label><input id="company-name" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-[#cbd5c9] px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /></div>
            <div><label htmlFor="company-website" className="block text-sm font-semibold mb-2">Website</label><input id="company-website" type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" className="w-full rounded-lg border border-[#cbd5c9] px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /></div>
            <div><label htmlFor="company-logo" className="block text-sm font-semibold mb-2">URL logo</label><input id="company-logo" type="url" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://example.com/logo.png" className="w-full rounded-lg border border-[#cbd5c9] px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /><p className="text-xs text-[#637268] mt-2">Kosongkan untuk menggunakan tampilan bawaan perusahaan.</p></div>
            <div className="grid sm:grid-cols-2 gap-5">
                {(['primary', 'accent'] as const).map(key => <div key={key}><label htmlFor={`color-${key}`} className="block text-sm font-semibold mb-2">{key === 'primary' ? 'Warna utama' : 'Warna aksen'}</label><div className="flex gap-2"><input id={`color-${key}`} type="color" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="h-12 w-14 rounded border border-[#cbd5c9]" /><input aria-label={`Kode ${key}`} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-[#cbd5c9] px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /></div></div>)}
            </div>
            {notice && <p role="alert" className="text-red-800">{notice}</p>}
            <button disabled={saving} className="rounded-lg bg-[var(--company-primary)] px-6 py-3 text-white font-semibold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--company-accent)] disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
        </form>
    </div>
}
