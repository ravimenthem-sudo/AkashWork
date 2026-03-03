import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function FixedTaskLifecycle() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set('.cycle-step', { opacity: 0, scale: 0.9 })
            gsap.set('.cycle-arrow', { opacity: 0, x: -5 })

            // Simple reveal for steps
            gsap.to('.cycle-step', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 75%',
                },
                opacity: 1,
                scale: 1,
                duration: 0.5,
                stagger: 0.1,
                ease: 'back.out(1.2)'
            })
            // Simple reveal for arrows
            gsap.to('.cycle-arrow', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 75%',
                },
                opacity: 0.5, // Subtle arrow
                x: 0,
                duration: 0.5,
                delay: 0.2, // bit later
                stagger: 0.1
            })

        }, sectionRef)
        return () => ctx.revert()
    }, [])

    const Step = ({ name }: { name: string }) => (
        <div className="cycle-step px-8 py-4 rounded-full bg-white border border-graphite/10 shadow-sm text-ink font-medium font-elegant text-base md:text-lg whitespace-nowrap min-w-[120px] text-center">
            {name}
        </div>
    )

    const Arrow = () => (
        <span className="cycle-arrow text-graphite/40 mx-2">
            →
        </span>
    )

    return (
        <section ref={sectionRef} className="py-24 bg-paper-warm px-4 md:px-16" id="lifecycle">
            <div className="max-w-6xl mx-auto text-center">
                <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-ink mb-6 block">
                    HOW IT WORKS
                </span>
                <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-bold text-ink mb-6">
                    A Consistent Way to Work
                </h2>
                <p className="font-elegant text-lg md:text-xl text-graphite mb-16">
                    Every task in TalentOps follows the same enforced lifecycle.
                </p>

                <div className="flex flex-col items-center gap-8 mb-20 overflow-x-auto pb-4">
                    {/* Row 1 */}
                    <div className="flex items-center flex-wrap justify-center gap-2 md:gap-4">
                        <Step name="Capture" />
                        <Arrow />
                        <Step name="Refinement" />
                        <Arrow />
                        <Step name="Design" />
                        <Arrow />
                        <Step name="Validation" />
                        <Arrow />
                        <Step name="Build Guidance" />
                        <Arrow />
                        {/* Wrap to next line logically if space constrains, but design implies flow */}
                    </div>
                    {/* Row 2 - connecting visually to row 1? Or just a second row. Image shows flow continuing. */}
                    <div className="flex items-center flex-wrap justify-center gap-2 md:gap-4">
                        <Step name="Execution & Tracking" />
                        <Arrow />
                        <Step name="Closing" />
                        <Arrow />
                        <Step name="Learning" />
                    </div>
                </div>

                <div className="border-t border-graphite/10 w-24 mx-auto mb-12"></div>

                <div className="text-center">
                    <span className="font-accent text-[0.65rem] font-bold tracking-[0.2em] uppercase text-accent-violet mb-4 block">
                        KEY PRINCIPLE
                    </span>
                    <p className="font-display text-2xl md:text-3xl font-medium text-ink mb-2">
                        Progress is blocked if requirements are missing.
                    </p>
                    <p className="font-display text-2xl md:text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan mb-10">
                        Completion happens only after validation.
                    </p>
                    <p className="font-elegant text-lg text-graphite">
                        This is how <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan font-bold">consistency is enforced.</span>
                    </p>
                </div>
            </div>
        </section>
    )
}
