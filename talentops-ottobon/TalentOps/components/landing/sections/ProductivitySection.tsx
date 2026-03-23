import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function ProductivitySection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.prod-item', { opacity: 0, scale: 0.95 })

            gsap.to('.prod-item', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                },
                opacity: 1,
                scale: 1,
                stagger: 0.1,
                duration: 0.6,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 bg-white px-8 md:px-16" id="productivity">
            <div className="max-w-5xl mx-auto">
                <div className="prod-item text-center mb-12">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-cyan mb-4 block">
                        PRODUCTIVITY, NOT JUST HIRING
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-6">
                        Productivity Is the <span className="text-red-500">Real Problem</span>
                    </h2>
                    <p className="font-elegant text-xl text-graphite max-w-2xl mx-auto">
                        Hiring more people won’t fix execution gaps. Training alone won’t unlock output.
                        The biggest opportunity is hidden productivity inside existing teams.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                    {[
                        { title: 'Unlock 30%+', desc: 'productivity from current talent' },
                        { title: 'Transform', desc: 'average performers into high-impact contributors' },
                        { title: 'Reduce Friction', desc: 'across communication, ownership, and follow-through' },
                        { title: 'Unify Tools', desc: 'Replace scattered tools with enforced workflows' }
                    ].map((card, i) => (
                        <div key={i} className="prod-item p-6 bg-paper-warm rounded-2xl border border-graphite/5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-accent-violet/30">
                            <div className="w-10 h-10 rounded-full bg-accent-violet/10 flex items-center justify-center mb-4 text-accent-violet text-xl font-bold">
                                {i + 1}
                            </div>
                            <h3 className="font-display text-lg font-bold text-ink mb-2">{card.title}</h3>
                            <p className="font-elegant text-graphite">{card.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="prod-item text-center bg-accent-indigo/5 p-8 rounded-2xl border border-accent-indigo/10">
                    <p className="font-display text-2xl text-accent-indigo font-medium">
                        This is Talent Operations — not recruitment software.
                    </p>
                </div>
            </div>
        </section>
    )
}
