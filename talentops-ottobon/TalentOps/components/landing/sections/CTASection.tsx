import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function CTASection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            const timeline = gsap.timeline({
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 70%',
                    toggleActions: 'play none none reverse',
                    invalidateOnRefresh: true,
                },
            })

            // Set initial states
            gsap.set('.cta-line-top', { scaleX: 0 })
            gsap.set('.cta-line-bottom', { scaleX: 0 })
            gsap.set('.cta-subtext', { y: 20, opacity: 0 })
            gsap.set('.cta-button', { y: 20, opacity: 0 })

            // cta-words 1, 2, 3 already have opacity-0 translate-y-8 in JSX, so we can animate TO them or SET them if we strip JSX.
            // Let's strip JSX classes in next step for consistency, but for now we can just animate to.
            // Actually, best to SET them here too for safety.
            gsap.set('.cta-word-1', { y: 30, opacity: 0 })
            gsap.set('.cta-word-2', { y: 30, opacity: 0 })
            gsap.set('.cta-word-3', { y: 30, opacity: 0 })

            timeline
                .to('.cta-line-top', { scaleX: 1, duration: 0.8, ease: 'power3.inOut' })
                .to('.cta-word-1', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.3')
                .to('.cta-word-2', { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.4')
                .to('.cta-word-3', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.4')
                .to('.cta-subtext', { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.3')
                .to('.cta-button', { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.3')
                .to('.cta-line-bottom', { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, '-=0.3')
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section
            ref={sectionRef}
            id="cta"
            className="min-h-[80vh] bg-ink text-paper flex flex-col justify-center items-center text-center px-8 md:px-16 py-32"
        >
            <div className="max-w-4xl w-full">
                <div className="cta-line-top w-[60px] h-[1px] bg-accent-gold mx-auto mb-32" />

                <div className="flex flex-col gap-0 mb-16">
                    <span className="cta-word-1 font-display text-[clamp(2.5rem,6vw,5rem)] font-bold leading-none tracking-tight">
                        BEGIN
                    </span>
                    <span className="cta-word-2 font-display text-[clamp(1.25rem,3vw,2rem)] font-normal italic text-mist">
                        YOUR
                    </span>
                    <span className="cta-word-3 font-display text-[clamp(2.5rem,6vw,5rem)] font-bold leading-none tracking-tight text-gradient-violet">
                        TRANSFORMATION
                    </span>
                </div>

                <p className="cta-subtext font-elegant text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.8] text-mist mb-16 max-w-3xl mx-auto whitespace-nowrap">
                    The future of work is written in the language of human potential.
                </p>

                <button className="cta-button inline-flex items-center gap-4 font-accent text-sm font-semibold tracking-[0.2em] uppercase text-ink bg-paper px-16 py-8 rounded-sm transition-all duration-300 hover:text-paper relative overflow-hidden group">
                    <span className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan transition-all duration-300 group-hover:left-0 z-0" />
                    <span className="relative z-10">Request a Demo</span>
                    <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
                        →
                    </span>
                </button>

                <div className="cta-line-bottom w-[60px] h-[1px] bg-accent-gold mx-auto mt-32" />
            </div>


        </section>
    )
}
