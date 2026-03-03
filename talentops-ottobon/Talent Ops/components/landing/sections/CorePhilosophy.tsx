import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function CorePhilosophy() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.core-content', { opacity: 0, y: 30 })

            gsap.to('.core-content', {
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
        <section ref={sectionRef} className="py-24 bg-white px-8 md:px-16" id="core-philosophy">
            <div className="max-w-6xl mx-auto text-center">
                <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-violet mb-8 block core-content">
                    THE SHIFT
                </span>

                <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-ink mb-8 leading-tight core-content max-w-5xl mx-auto">
                    We believe one capable person <br />
                    should be able to <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo to-accent-cyan">see and manage</span> <br />
                    the entire lifecycle.
                </h2>

                <p className="font-elegant text-xl text-graphite mb-20 core-content">
                    From recruiting → to execution → to billing. <span className="text-ink font-medium">End to end.</span>
                </p>

                <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-20">
                    {[
                        'Improves decision-making',
                        'Reduces overhead',
                        'Increases ownership',
                        'Raises employee morale'
                    ].map((benefit, i) => (
                        <div key={i} className="core-content flex items-center gap-3 group">
                            <div className="w-2 h-8 bg-accent-indigo/20 rounded-full flex items-center justify-center relative overflow-hidden group-hover:bg-accent-indigo transition-colors duration-300">
                                <div className="absolute top-0 w-full h-1/2 bg-accent-indigo rounded-full" />
                            </div>
                            <span className="font-elegant text-lg text-graphite group-hover:text-ink transition-colors">{benefit}</span>
                        </div>
                    ))}
                </div>

                <div className="core-content border-t border-graphite/10 pt-16 max-w-4xl mx-auto">
                    <p className="font-display text-xl md:text-2xl text-ink font-medium leading-relaxed">
                        When people see how value is created, they naturally contribute more
                        <br />—without being told.
                    </p>
                </div>
            </div>
        </section>
    )
}
