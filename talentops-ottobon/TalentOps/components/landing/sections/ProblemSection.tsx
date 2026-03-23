import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function ProblemSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Set initial states
            gsap.set('.problem-title', { opacity: 1, y: 0 })
            gsap.set('.problem-list li', { opacity: 1, x: 0 })
            gsap.set('.solution-text', { opacity: 1, scale: 1 })

            gsap.from('.problem-title', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse',
                    invalidateOnRefresh: true,
                },
                y: 40,
                opacity: 0,
                duration: 0.8,
            })
            gsap.from('.problem-list li', {
                scrollTrigger: {
                    trigger: '.problem-list',
                    start: 'top 90%',
                    toggleActions: 'play none none reverse',
                    invalidateOnRefresh: true,
                },
                x: -25,
                opacity: 0,
                stagger: 0.08,
                duration: 0.6,
            })
            gsap.from('.solution-text', {
                scrollTrigger: {
                    trigger: '.solution-text',
                    start: 'top 95%',
                    invalidateOnRefresh: true,
                },
                scale: 0.97,
                opacity: 0,
                duration: 0.8,
                delay: 0.2
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-paper-warm px-8 md:px-16">
            <div className="max-w-4xl mx-auto">
                <h2 className="problem-title font-display text-[clamp(2.5rem,6vw,4rem)] font-bold text-ink mb-16 leading-tight">
                    Why Manual Processes<br />
                    <span className="text-red-500/80">Break</span>
                </h2>

                <div className="mb-12">
                    <p className="font-elegant text-xl text-graphite mb-8">
                        In professional services, talent operations are fragmented by design. Traditionally, you need:
                    </p>
                    <ul className="problem-list space-y-6 mb-16">
                        {[
                            'One person for hiring and HR',
                            'One person for delivery or project management',
                            'One person for billing and finance'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-4 text-xl font-elegant text-graphite">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                {item}
                            </li>
                        ))}
                    </ul>
                    <p className="font-elegant text-2xl text-graphite/60 italic">
                        Each sees only their part. No one sees the whole system.
                    </p>
                </div>

                <div className="solution-text p-8 border-l-4 border-red-500 bg-red-50 rounded-r-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <h3 className="font-display text-2xl text-red-600 font-bold mb-6">The Result</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {['Delays', 'Blind spots', 'Low accountability', 'Teams disconnected from business reality'].map((res, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-red-500">✕</span>
                                <span className="font-medium text-ink">{res}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
