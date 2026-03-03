import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'

export function HeroSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            const words = gsap.utils.toArray('.hero-word')

            // Set initial visible state
            gsap.set(words, { y: 0, opacity: 1, rotateX: 0 })

            gsap.fromTo(words,
                { y: 50, opacity: 0, rotateX: -20 },
                {
                    y: 0,
                    opacity: 1,
                    rotateX: 0,
                    stagger: 0.08,
                    duration: 0.8,
                    ease: 'power3.out',
                    delay: 0.1
                }
            )

            gsap.fromTo('.scroll-indicator',
                { opacity: 0, y: -10 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    delay: 1,
                    repeat: -1,
                    yoyo: true,
                    ease: 'power2.inOut'
                }
            )
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section
            ref={sectionRef}
            id="hero"
            className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden bg-paper px-4 md:px-16"
        >
            <div className="relative z-10 w-full max-w-full md:max-w-screen-2xl text-center perspective-[1000px] flex flex-col items-center justify-center gap-0 px-4">
                <div className="overflow-hidden">
                    <span className="hero-word inline-block font-display text-[clamp(1.5rem,4vw,3rem)] italic text-ink font-medium origin-bottom">
                        THE
                    </span>
                </div>

                <div className="overflow-hidden w-full">
                    <h1
                        className="hero-word font-display text-[clamp(1.75rem,8vw,9rem)] font-bold leading-[0.85] tracking-tight w-full origin-bottom"
                        style={{
                            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            color: 'transparent'
                        }}
                    >
                        ARCHITECTURE
                    </h1>
                </div>

                <div className="overflow-hidden">
                    <span className="hero-word inline-block font-display text-[clamp(1.5rem,4vw,3rem)] italic text-ink font-medium origin-bottom">
                        OF
                    </span>
                </div>

                <div className="overflow-hidden w-full">
                    <h2 className="hero-word font-display text-[clamp(1.75rem,8vw,9rem)] font-black leading-[0.85] tracking-tight text-ink w-full origin-bottom">
                        TALENT
                    </h2>
                </div>
            </div>

            <div className="scroll-indicator absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
                <span className="font-accent text-[0.6rem] tracking-[0.2em] uppercase text-graphite">SCROLL TO EXPLORE</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-graphite to-transparent" />
            </div>
        </section>
    )
}
