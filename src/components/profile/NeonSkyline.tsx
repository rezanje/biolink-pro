// Neon Coast: matahari senja bergaris, garis horizon, dan siluet palem.
// Digambar sendiri untuk template ini; bukan aset dari game atau merek lain.

function Palm({ x, flip = false, scale = 1 }: { x: number; flip?: boolean; scale?: number }) {
    const s = flip ? -scale : scale
    return (
        <g transform={`translate(${x} 214) scale(${s} ${scale})`} fill="#12051F">
            {/* batang melengkung */}
            <path d="M-4 0 C -2 -40, 6 -90, 18 -132 L 24 -131 C 14 -90, 6 -40, 5 0 Z" />
            {/* pelepah */}
            <g transform="translate(21 -132)">
                <path d="M0 0 C -18 -14, -44 -14, -64 2 C -42 -4, -20 -2, 0 6 Z" />
                <path d="M0 0 C -12 -22, -34 -36, -58 -34 C -36 -26, -18 -14, 0 4 Z" />
                <path d="M0 0 C 2 -22, -6 -42, -22 -54 C -12 -36, -6 -18, 2 2 Z" />
                <path d="M0 0 C 14 -20, 36 -30, 60 -26 C 38 -20, 18 -10, 2 4 Z" />
                <path d="M0 0 C 20 -8, 46 -4, 64 12 C 42 4, 20 2, 0 6 Z" />
                <path d="M0 0 C 10 -4, 24 6, 30 24 C 20 12, 10 6, -2 6 Z" />
            </g>
        </g>
    )
}

export function NeonSkyline({ withSky = false }: { withSky?: boolean }) {
    return (
        <svg className="card-neon-skyline" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="neon-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2B0F4C" />
                    <stop offset="0.45" stopColor="#7A1E6C" />
                    <stop offset="0.75" stopColor="#FF4F7B" />
                    <stop offset="1" stopColor="#FF9A3D" />
                </linearGradient>
                <linearGradient id="neon-sun" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFE66D" />
                    <stop offset="0.55" stopColor="#FF8A3D" />
                    <stop offset="1" stopColor="#FF2E88" />
                </linearGradient>
                <mask id="neon-sun-stripes">
                    <rect x="0" y="0" width="400" height="220" fill="#fff" />
                    {[132, 146, 158, 168, 177, 185].map((y, i) => (
                        <rect key={y} x="0" y={y} width="400" height={2 + i * 0.9} fill="#000" />
                    ))}
                </mask>
            </defs>
            {withSky && <rect x="0" y="0" width="400" height="220" fill="url(#neon-sky)" />}
            {/* Matahari hanya tanpa foto, supaya wajah pemilik tidak tertutup. */}
            {withSky && <circle cx="200" cy="168" r="78" fill="url(#neon-sun)" mask="url(#neon-sun-stripes)" opacity="0.95" />}
            {/* horizon + grid jalan malam */}
            <rect x="0" y="190" width="400" height="30" fill="#12051F" />
            <line x1="0" y1="190" x2="400" y2="190" stroke="#22E4F2" strokeWidth="1.4" opacity="0.9" />
            <g stroke="#FF2E88" strokeWidth="0.8" opacity="0.55">
                {[196, 203, 212].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} />)}
                {[-260, -170, -90, -20, 40, 110, 180, 260].map(dx => <line key={dx} x1={200 + dx * 0.15} y1="190" x2={200 + dx * 1.4} y2="220" />)}
            </g>
            <Palm x={34} scale={1.05} />
            <Palm x={78} scale={0.72} />
            <Palm x={370} flip scale={1.1} />
        </svg>
    )
}
