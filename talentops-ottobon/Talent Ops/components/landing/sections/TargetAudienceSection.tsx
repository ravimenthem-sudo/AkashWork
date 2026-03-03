import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function TargetAudienceSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.audience-card', { opacity: 0, y: 20 })
            gsap.set('.audience-text', { opacity: 0, y: 10 })

            gsap.to('.audience-card', {
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
            gsap.to('.audience-text', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: 0.4,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-white px-8 md:px-16" id="audience">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-graphite/60 mb-4 block">
                        WHO THIS IS FOR (BUYER SELF-SELECTION)
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-4">
                        Who Uses TalentOps
                    </h2>
                    <p className="font-elegant text-lg text-graphite">
                        If execution quality matters, TalentOps fits.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
                    {[
                        'Founders who want to focus on delivery, not operations',
                        'Small teams scaling their first service lines',
                        'Mid-sized companies expanding into new regions',
                        'Organizations that want visibility without complexity'
                    ].map((text, i) => (
                        <div key={i} className="audience-card p-6 bg-white rounded-xl border border-graphite/10 shadow-sm flex items-center justify-center text-center transition-all duration-300 hover:shadow-md hover:border-accent-violet/30">
                            <p className="font-display text-lg font-medium text-ink leading-relaxed">
                                {text}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="border-t border-graphite/10 w-16 mx-auto mb-12"></div>

                <div className="text-center audience-text">
                    <h3 className="font-display text-2xl md:text-3xl font-medium text-ink mb-2">
                        Whether you <span className="text-accent-violet">outsource everything</span> <br />
                        Or <span className="text-accent-cyan">manage it yourself</span>
                    </h3>
                    <p className="font-elegant text-base text-graphite/60 italic">
                        The operating system remains the same.
                    </p>
                </div>
            </div>
        </section>
    )
}
