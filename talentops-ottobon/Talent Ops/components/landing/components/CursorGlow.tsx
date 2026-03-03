import React, { useRef, useEffect } from 'react'

export function CursorGlow() {
    const glowRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const targetPos = useRef({ x: 0, y: 0 })
    const currentPos = useRef({ x: 0, y: 0 })

    useEffect(() => {
        // Check if device supports hover (desktop only)
        const hasHover = window.matchMedia('(hover: hover)').matches
        if (!hasHover) return

        const handleMouseMove = (e: MouseEvent) => {
            targetPos.current = { x: e.clientX, y: e.clientY }
        }

        const animate = () => {
            if (!glowRef.current) return

            // Smooth lerp animation
            currentPos.current.x += (targetPos.current.x - currentPos.current.x) * 0.15
            currentPos.current.y += (targetPos.current.y - currentPos.current.y) * 0.15

            glowRef.current.style.transform = `translate(${currentPos.current.x}px, ${currentPos.current.y}px) translate(-50%, -50%)`

            rafRef.current = requestAnimationFrame(animate)
        }

        document.addEventListener('mousemove', handleMouseMove, { passive: true })
        rafRef.current = requestAnimationFrame(animate)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [])

    return (
        <div
            ref={glowRef}
            className="fixed w-[300px] h-[300px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[9999] opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{
                background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
                willChange: 'transform',
            }}
        />
    )
}
