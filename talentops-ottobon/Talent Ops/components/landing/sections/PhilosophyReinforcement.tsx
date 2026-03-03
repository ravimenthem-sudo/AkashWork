import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function PhilosophyReinforcement() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.phil-text', { opacity: 0, y: 20 })

            gsap.to('.phil-text', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 75%',
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-paper-warm px-8 md:px-16" id="philosophy">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-violet mb-6 block phil-text">
                        CORE PHILOSOPHY
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-bold text-ink mb-2 phil-text">
                        AI Assists.
                    </h2>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo to-accent-violet phil-text">
                        Experts Decide.
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="phil-text p-8 bg-white rounded-2xl border border-graphite/10 shadow-sm hover:shadow-md transition-all duration-300">
                        <ul className="space-y-4">
                            <li className="flex items-start gap-4">
                                <span className="w-1.5 h-1.5 mt-2.5 rounded-full bg-accent-violet shrink-0" />
                                <span className="font-elegant text-lg text-graphite">Experts define rules.</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="w-1.5 h-1.5 mt-2.5 rounded-full bg-accent-violet shrink-0" />
                                <span className="font-elegant text-lg text-graphite">AI operates within them.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="phil-text p-8 bg-white rounded-2xl border border-graphite/10 shadow-sm hover:shadow-md transition-all duration-300">
                        <ul className="space-y-4">
                            <li className="flex items-start gap-4">
                                <span className="w-1.5 h-1.5 mt-2.5 rounded-full bg-accent-violet shrink-0" />
                                <span className="font-elegant text-lg text-graphite">Progress is blocked if requirements aren't met.</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="w-1.5 h-1.5 mt-2.5 rounded-full bg-accent-violet shrink-0" />
                                <span className="font-elegant text-lg text-graphite">Completion happens only after validation.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="phil-text border-t border-graphite/10 pt-12 mt-8">
                    <div className="flex flex-col md:flex-row justify-center gap-8 md:gap-16 font-display text-xl text-graphite/40 font-medium text-center">
                        <span>No shortcuts.</span>
                        <span>No hallucinations.</span>
                        <span>No fake productivity.</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
