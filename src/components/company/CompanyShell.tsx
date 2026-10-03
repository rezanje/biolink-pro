'use client'

import PageMotion from '@/components/motion/PageMotion'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    Users,
    Package,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronRight,
    Building2,
    ExternalLink
} from 'lucide-react'
import { useCompany } from '@/app/company/company-context'

const navItems = [
    { href: '/company/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { href: '/company/assets', icon: Package, label: 'Asset Management' },
    { href: '/company/users', icon: Users, label: 'User Directory' },
    { href: '/company/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/company/settings', icon: Settings, label: 'Settings' },
]

export default function CompanyShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { company } = useCompany()
    const pathname = usePathname()

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex overflow-hidden">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-zinc-200 shrink-0">
                <div className="p-8">
                    {company?.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="h-10 w-auto object-contain mb-2" />
                    ) : (
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-8 h-8 text-blue-600" />
                            <span className="text-xl font-bold text-zinc-900">{company?.name}</span>
                        </div>
                    )}
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Corporate Portal</p>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-zinc-900 text-white shadow-lg shadow-black/5'
                                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-6 border-t border-zinc-100">
                    <Link
                        href="/dashboard"
                        className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <LayoutDashboard className="w-4 h-4 text-zinc-600" />
                            </div>
                            <span className="text-sm font-medium text-zinc-600">Personal View</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600" />
                    </Link>

                    <button className="flex items-center gap-3 w-full px-4 py-4 mt-4 text-zinc-400 hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-blue-600" />
                        <span className="font-bold text-zinc-900 truncate max-w-[150px]">{company?.name}</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-500">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                    <div className="max-w-7xl mx-auto">
                        <PageMotion key={pathname}>{children}</PageMotion>
                    </div>
                </main>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-white shadow-2xl z-[101] lg:hidden flex flex-col"
                        >
                            <div className="p-6 flex items-center justify-between border-b border-zinc-100">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-6 h-6 text-blue-600" />
                                    <span className="font-bold text-zinc-900">{company?.name}</span>
                                </div>
                                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <nav className="flex-1 px-4 py-6 space-y-2">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.href
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsSidebarOpen(false)}
                                            className={`flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${isActive
                                                ? 'bg-zinc-900 text-white shadow-lg'
                                                : 'text-zinc-500'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <item.icon className="w-5 h-5" />
                                                <span className="font-medium">{item.label}</span>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-20'}`} />
                                        </Link>
                                    )
                                })}
                            </nav>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
