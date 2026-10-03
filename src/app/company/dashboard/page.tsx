'use client'

import AnimatedNumber from '@/components/motion/AnimatedNumber'

import { useCompany } from '@/app/company/company-context'
import {
    Users,
    Package,
    ArrowUpRight,
    TrendingUp,
    Link as LinkIcon,
    ShieldCheck
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function CompanyDashboardPage() {
    const { company } = useCompany()

    const stats = [
        { label: 'Total Assets', value: 124, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Employees', value: 98, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Total Scans', value: 12.4, decimals: 1, suffix: 'k', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Green Impact', value: 450, suffix: 'kg', icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-zinc-900">Welcome, {company?.name}</h1>
                <p className="text-zinc-500 mt-1">Manage your corporate assets and employee profiles from one central hub.</p>
            </div>

            {/* stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                +12% <ArrowUpRight className="w-3 h-3 ml-1" />
                            </span>
                        </div>
                        <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
                        <p className="text-2xl font-bold text-zinc-900 mt-1"><AnimatedNumber value={stat.value} decimals={stat.decimals} suffix={stat.suffix} /></p>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Access List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                            <h3 className="font-bold text-zinc-900 text-lg">Recent Asset Activity</h3>
                            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</button>
                        </div>
                        <div className="divide-y divide-zinc-50">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                                            <LinkIcon className="w-5 h-5 text-zinc-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">Asset #SN-2024-00{i}</p>
                                            <p className="text-xs text-zinc-400">Assigned to: Employee Name</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-zinc-400">2h ago</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Branding Preview */}
                <div className="space-y-6">
                    <div className="bg-zinc-900 p-8 rounded-3xl text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="font-bold text-xl mb-2">Corporate Identity</h3>
                            <p className="text-zinc-400 text-sm mb-6">Your branding is active across all employee profiles.</p>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                                    <div
                                        className="w-8 h-8 rounded-lg shadow-inner"
                                        style={{ backgroundColor: company?.theme?.primary || '#0F172A' }}
                                    />
                                    <div>
                                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">Primary Color</p>
                                        <p className="text-sm font-mono">{company?.theme?.primary || '#0F172A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                                    <div
                                        className="w-8 h-8 rounded-lg shadow-inner"
                                        style={{ backgroundColor: company?.theme?.accent || '#3B82F6' }}
                                    />
                                    <div>
                                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">Accent Color</p>
                                        <p className="text-sm font-mono">{company?.theme?.accent || '#3B82F6'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-10 -mt-10" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl -ml-10 -mb-10" />
                    </div>
                </div>
            </div>
        </div>
    )
}
