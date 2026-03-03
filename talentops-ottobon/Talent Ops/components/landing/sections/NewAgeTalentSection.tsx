import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function NewAgeTalentSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 70%',
                    end: 'bottom 80%',
                    toggleActions: 'play none none reverse',
                }
            })

            // Initial setup
            gsap.set('.new-age-title', { y: 50, opacity: 0 })
            gsap.set('.new-age-text', { y: 30, opacity: 0 })
            gsap.set('.new-age-highlight', { scale: 0.95, opacity: 0 })
            gsap.set('.new-age-pillar', { y: 20, opacity: 0 })
            gsap.set('.new-age-divider', { scaleX: 0, opacity: 0 })

            tl.to('.new-age-title', { y: 0, opacity: 1, duration: 1, ease: 'power3.out' })
                .to('.new-age-text-1', { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
                .to('.new-age-highlight', { scale: 1, opacity: 1, duration: 0.8 }, '-=0.4')
                .to('.new-age-text-2', { y: 0, opacity: 1, duration: 0.8 }, '-=0.4')
                .to('.new-age-divider', { scaleX: 1, opacity: 0.3, duration: 0.8, ease: 'power2.inOut' }, '-=0.2')
                .to('.new-age-text-3', { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
                .to('.new-age-pillar', {
                    y: 0,
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.1
                }, '-=0.4')
                .to('.new-age-text-4', { y: 0, opacity: 1, duration: 0.8 }, '-=0.2')
                .to('.new-age-footer', { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')

        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-24 md:py-32 bg-paper relative overflow-hidden">
            {/* Background Gradients (Subtle) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-accent-violet/5 rounded-full blur-[100px]" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] bg-accent-cyan/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-4xl mx-auto px-6 md:px-8 relative z-10">
                {/* Header */}
                <h2 className="new-age-title font-display text-4xl md:text-5xl lg:text-6xl font-bold text-ink mb-8 leading-tight">
                    <span className="text-gradient-violet">New Age</span> of Talent
                </h2>

                <p className="new-age-text new-age-text-1 font-elegant text-xl md:text-2xl text-graphite mb-12 max-w-2xl">
                    Talent is no longer defined by location, degrees, or job titles.
                </p>

                {/* Highlight Box */}
                <div className="new-age-highlight bg-white border border-graphite/10 p-8 md:p-12 mb-12 rounded-2xl relative overflow-hidden group shadow-sm">
                    {/* Glossy Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-accent-violet/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <p className="font-display text-2xl md:text-4xl text-ink text-center leading-snug">
                        It is defined by how fast ideas become <span className="text-accent-violet italic">outcomes</span>.
                    </p>
                </div>

                <div ref={contentRef} className="space-y-12">
                    <div className="new-age-text new-age-text-2 space-y-6">
                        <p className="font-elegant text-xl md:text-2xl text-graphite leading-relaxed">
                            Today’s talent is distributed, self-driven, and execution-hungry.
                            <br />
                            But most systems are still built for the old world of employment.
                        </p>
                    </div>

                    <div className="new-age-divider w-24 h-[1px] bg-accent-violet" />

                    <div className="new-age-text new-age-text-3">
                        <p className="font-elegant text-xl md:text-2xl text-graphite mb-8">
                            In this new age, skill is not rare. Ideas are not rare. <br />
                            <span className="font-bold text-accent-violet italic">What is rare is structure.</span>
                        </p>
                    </div>

                    {/* Pillars */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        {['Clarity', 'Ownership', 'Momentum', 'Proof'].map((item) => (
                            <div key={item} className="new-age-pillar p-4 border border-graphite/10 bg-paper-warm rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300">
                                <span className="font-display text-sm md:text-base font-bold uppercase tracking-widest text-accent-violet">
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="new-age-text new-age-text-4 pt-8">
                        <p className="font-elegant text-xl text-graphite/80 italic">
                            Talent doesn’t fail because people lack ability. <br />
                            Talent fails because <span className="text-ink decoration-accent-violet/30 underline decoration-1 underline-offset-4">execution systems are missing</span>.
                        </p>
                    </div>

                    <div className="new-age-text new-age-footer mt-16 p-8 border border-graphite/5 bg-gradient-to-r from-gray-50 to-transparent text-center rounded-2xl">
                        <p className="font-display text-2xl md:text-3xl font-medium text-ink">
                            This is why Talent Ops can no longer be an HR function.
                        </p>
                        <p className="font-display text-sm tracking-[0.2em] text-accent-violet uppercase">
                            It must become an execution engine.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
