import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function WhyNowSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.why-content', { opacity: 0, scale: 0.95 })

            gsap.to('.why-content', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 75%',
                },
                opacity: 1,
                scale: 1,
                duration: 0.8,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-white px-8 md:px-16" id="why-now">
            <div className="max-w-4xl mx-auto text-center why-content">
                <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-red-500 mb-6 block">
                    WHY NOW? (AI REALISM, NOT HYPE)
                </span>

                <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-10 leading-tight">
                    AI Hype Is Real. <br />
                    <span className="text-red-500">Jobs Aren’t Guaranteed.</span>
                </h2>

                <div className="bg-white p-10 rounded-2xl shadow-sm border border-graphite/10 max-w-3xl mx-auto">
                    <div className="space-y-4 mb-8 font-elegant text-xl text-graphite">
                        <p>AI adoption is rising.</p>
                        <p>Hiring is cautious.</p>
                        <p className="font-medium text-ink">Skill displacement is already happening.</p>
                    </div>

                    <div className="py-8 border-y border-graphite/10 mb-8">
                        <p className="font-display text-2xl text-ink leading-relaxed">
                            The winners won’t be "AI experts." <br />
                            They’ll be <span className="text-accent-indigo font-bold bg-indigo-50 px-2 py-1 rounded">AI-native operators</span>
                        </p>
                        <p className="mt-4 font-elegant text-lg text-graphite/80">
                            — people who know how to work with systems, structure, and execution.
                        </p>
                    </div>

                    <p className="font-display text-xl font-medium text-red-500">
                        Adapt before displacement forces it.
                    </p>
                </div>
            </div>
        </section>
    )
}
