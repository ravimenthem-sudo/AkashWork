import React, { useRef, useState } from 'react'

export function GlowingCard({ children, className = '', variant = 'dark' }: { children: React.ReactNode, className?: string, variant?: 'dark' | 'light' }) {
    const divRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [opacity, setOpacity] = useState(0)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return

        const rect = divRef.current.getBoundingClientRect()
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    const handleMouseEnter = () => {
        setOpacity(1)
    }

    const handleMouseLeave = () => {
        setOpacity(0)
    }

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${className} ${variant === 'dark' ? 'bg-[#0A0A0B] border-white/5' : 'bg-white border-black/5'}`}
        >
            <div
                className="pointer-events-none absolute -inset-px transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${variant === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}, transparent 40%)`,
                }}
            />
            <div className="relative">{children}</div>
        </div>
    )
}
