'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Loader2, Mic, Square, Volume2 } from 'lucide-react'

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
    start: () => void
    stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function audioBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Could not read recording.'))
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.readAsDataURL(blob)
    })
}

export default function InterpreterPanel({ profileSlug }: { profileSlug?: string }) {
    const [source, setSource] = useState<Language>(LANGUAGES[0])
    const [target, setTarget] = useState<Language>(LANGUAGES[1])
    const [recording, setRecording] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [sourceText, setSourceText] = useState('')
    const [translatedText, setTranslatedText] = useState('')
    const [notice, setNotice] = useState('')
    const recorder = useRef<MediaRecorder | null>(null)
    const recognition = useRef<SpeechRecognitionLike | null>(null)
    const stream = useRef<MediaStream | null>(null)
    const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => {
        if (stopTimer.current) clearTimeout(stopTimer.current)
        recognition.current?.stop()
        stream.current?.getTracks().forEach(track => track.stop())
    }, [])

    const translate = async (blob: Blob) => {
        setProcessing(true); setNotice('')
        try {
            const response = await fetch('/api/interpreter/translate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: await audioBase64(blob), mimeType: blob.type || 'audio/webm',
                    sourceLanguage: source.label, targetLanguage: target.label,
                    ...(profileSlug ? { slug: profileSlug } : {}),
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok || typeof data.sourceText !== 'string' || typeof data.translatedText !== 'string') throw new Error(data.error || 'Could not translate that recording.')
            setSourceText(data.sourceText); setTranslatedText(data.translatedText)
        } catch (error) { setNotice((error as Error).message) } finally { setProcessing(false) }
    }

    const stopRecording = () => {
        recognition.current?.stop()
        recognition.current = null
        if (recorder.current?.state === 'recording') recorder.current.stop()
    }

    const startLiveTranscript = () => {
        const browser = window as SpeechRecognitionWindow
        const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition
        if (!Recognition) {
            setNotice('Live text is not supported in this browser. Text will appear after you stop speaking.')
            return
        }
        const nextRecognition = new Recognition()
        nextRecognition.continuous = true
        nextRecognition.interimResults = true
        nextRecognition.lang = source.speech
        nextRecognition.onresult = event => {
            let transcript = ''
            for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0]?.transcript || ''
            setSourceText(transcript.trim())
        }
        nextRecognition.onerror = event => {
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setNotice('Microphone access was not allowed.')
        }
        recognition.current = nextRecognition
        try { nextRecognition.start() } catch { setNotice('Live text could not start. Text will appear after you stop speaking.') }
    }

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setNotice('Microphone recording is not supported in this browser.'); return }
        try {
            setNotice(''); setSourceText(''); setTranslatedText('')
            const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.current = nextStream
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(value => MediaRecorder.isTypeSupported(value))
            const nextRecorder = mimeType ? new MediaRecorder(nextStream, { mimeType }) : new MediaRecorder(nextStream)
            const chunks: BlobPart[] = []
            nextRecorder.ondataavailable = event => event.data.size && chunks.push(event.data)
            nextRecorder.onstop = () => {
                if (stopTimer.current) clearTimeout(stopTimer.current)
                nextStream.getTracks().forEach(track => track.stop())
                setRecording(false)
                const blob = new Blob(chunks, { type: nextRecorder.mimeType || mimeType || 'audio/webm' })
                if (blob.size) void translate(blob)
            }
            recorder.current = nextRecorder
            nextRecorder.start()
            setRecording(true)
            startLiveTranscript()
            stopTimer.current = setTimeout(stopRecording, 15_000)
        } catch { setNotice('Microphone access was not allowed.') }
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
            <Language label="They speak" value={source.label} onChange={label => setSource(LANGUAGES.find(item => item.label === label) || LANGUAGES[0])} />
            <button type="button" onClick={swapLanguages} aria-label="Swap languages" className="mb-1.5 rounded-full bg-fill-subtle p-3 text-ink-2"><ArrowLeftRight className="h-4 w-4" /></button>
            <Language label="They hear" value={target.label} onChange={label => setTarget(LANGUAGES.find(item => item.label === label) || LANGUAGES[1])} />
        </div>
        <button type="button" onClick={recording ? stopRecording : startRecording} disabled={processing} className={`mt-7 flex w-full items-center justify-center gap-3 rounded-full py-4 text-[14px] font-medium transition ${recording ? 'bg-coral-soft text-coral-soft-ink' : 'bg-ink text-white'} disabled:opacity-50`}>
            {recording ? <><Square className="h-4 w-4 fill-current" />Listening… tap to translate</> : processing ? <><Loader2 className="h-4 w-4 animate-spin" />Translating…</> : <><Mic className="h-4 w-4" />Tap to speak</>}
        </button>
        <p className="mt-3 text-center text-[11px] text-ink-3">Your words appear as you speak. Tap again to translate. Recordings are not saved.</p>
        {notice && <p className="mt-4 rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink">{notice}</p>}
        <section className="mt-3 space-y-3">
            <Result label="Original" value={sourceText} placeholder="Your spoken sentence will appear here." />
            <div className="rounded-card bg-ink p-5 text-white shadow-ink"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-medium uppercase tracking-wider text-white/55">Translation</p>{translatedText && <button type="button" onClick={speak} className="rounded-full bg-white/12 p-2" aria-label="Play translation"><Volume2 className="h-4 w-4" /></button>}</div><p className="mt-3 text-[22px] font-semibold leading-snug tracking-[-0.02em]">{translatedText || 'Translation will appear here.'}</p></div>
        </section>
    </>
}

function Language({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <label><span className="text-[10px] font-medium uppercase tracking-wider text-ink-2">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 w-full appearance-none rounded-row bg-fill-subtle px-3 py-3 text-[12px] font-medium outline-none">{LANGUAGES.map(language => <option key={language.label}>{language.label}</option>)}</select></label>
}

function Result({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
    return <div className="rounded-card bg-surface p-5 shadow-row"><p className="text-[11px] font-medium uppercase tracking-wider text-ink-2">{label}</p><p className={`mt-3 text-[16px] leading-relaxed ${value ? 'text-ink' : 'text-ink-3'}`}>{value || placeholder}</p></div>
}
