'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Instagram, Twitter, Linkedin, Globe, ChevronRight, Mail, Phone, ExternalLink, Download, FileText, Image as ImageIcon, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { getCompanyDisplayName } from '@/lib/profile-display.mjs'

// WhatsApp SVG Icon
function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )
}

export default function PhonePreview() {
    const [profile, setProfile] = useState<any>(null)
    const [activeTab, setActiveTab] = useState('links')
    const [showQR, setShowQR] = useState(false)

    useEffect(() => {
        const checkProfile = () => {
            const profileStr = localStorage.getItem('genhub_profile')
            if (profileStr) setProfile(JSON.parse(profileStr))
        }
        checkProfile()
        const interval = setInterval(checkProfile, 500)
        return () => clearInterval(interval)
    }, [])

    if (!profile) return null

    const isLightMode = profile.theme_mode === 'light'
    const isGrayscale = profile.image_filter === 'grayscale'
    const primaryColor = profile.primary_color || '#3B82F6'
    const companyName = getCompanyDisplayName(profile.company)

    const allLinks = [...(profile.links || [])]
    if (profile.whatsapp && !allLinks.find((l: any) => l.icon === 'whatsapp')) {
        const cleanPhone = profile.whatsapp.replace(/\D/g, '')
        const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone
        allLinks.push({ id: 'synthetic-wa', icon: 'whatsapp', url: `https://wa.me/${waNumber}`, title: 'WhatsApp' })
    }

    const mainSocials = allLinks.filter((l: any) =>
        ['instagram', 'linkedin', 'twitter', 'whatsapp', 'email', 'website'].includes(l.icon)
    ).slice(0, 4)

    const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/${profile.slug}` : ''

    return (
        <div className="phone-frame scale-90 lg:scale-100 origin-top shadow-2xl">
            <div className={`phone-screen relative overflow-y-auto overflow-x-hidden scrollbar-hide transition-colors duration-500 ${isLightMode ? 'bg-zinc-100 text-zinc-900' : 'bg-black text-white'}`}>

                {/* Hero Photo — STICKY inside preview, matches real phone */}
                <div className="sticky top-0 w-full z-0" style={{ height: '55%' }}>
                    {profile.avatar_url ? (
                        <div className="relative w-full h-full">
                            <img
                                src={profile.avatar_url}
                                alt={profile.display_name}
                                className={`w-full h-full object-cover object-top ${isGrayscale ? 'grayscale' : ''}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        </div>
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
                            <span className="text-9xl font-bold opacity-5">{profile.display_name?.[0]?.toUpperCase()}</span>
                        </div>
                    )}
                </div>

                {/* Content Card — scrolls OVER hero, matches real phone exactly */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative z-10 -mt-6 rounded-t-[28px] p-5 pb-10 min-h-[55%] backdrop-blur-2xl transition-colors duration-300 border-t ${isLightMode
                        ? 'bg-white/40 border-white/40 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]'
                        : 'bg-zinc-950/30 border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.3)]'
                        }`}
                >
                    {/* Pull indicator */}
                    <div className="flex justify-center mb-4">
                        <div className={`w-8 h-1 rounded-full ${isLightMode ? 'bg-zinc-300' : 'bg-white/20'}`} />
                    </div>

                    {/* Profile Info */}
                    <div className="text-center mb-4">
                        <h2 className={`text-xl font-bold mb-0.5 ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>{profile.display_name || 'Your Name'}</h2>
                        <p className={`text-[10px] font-medium tracking-wider uppercase mb-2 ${isLightMode ? 'text-zinc-500' : 'text-white/50'}`}>@{profile.slug || 'username'}</p>

                        {/* Job Title + Company */}
                        {(profile.job_title || companyName) && (
                            <div className={`flex items-center justify-center gap-1.5 text-xs mb-2 ${isLightMode ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                {profile.job_title && <span>{profile.job_title}</span>}
                                {profile.job_title && companyName && <span className="opacity-40">•</span>}
                                {companyName && <span>{companyName}</span>}
                            </div>
                        )}

                        {/* Bio */}
                        {profile.bio && (
                            <p className={`text-xs leading-relaxed line-clamp-2 px-2 ${isLightMode ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                {profile.bio}
                            </p>
                        )}
                    </div>

                    {/* Social Icons */}
                    {mainSocials.length > 0 && (
                        <div className="flex justify-center gap-3 mb-5">
                            {mainSocials.map((link: any) => (
                                <div
                                    key={link.id}
                                    className={`w-11 h-11 rounded-full border flex items-center justify-center backdrop-blur-md transition-colors ${isLightMode
                                        ? 'bg-white/40 border-zinc-200 hover:bg-white/60'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    {renderIcon(link.icon, `w-4 h-4 ${isLightMode ? 'text-zinc-700' : 'text-white'}`)}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA Row: Save Contact + QR */}
                    <div className="flex gap-2 mb-5">
                        <button
                            className="flex-1 py-3 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all text-white"
                            style={{
                                background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}99)`,
                                border: `1px solid ${primaryColor}40`,
                                boxShadow: `0 6px 24px ${primaryColor}30`,
                            }}
                        >
                            <Download className="w-3.5 h-3.5" />
                            SAVE CONTACT
                        </button>
                        <button
                            onClick={() => setShowQR(!showQR)}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all backdrop-blur-md ${isLightMode
                                ? 'bg-white/50 text-zinc-700 border border-white/50 hover:bg-white/70'
                                : 'bg-white/5 text-white border border-white/10 hover:bg-white/15'
                                }`}
                        >
                            <QrCode className="w-4 h-4" />
                        </button>
                    </div>

                    {/* QR Code Modal */}
                    {showQR && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`mb-5 p-4 rounded-2xl text-center backdrop-blur-xl border ${isLightMode ? 'bg-white/60 border-white/50' : 'bg-white/10 border-white/10'}`}
                        >
                            <div className="bg-white p-3 rounded-xl inline-block">
                                <QRCodeSVG value={profileUrl} size={120} level="M" />
                            </div>
                            <p className={`text-[10px] mt-2 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Scan to open profile</p>
                        </motion.div>
                    )}

                    {/* Tabs */}
                    <div className={`flex items-center justify-center gap-1 mb-4 ${isLightMode ? 'bg-zinc-100' : 'bg-white/5'} rounded-xl p-1`}>
                        {['links', 'gallery', 'files'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`text-[9px] font-bold uppercase tracking-widest transition-all duration-300 px-3 py-1.5 rounded-lg ${activeTab === tab
                                    ? (isLightMode
                                        ? 'text-zinc-900 bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm'
                                        : 'text-white bg-white/10 backdrop-blur-xl border border-white/20 shadow-sm'
                                    )
                                    : (isLightMode ? 'text-zinc-400' : 'text-zinc-500')
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Links */}
                    {activeTab === 'links' && (
                        <div className="space-y-2">
                            {profile.links && profile.links.map((link: any) => (
                                <div
                                    key={link.id}
                                    className={`w-full p-3 rounded-xl border flex items-center justify-between group transition-all active:scale-[0.99] ${isLightMode
                                        ? 'bg-white/40 border-zinc-200/50 hover:bg-white/60'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLightMode ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-white/70'}`}>
                                            {renderIcon(link.icon, "w-4 h-4")}
                                        </div>
                                        <div className="text-left">
                                            <h4 className={`font-bold text-xs ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>{link.title || 'Untitled Link'}</h4>
                                            <p className={`text-[9px] font-medium uppercase tracking-wider mt-0.5 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                {getLinkSubtitle(link)}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-3 h-3 ${isLightMode ? 'text-zinc-300' : 'text-zinc-600'}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tab: Gallery */}
                    {activeTab === 'gallery' && (
                        <div className="grid grid-cols-2 gap-1.5">
                            {profile.gallery && profile.gallery.length > 0 ? (
                                profile.gallery.map((item: any) => (
                                    <div key={item.id} className="aspect-square rounded-lg overflow-hidden border border-white/5">
                                        <img src={item.url} alt={item.caption} className="w-full h-full object-cover" />
                                    </div>
                                ))
                            ) : (
                                <div className={`col-span-2 text-center py-6 text-[10px] ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    No photos yet
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: Files */}
                    {activeTab === 'files' && (
                        <div className="space-y-2">
                            {profile.files && profile.files.length > 0 ? (
                                profile.files.map((file: any) => (
                                    <div key={file.id} className={`w-full p-3 rounded-xl border flex items-center gap-3 ${isLightMode ? 'bg-zinc-50 border-zinc-200/50' : 'bg-white/5 border-white/5'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLightMode ? 'bg-zinc-200 text-zinc-500' : 'bg-zinc-800 text-white/70'}`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className={`font-bold text-xs truncate ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>{file.title}</h4>
                                            <p className={`text-[9px] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>{file.url ? 'Open Link' : 'Document'}</p>
                                        </div>
                                        <Download className={`w-3 h-3 ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`} />
                                    </div>
                                ))
                            ) : (
                                <div className={`text-center py-6 text-[10px] ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    No files yet
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className={`text-[8px] uppercase tracking-widest ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Powered by Gentanala</p>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function renderIcon(iconName: string, className = "w-5 h-5") {
    switch (iconName) {
        case 'instagram': return <Instagram className={className} />
        case 'twitter': return <Twitter className={className} />
        case 'linkedin': return <Linkedin className={className} />
        case 'whatsapp': return <WhatsAppIcon className={className} />
        case 'email': return <Mail className={className} />
        case 'website': return <Globe className={className} />
        case 'phone': return <Phone className={className} />
        default: return <Globe className={className} />
    }
}

function getLinkSubtitle(link: any) {
    if (!link.url) return 'NO URL'
    const url = link.url.toLowerCase()
    if (url.includes('instagram')) return 'Open Instagram'
    if (url.includes('linkedin')) return 'Professional Profile'
    if (url.includes('twitter') || url.includes('x.com')) return 'Follow on X'
    if (url.includes('wa.me') || url.includes('whatsapp')) return 'Chat on WhatsApp'
    return 'Visit Website'
}
