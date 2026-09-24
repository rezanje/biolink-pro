'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PetSprite from '@/components/pet/PetSprite'
import { PET_CHARACTERS } from '@/lib/pet/characters.mjs'
import { PET_FEATURE_ENABLED } from '@/lib/pet/pet-selection.mjs'
import { buildPetGreeting } from '@/lib/pet/pet-greeting.mjs'

// Halaman Asisten: pilih karakter pet, kasih nama, nyalakan/matikan.
// Mengikuti pola simpan dan gaya Kabut yang dipakai halaman dashboard lain.
export default function AssistantPage() {
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [profile, setProfile] = useState<any>(null)
    const [form, setForm] = useState({ enabled: true, characterId: 'widodo', name: '' })

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            setUserId(user.id)

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (data) {
                setProfile(data)
                setForm({
                    enabled: data.pet_enabled !== false,
                    characterId: PET_CHARACTERS.some(c => c.id === data.pet_character_id)
                        ? data.pet_character_id
                        : 'widodo',
                    name: data.pet_name || '',
                })
            }
            setLoading(false)
        }
        load()
    }, [])

    const save = async () => {
        if (!userId) return
        setSaving(true)
        setError(null)
        const { error: dbError } = await supabase
            .from('profiles')
            .update({
                pet_enabled: form.enabled,
                pet_character_id: form.characterId,
                pet_name: form.name.trim() || null,
            })
            .eq('user_id', userId)
        setSaving(false)

        if (dbError) {
            setError('Could not save your settings. Please try again.')
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

    // Contoh kalimat persis seperti yang dilihat pengunjung.
    const previewGreeting = buildPetGreeting({
        profile: {
            ...profile,
            pet_enabled: true,
            pet_character_id: form.characterId,
            pet_name: form.name,
        },
    })

    return (
        <div className="mx-auto max-w-[1200px] px-5 pb-[150px] pt-6">
            <header>
                <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Assistant</h1>
                <p className="mt-1.5 text-[13px] text-ink-2">
                    Choose the character that welcomes visitors to your card
                </p>
            </header>

            {!PET_FEATURE_ENABLED && (
                <p className="mt-4 rounded-card bg-coral-soft px-4 py-3 text-[12.5px] leading-relaxed text-coral-soft-ink">
                    The assistant is temporarily disabled and will not appear on your public card. Your settings
                    are still saved and will apply when the feature is enabled again.
                </p>
            )}

            {/* Pratinjau */}
            <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
                <div className="flex flex-col items-center">
                    <PetSprite characterId={form.characterId} clip="greet" size={160} />
                    {form.enabled ? (
                        <p className="mt-4 max-w-[300px] rounded-2xl rounded-bl-md bg-fill-subtle px-4 py-3 text-center text-[12.5px] leading-snug text-ink">
                            {previewGreeting}
                        </p>
                    ) : (
                        <p className="mt-4 text-[12.5px] text-ink-3">Assistant is turned off</p>
                    )}
                </div>
            </section>

            {/* Pemilih karakter */}
            <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                <h2 className="text-[15px] font-semibold">Choose a character</h2>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {PET_CHARACTERS.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => setForm({ ...form, characterId: c.id })}
                            className={`flex flex-col items-center rounded-card-sm p-4 transition-colors ${form.characterId === c.id
                                ? 'bg-ink text-white'
                                : 'bg-fill-subtle text-ink'
                                }`}
                        >
                            <PetSprite characterId={c.id} clip="idle" size={64} />
                            <p className="mt-2 text-[14px] font-medium">{c.name}</p>
                            <p className={`mt-0.5 text-center text-[11px] ${form.characterId === c.id ? 'text-white/60' : 'text-ink-2'}`}>
                                {c.persona}
                            </p>
                        </button>
                    ))}
                </div>
            </section>

            {/* Nama + sakelar */}
            <section className="mt-3 rounded-card bg-surface p-5 shadow-card">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ink-2">Nickname</label>
                <input
                    type="text"
                    value={form.name}
                    maxLength={20}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={PET_CHARACTERS.find(c => c.id === form.characterId)?.name}
                    className="mt-1.5 w-full rounded-row bg-fill-subtle px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                />

                <div className="mt-5 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-[13.5px] font-semibold">Show on public card</h3>
                        <p className="mt-0.5 text-[12px] text-ink-2">
                            Turn it off to show your card without the assistant
                        </p>
                    </div>
                    <button
                        onClick={() => setForm({ ...form, enabled: !form.enabled })}
                        aria-label="Show assistant on public card"
                        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${form.enabled ? 'bg-ink' : 'bg-track'}`}
                    >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-row transition-transform ${form.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                </div>
            </section>

            {error && <p className="mt-4 text-center text-[12.5px] text-coral-soft-ink">{error}</p>}

            <button
                onClick={save}
                disabled={saving}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[13px] font-medium text-white shadow-ink transition-transform active:scale-[0.99] disabled:opacity-50"
            >
                {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                    <>
                        <Check className="h-4 w-4" strokeWidth={2} />
                        Saved
                    </>
                ) : (
                    <>
                        <Save className="h-4 w-4" strokeWidth={1.8} />
                        Save Assistant
                    </>
                )}
            </button>
        </div>
    )
}
