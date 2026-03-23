import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

// Register GSAP Plugin
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
    const lenisRef = useRef<Lenis | null>(null)

    useEffect(() => {
        // Initialize Lenis with optimized settings for better performance
        const lenis = new Lenis({
            duration: 0.6,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1.0,
            touchMultiplier: 2,
        } as any)

        lenisRef.current = lenis

        // Sync Lenis with GSAP ScrollTrigger
        lenis.on('scroll', ScrollTrigger.update)

        // Add Lenis raf to GSAP ticker
        // GSAP ticker gives time in seconds, Lenis needs ms
        const update = (time: number) => {
            lenis.raf(time * 1000)
        }

        gsap.ticker.add(update)

        // Disable GSAP's lag smoothing for better sync with Lenis
        gsap.ticker.lagSmoothing(0)

        // Intercept Anchor Clicks for Smooth Scroll
        const handleAnchorClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const anchor = target.closest('a')
            if (anchor && anchor.hash && anchor.hash.length > 1 && anchor.origin === window.location.origin) {
                e.preventDefault()
                lenis.scrollTo(anchor.hash, { offset: 0 })
            }
        }

        document.addEventListener('click', handleAnchorClick)

        return () => {
            gsap.ticker.remove(update) // Important cleanup
            document.removeEventListener('click', handleAnchorClick)
            lenis.destroy()
            lenisRef.current = null
        }
    }, [])

    return <>{children}</>
}
