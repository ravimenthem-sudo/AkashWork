import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function LearningLoopSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.loop-item', { opacity: 0, scale: 0.9 })

            gsap.to('.loop-item', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                },
                opacity: 1,
                scale: 1,
                stagger: 0.1,
                duration: 0.6,
                ease: 'back.out(1.2)'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-paper-warm px-4 md:px-16" id="learning">
            <div className="max-w-5xl mx-auto text-center">
                <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-violet mb-6 block">
                    LEARN → WORK → IMPROVE LOOP
                </span>

                <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-8">
                    Learning That Leads to <span className="text-accent-violet">Real Work</span>
                </h2>

                <p className="font-elegant text-xl text-graphite mb-16 max-w-2xl mx-auto">
                    Certificates don’t build confidence. Real work does.
                    TalentOps connects learning directly to execution.
                </p>

                <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-16 py-4">
                    {['Learn', 'Work', 'Improve', 'Earn', 'Scale'].map((step, i, arr) => (
                        <div key={i} className="flex flex-col md:flex-row items-center shrink-0">
                            <div className="loop-item px-8 py-4 rounded-full bg-white border border-gray-100 shadow-sm transition-all duration-300 min-w-[120px] text-center hover:shadow-lg hover:-translate-y-1 hover:border-accent-violet/30 cursor-default">
                                <span className="font-elegant text-xl text-ink font-medium transition-colors duration-300 group-hover:text-accent-violet">
                                    {step}
                                </span>
                            </div>
                            {i < arr.length - 1 && (
                                <div className="loop-item my-2 md:my-0 md:mx-4 text-gray-300 md:rotate-0 rotate-90">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                        <polyline points="12 5 19 12 12 19"></polyline>
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
                    {[
                        'AI-guided upskilling aligned to real roles',
                        'Live projects, not mock exercises',
                        'Continuous improvement through feedback',
                        'Industry-ready talent, not certificate holders'
                    ].map((feature, i) => (
                        <div key={i} className="loop-item p-6 bg-white rounded-xl border border-graphite/10 shadow-sm hover:-translate-y-1 transition-transform duration-300">
                            <div className="w-2 h-2 rounded-full bg-accent-violet mb-4" />
                            <p className="font-elegant text-lg text-ink font-medium leading-relaxed">{feature}</p>
                        </div>
                    ))}
                </div>

                <p className="mt-16 font-display text-2xl text-ink font-medium">
                    This is where education meets outcomes.
                </p>

            </div>
        </section>
    )
}
