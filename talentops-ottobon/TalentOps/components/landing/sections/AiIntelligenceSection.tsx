import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function AiIntelligenceSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.ai-content', { opacity: 0, y: 30 })

            gsap.to('.ai-content', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-white px-8 md:px-16" id="intelligence">
            <div className="max-w-6xl mx-auto">
                <div className="mb-16 text-center md:text-left">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-cyan mb-6 block ai-content">
                        WHY THIS IS DIFFERENT (AI, BUT CONTROLLED)
                    </span>
                    <h2 className="ai-content font-display text-[clamp(2.5rem,5vw,5rem)] font-bold text-ink mb-6 leading-tight">
                        AI That Doesn't <br />
                        <span className="text-accent-violet">Invent Work</span>
                    </h2>
                    <p className="ai-content font-elegant text-xl text-graphite/80 max-w-2xl">
                        We still leverage modern LLMs. But intelligence is governed, not unleashed.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {/* Card 1 */}
                    <div className="ai-content p-8 bg-white rounded-2xl border border-graphite/10 shadow-sm transition-all duration-300 hover:shadow-lg">
                        <h4 className="font-display text-2xl font-bold text-ink mb-6">Most AI tools rely on:</h4>
                        <ul className="space-y-3">
                            {[
                                'Generic knowledge',
                                'Pattern guessing',
                                'Hallucinated confidence'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                    <span className="font-elegant text-lg text-graphite">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Card 2 */}
                    <div className="ai-content p-8 bg-white rounded-2xl border border-graphite/10 shadow-sm transition-all duration-300 hover:shadow-lg">
                        <h4 className="font-display text-2xl font-bold text-ink mb-6">TalentOps works differently:</h4>
                        <ul className="space-y-3">
                            {[
                                'Experts define processes and rules',
                                'AI operates only within those boundaries',
                                'Templates replace guesswork',
                                'Validation replaces assumptions'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />
                                    <span className="font-elegant text-lg text-graphite">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="ai-content text-center md:text-left border-t border-graphite/10 pt-12">
                    <p className="font-display text-2xl md:text-3xl font-medium text-ink">
                        AI assists execution. <br />
                        <span className="text-accent-cyan">It never defines reality.</span>
                    </p>
                </div>
            </div>
        </section>
    )
}
