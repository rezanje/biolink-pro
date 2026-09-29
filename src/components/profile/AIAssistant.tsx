'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Mic, Volume2, VolumeX, Bot, Loader2 } from 'lucide-react'
import { useUiLanguage } from '@/components/UiLanguageProvider'

interface AIAssistantProps {
    profile: any
    /** Kendali dari luar (dipegang PetBuddy). Tanpa ini, komponen mandiri seperti dulu. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Tombol bulat bawaan; mati secara default karena pemicunya kini si pet. */
    showFallbackTrigger?: boolean
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    text: string
}

export default function AIAssistant({ profile, open, onOpenChange, showFallbackTrigger = false }: AIAssistantProps) {
    const { t } = useUiLanguage()
    const [internalOpen, setInternalOpen] = useState(false)
    // Terkendali kalau prop `open` dikirim; kalau tidak, pakai state sendiri.
    const isOpen = open ?? internalOpen
    const setIsOpen = (next: boolean) => {
        setInternalOpen(next)
        onOpenChange?.(next)
    }
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'assistant', text: `Hi! I'm ${profile.display_name}'s AI Assistant. Ask me anything about them, or just say hello!` }
    ])
    const [input, setInput] = useState('')
    const [isThinking, setIsThinking] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const recognitionRef = useRef<any>(null)
    const synthesisRef = useRef<SpeechSynthesis | null>(null)

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isOpen])

    // Initialize Voice Features
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Speech Synthesis
            synthesisRef.current = window.speechSynthesis

            // Speech Recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition()
                recognition.continuous = false
                recognition.interimResults = false
                recognition.lang = 'en-US' // Default to English, could be dynamic

                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript
                    setInput(transcript)
                    setIsListening(false)
                    handleSend(transcript)
                }

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error)
                    setIsListening(false)
                }

                recognition.onend = () => {
                    setIsListening(false)
                }

                recognitionRef.current = recognition
            }
        }
    }, [])

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop()
        } else {
            setIsListening(true)
            recognitionRef.current?.start() // This might throw strictly on some browsers if not user interaction, but button click is safe
        }
    }

    const speak = (text: string) => {
        if (!synthesisRef.current) return

        if (isSpeaking) {
            synthesisRef.current.cancel()
            setIsSpeaking(false)
            return
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => setIsSpeaking(false)
        setIsSpeaking(true)
        synthesisRef.current.speak(utterance)
    }

    const generateResponse = async (query: string) => {
        setIsThinking(true)

        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        const lowerQuery = query.toLowerCase()
        let response = "I'm not sure about that. You might want to contact them directly."

        // Simple Rule-based AI Logic (Context Aware)
        // 1. Bio / Who
        if (lowerQuery.includes('who') || lowerQuery.includes('about') || lowerQuery.includes('bio')) {
            response = profile.bio
                ? `${profile.bio}`
                : `${profile.display_name} is a ${profile.job_title} at ${profile.company}.`
        }
        // 2. Contact
        else if (lowerQuery.includes('contact') || lowerQuery.includes('email') || lowerQuery.includes('phone') || lowerQuery.includes('reach')) {
            const methods = []
            if (profile.email) methods.push(`email at ${profile.email}`)
            if (profile.phone) methods.push(`phone at ${profile.phone}`)
            if (profile.whatsapp) methods.push('WhatsApp')

            if (methods.length > 0) {
                response = `You can reach ${profile.display_name} via ${methods.join(', or ')}.`
            } else {
                response = `You can use the contact buttons on this profile to reach ${profile.display_name}.`
            }
        }
        // 3. Work / Job
        else if (lowerQuery.includes('job') || lowerQuery.includes('work') || lowerQuery.includes('company') || lowerQuery.includes('profession')) {
            if (profile.job_title && profile.company) {
                response = `${profile.display_name} works as a ${profile.job_title} at ${profile.company}.`
            } else if (profile.job_title) {
                response = `${profile.display_name} is a ${profile.job_title}.`
            } else {
                response = "I don't have specific details about their current employment."
            }
        }
        // 4. Greetings
        else if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
            response = `Hello! How can I help you learn more about ${profile.display_name}?`
        }

        const aiMessage: Message = { id: Date.now().toString(), role: 'assistant', text: response }
        setMessages(prev => [...prev, aiMessage])
        setIsThinking(false)

        // Speak response automatically
        speak(response)
    }

    const handleSend = (text: string = input) => {
        if (!text.trim()) return

        const userMessage: Message = { id: Date.now().toString(), role: 'user', text }
        setMessages(prev => [...prev, userMessage])
        setInput('')

        generateResponse(text)
    }

    return (
        <>
            {/* FAB cadangan — tampil hanya saat pemicu utamanya (pet) tidak ada */}
            {showFallbackTrigger && (
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white z-50 hover:shadow-blue-500/50 transition-shadow"
            >
                {/* Robot / Sparkle Icon */}
                <Bot className="w-8 h-8" />
            </motion.button>
            )}

            {/* Chat Interface */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-24 right-6 w-80 md:w-96 p-4 z-[60]"
                    >
                        <div className="bg-black/80 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]">

                            {/* Header */}
                            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">{t('GenHub Assistant')}</h3>
                                        <p className="text-white/50 text-[10px]">{t('AI powered • Voice enabled')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} aria-label={t('Close')} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20'
                                                : 'bg-white/10 text-white rounded-tl-none border border-white/10 backdrop-blur-md'
                                            }`}>
                                            {msg.text}
                                            {msg.role === 'assistant' && (
                                                <div className="mt-1 flex justify-end">
                                                    <button onClick={() => speak(msg.text)} className="opacity-50 hover:opacity-100 transition-opacity p-1">
                                                        {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none border border-white/10 flex gap-1 items-center">
                                            <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-3 bg-white/5 border-t border-white/10 flex items-center gap-2">
                                <button
                                    onClick={toggleListening}
                                    className={`p-3 rounded-full transition-all duration-300 ${isListening
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    <Mic className="w-5 h-5" />
                                </button>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={t('Type or speak...')}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-colors"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim()}
                                    className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
