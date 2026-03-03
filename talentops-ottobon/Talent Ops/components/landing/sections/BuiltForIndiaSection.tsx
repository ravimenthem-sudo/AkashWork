import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function BuiltForIndiaSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.reveal-text', { opacity: 0, y: 30 })

            gsap.fromTo('.reveal-text',
                { opacity: 0, y: 30 },
                {
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        start: 'top 80%',
                        toggleActions: 'play none none reverse',
                    },
                    opacity: 1,
                    y: 0,
                    stagger: 0.1,
                    duration: 0.8,
                    ease: 'power2.out'
                }
            )
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-white px-4 md:px-16" id="built-for-india">
            <div className="max-w-4xl mx-auto">
                <span className="reveal-text font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-violet mb-6 block">

                </span>

                <h2 className="reveal-text font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-8 leading-tight">
                    Built for <span className="text-accent-violet">Tier-2 & Tier-3</span> Cities
                </h2>

                <div className="reveal-text mb-12 space-y-6">
                    <p className="font-elegant text-xl text-graphite">
                        Most global HR tools assume metro realities. India doesn’t work that way.
                    </p>
                    <p className="font-elegant text-xl text-graphite">
                        Talent in Tier-2 and Tier-3 cities thinks differently, communicates differently, and works under different constraints.
                    </p>
                    <p className="font-medium text-xl text-ink border-l-4 border-accent-cyan pl-6 py-2 bg-cyan-50/50 rounded-r-lg">
                        Your people don’t lack intelligence. They lose productivity in translation.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {[
                        'Thinks in native language → executes in English',
                        'Bilingual cognition is real, not a flaw',
                        'Confidence gaps reduce output, not capability',
                        'One-size-fits-all SaaS breaks here'
                    ].map((item, i) => (
                        <div key={i} className="reveal-text flex items-center gap-4 p-6 bg-gray-50 rounded-xl border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-accent-indigo/30">
                            <span className="w-2 h-2 rounded-full bg-accent-indigo shrink-0" />
                            <span className="font-elegant text-lg text-graphite">{item}</span>
                        </div>
                    ))}
                </div>

                <p className="reveal-text font-display text-2xl text-ink font-medium text-center md:text-left">
                    Designed for scalable, repeatable execution.
                </p>
            </div>
        </section>
    )
}
