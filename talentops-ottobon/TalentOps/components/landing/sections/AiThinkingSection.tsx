import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HolographicCard } from '../components/HolographicCard'

export function AiThinkingSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.ai-item', { opacity: 0, y: 25 })

            gsap.fromTo('.ai-item',
                { opacity: 0, y: 25 },
                {
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        start: 'top 85%',
                    },
                    opacity: 1,
                    y: 0,
                    stagger: 0.1,
                    duration: 0.8
                }
            )
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-paper-warm overflow-hidden relative px-8 md:px-16" id="ai-thinking">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="ai-item font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-6 leading-tight">
                        AI That Understands <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-violet to-accent-cyan">How People Think</span>
                    </h2>
                    <p className="ai-item font-display text-2xl text-graphite">Not Just What They Do</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
                    <HolographicCard className="ai-item p-8 bg-white/50 backdrop-blur-sm space-y-6">
                        <ul className="space-y-6">
                            <li className="flex items-start gap-3">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />
                                <p className="font-elegant text-xl text-graphite">
                                    Most systems track tasks. <br />
                                    <span className="text-red-500 font-medium">They ignore cognition.</span>
                                </p>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />
                                <p className="font-elegant text-xl text-graphite">
                                    TalentOps adapts to how people process information, not just outcomes.
                                </p>
                            </li>
                        </ul>
                    </HolographicCard>

                    <HolographicCard className="ai-item p-8 bg-white/50 backdrop-blur-sm">
                        <h3 className="font-display text-xl text-ink mb-6">What this means:</h3>
                        <ul className="space-y-4">
                            {[
                                'Supports bilingual communication naturally',
                                'Adapts to personality and working style',
                                'Reduces cognitive load, not adds dashboards',
                                'Improves clarity, confidence, and speed'
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-lg text-graphite">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </HolographicCard>
                </div>

                <div className="ai-item text-center border-t border-graphite/10 pt-12">
                    <p className="font-display text-2xl md:text-3xl font-medium text-ink">
                        This is AI aligned to human thinking
                        <br /><span className="text-graphite/60 text-xl md:text-2xl mt-2 block">— not forcing humans to think like software.</span>
                    </p>
                </div>
            </div>
        </section>
    )
}
