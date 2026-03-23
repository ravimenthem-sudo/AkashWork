import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function UseCasesSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.use-case-card', { opacity: 0, y: 30 })

            gsap.to('.use-case-card', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                },
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.1,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-paper px-4 md:px-16" id="use-cases">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-cyan mb-6 block">
                        BUILT FOR REAL USE CASES
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-6">
                        Designed to Work <span className="text-accent-cyan">Where It Matters</span>
                    </h2>
                </div>

                <div className="flex flex-wrap justify-center gap-6 mb-16">
                    {[
                        'Professional services firms',
                        'Internal Talent Ops teams',
                        'Educational institutions and academies'
                    ].map((useCase, i) => (
                        <div key={i} className="use-case-card group p-8 bg-white rounded-xl border border-graphite/10 hover:border-accent-cyan/50 hover:shadow-md transition-all duration-300 w-full md:w-[calc(50%-1.5rem)]">
                            <div className="flex items-center gap-4">
                                <h3 className="font-elegant text-2xl text-ink font-medium">{useCase}</h3>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="use-case-card flex flex-wrap justify-center gap-4 md:gap-12">
                    {['Compliance-aware', 'Process-driven', 'Scalable across sectors'].map((tag, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-accent-cyan">✓</span>
                            <span className="font-elegant text-lg text-graphite font-medium">{tag}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
