import type { Metadata } from 'next'

// Root layout memasang manifest yang start_url-nya /dashboard, dan iOS memakai
// start_url itu saat "Add to Home Screen" — bukan halaman yang sedang dibuka.
// Manifest sendiri di sini bikin ikonnya membuka /switch, bukan dashboard.
export const metadata: Metadata = {
    title: 'Pintasan',
    manifest: '/switch.webmanifest?v=e4deab2832b5',
    appleWebApp: {
        capable: true,
        title: 'Pintasan',
        statusBarStyle: 'black-translucent',
    },
}

export default function SwitchLayout({ children }: { children: React.ReactNode }) {
    return children
}
