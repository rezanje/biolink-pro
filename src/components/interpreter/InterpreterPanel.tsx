'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Loader2, Mic, Square, Volume2 } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

const LANGUAGES = [
    { label: 'Indonesian', speech: 'id-ID' },
    { label: 'English', speech: 'en-US' },
    { label: 'Mandarin Chinese', speech: 'zh-CN' },
    { label: 'Japanese', speech: 'ja-JP' },
    { label: 'Korean', speech: 'ko-KR' },
]

type Language = (typeof LANGUAGES)[number]
type SpeechRecognitionResultLike = { [index: number]: { transcript: string } }
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> }
type SpeechRecognitionErrorLike = { error: string }
type SpeechRecognitionLike = {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorLike) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export default function InterpreterPanel({ profileSlug }: { profileSlug?: string }) {
    const { t } = useUiLanguage()
    const [source, setSource] = useState<Language>(LANGUAGES[0])
    const [target, setTarget] = useState<Language>(LANGUAGES[1])
    const [listening, setListening] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [sourceText, setSourceText] = useState('')
    const [translatedText, setTranslatedText] = useState('')
    const [notice, setNotice] = useState('')
    const recognition = useRef<SpeechRecognitionLike | null>(null)
    const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => {
        if (stopTimer.current) clearTimeout(stopTimer.current)
        if (recognition.current) recognition.current.onend = null
        recognition.current?.stop()
    }, [])

    const translate = async (text: string, from: Language, to: Language) => {
        setProcessing(true); setNotice('')
        try {
            const response = await fetch('/api/interpreter/translate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceText: text, sourceLanguage: from.label, targetLanguage: to.label,
                    ...(profileSlug ? { slug: profileSlug } : {}),
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || typeof data.translatedText !== 'string') throw new Error(data.error || t('Could not translate that sentence.'))
            setTranslatedText(data.translatedText)
        } catch (error) { setNotice((error as Error).message) } finally { setProcessing(false) }
    }

    const stopListening = () => {
        recognition.current?.stop()
    }

    const startListening = () => {
        const browser = window as SpeechRecognitionWindow
        const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition
        if (!Recognition) {
            setNotice(t('Live speech recognition is not supported in this browser. Try Chrome or Safari.'))
            return
        }
        setNotice(''); setSourceText(''); setTranslatedText('')
        const nextRecognition = new Recognition()
        nextRecognition.continuous = false
        nextRecognition.interimResults = true
        nextRecognition.lang = source.speech
        let transcript = ''
        let failed = false
        nextRecognition.onresult = event => {
            transcript = ''
            for (let index = 0; index < event.results.length; index += 1) transcript += ` ${event.results[index][0]?.transcript || ''}`
            setSourceText(transcript.trim())
        }
        nextRecognition.onerror = event => {
            failed = true
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setNotice(t('Microphone access was not allowed.'))
            else if (event.error === 'no-speech') setNotice(t('No speech detected. Tap to try again.'))
            else setNotice(t('Could not hear your voice. Tap to try again.'))
        }
        nextRecognition.onend = () => {
            if (stopTimer.current) clearTimeout(stopTimer.current)
            recognition.current = null
            setListening(false)
            if (!failed && transcript.trim()) void translate(transcript.trim(), source, target)
            else if (!failed) setNotice(t('No speech detected. Tap to try again.'))
        }
        recognition.current = nextRecognition
        try {
            nextRecognition.start()
            setListening(true)
            stopTimer.current = setTimeout(stopListening, 15_000)
        } catch {
            recognition.current = null
            setNotice(t('Could not start the microphone. Tap to try again.'))
        }
    }

    const swapLanguages = () => { setSource(target); setTarget(source); setSourceText(''); setTranslatedText('') }
    const speak = () => {
        if (!translatedText || !('speechSynthesis' in window)) return
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(translatedText)
        utterance.lang = target.speech
        window.speechSynthesis.speak(utterance)
    }

    return <>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Language label={t('They speak')} value={source.label} disabled={listening || processing} onChange={label => setSource(LANGUAGES.find(item => item.label === label) || LANGUAGES[0])} />
            <button type="button" onClick={swapLanguages} disabled={listening || processing} aria-label={t('Swap languages')} className="mb-1.5 rounded-full bg-fill-subtle p-3 text-ink-2 disabled:opacity-50"><ArrowLeftRight className="h-4 w-4" /></button>
            <Language label={t('They hear')} value={target.label} disabled={listening || processing} onChange={label => setTarget(LANGUAGES.find(item => item.label === label) || LANGUAGES[1])} />
        </div>
        <button type="button" onClick={listening ? stopListening : startListening} disabled={processing} className={`mt-7 flex w-full items-center justify-center gap-3 rounded-full py-4 text-[14px] font-medium transition ${listening ? 'bg-coral-soft text-coral-soft-ink' : 'bg-ink text-white'} disabled:opacity-50`}>
            {listening ? <><Square className="h-4 w-4 fill-current" />{t('Listening… tap to translate')}</> : processing ? <><Loader2 className="h-4 w-4 animate-spin" />{t('Translating…')}</> : <><Mic className="h-4 w-4" />{t('Tap to speak')}</>}
        </button>
        <p className="mt-3 text-center text-[11px] text-ink-3">{t('Your words appear as you speak. Pause or tap again to translate.')}</p>
        {notice && <p className="mt-4 rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink">{notice}</p>}
        <section className="mt-3 space-y-3">
            <Result label={t('Original')} value={sourceText} placeholder={t('Your spoken sentence will appear here.')} />
            <div className="rounded-card bg-ink p-5 text-white shadow-ink"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-medium uppercase tracking-wider text-white/55">{t('Translation')}</p>{translatedText && <button type="button" onClick={speak} className="rounded-full bg-white/12 p-2" aria-label={t('Play translation')}><Volume2 className="h-4 w-4" /></button>}</div><p className="mt-3 text-[22px] font-semibold leading-snug tracking-[-0.02em]">{translatedText || t('Translation will appear here.')}</p></div>
        </section>
    </>
}

function Language({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
    const { t } = useUiLanguage()
    return <label><span className="text-[10px] font-medium uppercase tracking-wider text-ink-2">{label}</span><select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1.5 w-full appearance-none rounded-row bg-fill-subtle px-3 py-3 text-[12px] font-medium outline-none disabled:opacity-50">{LANGUAGES.map(language => <option key={language.label} value={language.label}>{t(language.label)}</option>)}</select></label>
}

function Result({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
    return <div className="rounded-card bg-surface p-5 shadow-row"><p className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{label}</p><p className={`mt-3 text-[16px] leading-relaxed ${value ? 'text-ink' : 'text-ink-3'}`}>{value || placeholder}</p></div>
}
