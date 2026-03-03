import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function OfferSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Set initial states
            gsap.set('.offer-card', { opacity: 1, y: 0 })
            gsap.set('.positioning-line', { opacity: 1, y: 0 })

            gsap.from('.offer-card', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 85%',
                    invalidateOnRefresh: true,
                },
                y: 40,
                opacity: 0,
                stagger: 0.15,
                duration: 0.8,
                ease: 'power3.out'
            })

            gsap.from('.positioning-line', {
                scrollTrigger: {
                    trigger: '.positioning-line',
                    start: 'top 95%',
                    invalidateOnRefresh: true,
                },
                opacity: 0,
                y: 15,
                duration: 0.8,
                delay: 0.3
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-32 bg-paper px-8 md:px-16" id="features">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <span className="font-accent text-xs font-medium tracking-[0.3em] uppercase text-graphite-light mb-6 block">
                        WHAT WE OFFER (Clarity, Not Features)
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-bold text-ink mb-6">
                        What We Offer
                    </h2>
                    <p className="font-elegant text-xl text-graphite max-w-2xl mx-auto">
                        TalentOps is available in two forms, depending on how much you want to own.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    {/* Card 1: Service */}
                    <div className="offer-card relative p-10 bg-white rounded-2xl border border-graphite/10 hover:border-accent-violet transition-all duration-300 shadow-sm group hover:-translate-y-2 hover:shadow-2xl">
                        <div className="mb-8">
                            <h3 className="font-display text-3xl font-bold text-ink mb-4">Talent Ops as a Service</h3>
                            <p className="font-elegant text-lg text-graphite/80">
                                For companies that want to focus purely on execution.
                            </p>
                        </div>

                        <div className="mb-8 p-6 bg-paper-warm rounded-xl">
                            <p className="font-medium text-ink mb-4">We remotely manage your end-to-end talent operations from India, including:</p>
                            <ul className="space-y-3">
                                {['Hiring and onboarding', 'HR operations', 'Project and delivery management', 'Billing and invoicing'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-graphite">
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-6 border-t border-graphite/10">
                            <p className="font-display text-xl font-medium text-accent-violet">
                                You don’t build teams or processes.<br />
                                You consume outcomes.
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Platform */}
                    <div className="offer-card relative p-10 bg-white rounded-2xl border border-graphite/10 hover:border-accent-cyan transition-all duration-300 shadow-sm group hover:-translate-y-2 hover:shadow-2xl">
                        <div className="mb-8">
                            <h3 className="font-display text-3xl font-bold text-ink mb-4">Talent Ops as a Platform</h3>
                            <p className="font-elegant text-lg text-graphite/80">
                                For companies with teams that want operational clarity.
                            </p>
                        </div>

                        <div className="mb-8 p-6 bg-paper-warm rounded-xl">
                            <p className="font-medium text-ink mb-4">Use a single system to manage:</p>
                            <ul className="space-y-3">
                                {['People', 'Work', 'Delivery', 'Revenue'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-graphite">
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-6 border-t border-graphite/10">
                            <p className="font-display text-xl font-medium text-graphite">
                                Replace tool chaos with a unified Operating System.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="positioning-line text-center py-10 border-y border-graphite/10">
                    <p className="font-display text-2xl md:text-3xl font-medium text-ink">
                        Platform when you want <span className="text-accent-cyan">control</span>.
                        Service when you want <span className="text-accent-violet">simplicity</span>.
                    </p>
                </div>
            </div>
        </section>
    )
}
