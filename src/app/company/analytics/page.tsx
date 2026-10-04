'use client'

import AnimatedNumber from '@/components/motion/AnimatedNumber'

import { useState, useEffect } from 'react'
import { useCompany } from '@/app/company/company-context'
import { createClient } from '@/lib/supabase/client'
import {
    BarChart3,
    TrendingUp,
    Users,
    ShoppingBag,
    Link as LinkIcon,
    ArrowUpRight,
    Search,
    Download,
    Eye,
    Activity,
    Calendar,
    MousePointer2,
    ShieldCheck
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts'

export default function CompanyAnalyticsPage() {
    const { company } = useCompany()
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({
        totalViews: 0,
        totalClicks: 0,
        totalTaps: 0,
        greenImpact: 0,
        viewHistory: [] as any[],
        topEmployees: [] as any[]
    })
    const supabase = createClient()

    useEffect(() => {
        const fetchAggregatedStats = async () => {
            if (!company?.id) return
            setIsLoading(true)

            try {
                // 1. Fetch all profiles for this company
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, display_name, theme, tier')
                    .eq('company_id', company.id)

                const userIds = profiles?.map(p => p.user_id) || []

                // 2. Fetch all serials owned by these users
                const { data: serials } = await supabase
                    .from('serial_numbers')
                    .select('nfc_tap_count, owner_id')
                    .in('owner_id', userIds)

                // 3. Aggregate data
                let totalViews = 0
                let totalClicks = 0
                let totalTaps = 0

                const employeeStats = profiles?.map(p => {
                    const profileTheme = p.theme || {}
                    const views = profileTheme.view_count || 0
                    const clicks = profileTheme.link_clicks || 0
                    const taps = serials?.filter(s => s.owner_id === p.user_id)
                        .reduce((acc, curr) => acc + (curr.nfc_tap_count || 0), 0) || 0

                    totalViews += views
                    totalClicks += clicks
                    totalTaps += taps

                    return {
                        name: p.display_name || 'Unnamed',
                        views,
                        clicks,
                        taps,
                        engagement: views > 0 ? ((clicks / views) * 100).toFixed(1) : 0
                    }
                }).sort((a, b) => b.views - a.views).slice(0, 5) || []

                // Fake historical data for the chart (In real app, fetch from analytics table)
                const history = [
                    { name: 'Mon', views: 400, taps: 240 },
                    { name: 'Tue', views: 300, taps: 139 },
                    { name: 'Wed', views: 200, taps: 980 },
                    { name: 'Thu', views: 278, taps: 390 },
                    { name: 'Fri', views: 189, taps: 480 },
                    { name: 'Sat', views: 239, taps: 380 },
                    { name: 'Sun', views: 349, taps: 430 },
                ]

                setStats({
                    totalViews,
                    totalClicks,
                    totalTaps,
                    greenImpact: Math.round(totalTaps * 0.5), // Example calc
                    viewHistory: history,
                    topEmployees: employeeStats
                })

            } catch (error) {
                console.error('Failed to aggregate corporate stats:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAggregatedStats()
    }, [company?.id])

    const summaryCards = [
        { label: 'Total Profile Views', value: stats.totalViews, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Total Link Clicks', value: stats.totalClicks, icon: MousePointer2, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Total NFC Taps', value: stats.totalTaps, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Green Impact (kg CO2)', value: stats.greenImpact, icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
    ]

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900">Corporate Analytics</h1>
                    <p className="text-zinc-500 mt-1">Real-time performance metrics across your entire organization.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        Last 30 Days
                    </div>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {summaryCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${card.bg}`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                +8.2% <ArrowUpRight className="w-3 h-3 ml-1" />
                            </span>
                        </div>
                        <p className="text-zinc-500 text-sm font-medium">{card.label}</p>
                        <p className="text-2xl font-bold text-zinc-900 mt-1">{isLoading ? '...' : <AnimatedNumber value={card.value} />}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Trend Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900">Engagement Overview</h3>
                            <p className="text-zinc-400 text-sm">Comparison between profile views and NFC taps.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                                <span className="text-xs text-zinc-500 font-medium">Views</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs text-zinc-500 font-medium">Taps</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.viewHistory}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorTaps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        padding: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="views"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorViews)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="taps"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTaps)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Performers */}
                <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-zinc-900">Leaderboard</h3>
                        <p className="text-zinc-400 text-sm">Top employees by profile interactions.</p>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-zinc-50 rounded-2xl animate-pulse" />)
                        ) : stats.topEmployees.map((emp, i) => (
                            <div key={emp.name} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-zinc-400 text-xs shadow-sm">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{emp.name}</p>
                                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">{emp.engagement}% conversion</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-zinc-900">{emp.views.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Views</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="w-full mt-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-all border border-transparent hover:border-zinc-100">
                        View Detailed Rankings
                    </button>
                </div>
            </div>
        </div>
    )
}
