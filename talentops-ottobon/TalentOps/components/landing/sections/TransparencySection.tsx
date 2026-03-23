import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HolographicCard } from '../components/HolographicCard'

export function TransparencySection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            const blocks = gsap.utils.toArray('.transparency-block')

            // Set initial state explicitly for all blocks
            blocks.forEach((block: any) => {
                gsap.set(block.children, { opacity: 1, y: 0 })
            })

            blocks.forEach((block: any, i) => {
                gsap.from(block.children, {
                    scrollTrigger: {
                        trigger: block,
                        start: 'top 85%',
                        invalidateOnRefresh: true,
                    },
                    y: 25,
                    opacity: 0,
                    stagger: 0.1,
                    duration: 0.8,
                    ease: 'power3.out'
                })
            })

            // Set initial state for dividers
            gsap.set('.divider', { opacity: 1, scaleX: 1 })

            // Divider animation
            gsap.utils.toArray('.divider').forEach((div: any) => {
                gsap.from(div, {
                    scrollTrigger: {
                        trigger: div,
                        start: 'top 95%',
                        invalidateOnRefresh: true,
                    },
                    opacity: 0,
                    scaleX: 0,
                    duration: 0.8,
                    ease: 'power2.out'
                })
            })

        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-32 bg-paper relative overflow-hidden px-8 md:px-16" id="trust">
            {/* Background enhancement */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-graphite/10 to-transparent" />

            <div className="max-w-5xl mx-auto space-y-32">

                {/* Intro Block */}
                <div className="transparency-block text-center max-w-4xl mx-auto">
                    <span className="font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-cyan mb-8 block">
                        TRANSPARENCY
                    </span>
                    <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-bold text-ink mb-10 leading-tight">
                        Visibility That Aligns<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan">People and Performance</span>
                    </h2>
                    <div className="space-y-6 font-elegant text-xl text-graphite leading-relaxed max-w-2xl mx-auto">
                        <p>In every organization, work happens every day—but visibility is often missing.</p>
                        <p>TalentOps brings transparency to effort, contribution, and outcomes, ensuring employees, managers, and executives operate with shared clarity.</p>
                        <p className="font-medium text-ink pt-4 border-t border-graphite/10 mt-8 inline-block w-full">
                            When work is visible, decisions become fair, performance becomes measurable, and trust becomes structural.
                        </p>
                    </div>
                </div>

                <div className="divider flex justify-center text-graphite/20 text-4xl font-display">⸻</div>

                {/* Block 1: Employee Revenue Transparency */}
                <div className="transparency-block grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div>
                        <span className="font-accent text-xs font-medium tracking-[0.2em] uppercase text-accent-violet mb-4 block">
                            EMPLOYEE REVENUE TRANSPARENCY
                        </span>
                        <h3 className="font-display text-3xl md:text-4xl font-bold text-ink mb-6">
                            Turn Work Into <br /><span className="text-accent-violet">Measurable Business Value</span>
                        </h3>
                        <p className="font-elegant text-lg text-graphite leading-relaxed mb-6">
                            TalentOps connects these dots. Our platform calculates how employee effort across projects and tasks translates into real business value, giving organizations a clear view of salary paid vs revenue generated.
                        </p>
                        <p className="font-elegant text-lg text-graphite leading-relaxed">
                            This transparency helps managers recognize high impact contributors and enables employees to understand their true value to the organization.
                        </p>
                    </div>
                    <div className="bg-white border border-graphite/10 rounded-2xl p-8 shadow-sm">
                        <ul className="space-y-6">
                            {['Every employee works on tasks', 'Every task contributes to a project', 'Every project drives revenue'].map((item, i) => (
                                <li key={i} className="flex items-center gap-4 text-xl text-ink font-display">
                                    <span className="w-2 h-2 rounded-full bg-accent-violet" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="divider flex justify-center text-graphite/20 text-4xl font-display">⸻</div>

                {/* Block 2: Salary vs Revenue */}
                <div className="transparency-block text-center max-w-5xl mx-auto py-24 md:py-32">
                    <span className="font-accent text-sm font-medium tracking-[0.2em] uppercase text-accent-cyan mb-10 block">
                        SALARY VS REVENUE — FULL TRANSPARENCY
                    </span>
                    <h3 className="font-display text-5xl md:text-6xl font-bold text-ink mb-16">
                        Transparency That Builds Trust
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
                        {[
                            { title: 'Employees', desc: 'See how their work contributes to company revenue' },
                            { title: 'Team Lead', desc: 'Monitor team performance and guide execution' },
                            { title: 'Managers', desc: 'Identify who drives measurable outcomes' },
                            { title: 'Executives', desc: 'Understand workforce profitability at a glance' }
                        ].map((card, i) => (
                            <div key={i} className="relative h-[200px] overflow-hidden group cursor-pointer">
                                {/* Slide 1 - Title (visible by default, slides up on hover) */}
                                <div className="absolute w-full h-full flex items-center justify-center bg-accent-cyan rounded-xl transition-transform duration-700 ease-out group-hover:-translate-y-full z-10">
                                    <h4 className="font-display text-2xl text-white text-center px-4">{card.title}</h4>
                                </div>

                                {/* Slide 2 - Description (hidden below, slides up on hover) */}
                                <div className="absolute w-full h-full flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-graphite/10 shadow-lg transition-transform duration-700 ease-out translate-y-full group-hover:translate-y-0">
                                    <p className="font-elegant text-graphite text-base leading-relaxed text-center">{card.desc}</p>
                                    {/* Bottom accent line */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-accent-cyan rounded-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="font-display text-2xl md:text-3xl text-ink">
                        Visible. Role-based. Secure.<br />
                        <span className="text-graphite text-xl md:text-2xl font-elegant mt-6 block">
                            Transparency designed to align effort, performance, and growth.
                        </span>
                    </p>
                </div>

                <div className="divider flex justify-center text-graphite/20 text-4xl font-display">⸻</div>

                {/* Block 3: Tasks to Revenue */}
                <div className="transparency-block grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="order-2 md:order-1 bg-gradient-to-br from-paper-warm to-white border border-graphite/10 rounded-2xl p-8 shadow-sm">
                        <h4 className="font-display text-xl text-ink mb-6 border-b border-graphite/10 pb-4">TalentOps Analyzes:</h4>
                        <ul className="space-y-4 mb-8">
                            {['Time spent on tasks and projects', 'Task completion and work consistency', 'Project involvement and outcomes'].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-graphite">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <div className="p-4 bg-violet-50 border border-accent-violet/20 rounded-xl text-center">
                            <p className="font-display text-lg text-accent-violet">
                                ↓ Transforms daily work into <br /><span className="font-bold">Revenue Intelligence</span>
                            </p>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <span className="font-accent text-xs font-medium tracking-[0.2em] uppercase text-accent-violet mb-4 block">
                            FROM TASKS TO REVENUE INTELLIGENCE
                        </span>
                        <h3 className="font-display text-3xl md:text-4xl font-bold text-ink mb-6">
                            Every Action Counts
                        </h3>
                        <p className="font-elegant text-lg text-graphite leading-relaxed">
                            This allows organizations to move from <span className="text-ink font-medium">activity tracking</span> to <span className="text-accent-violet font-medium">impact measurement</span>.
                        </p>
                    </div>
                </div>

                <div className="divider flex justify-center text-graphite/20 text-4xl font-display">⸻</div>

                {/* Block 4: One Platform */}
                <div className="transparency-block text-center">
                    <span className="font-accent text-xs font-medium tracking-[0.2em] uppercase text-accent-cyan mb-4 block">
                        ONE PLATFORM. ALL ORGANIZATIONAL TOOLS.
                    </span>
                    <h3 className="font-display text-3xl md:text-4xl font-bold text-ink mb-12">
                        No More Disconnected Systems
                    </h3>
                    <div className="max-w-6xl mx-auto mb-12">
                        {/* First row - 4 cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {[
                                'HR Management', 'Work Management', 'Payroll & Finance',
                                'Hiring & Recruitment'
                            ].map((tool, i) => (
                                <HolographicCard key={i}>
                                    <div className="p-8 text-ink font-display text-xl flex items-center justify-center text-center min-h-[120px]">
                                        {tool}
                                    </div>
                                </HolographicCard>
                            ))}
                        </div>
                        {/* Second row - 3 cards centered */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                            {[
                                'Organization Structure', 'Communication',
                                'Analytics & Dashboards'
                            ].map((tool, i) => (
                                <HolographicCard key={i + 4}>
                                    <div className="p-8 text-ink font-display text-xl flex items-center justify-center text-center min-h-[120px]">
                                        {tool}
                                    </div>
                                </HolographicCard>
                            ))}
                        </div>
                    </div>
                    <p className="font-display text-2xl text-ink italic">
                        Everything works together — seamlessly.
                    </p>
                </div>

                <div className="divider flex justify-center text-graphite/20 text-4xl font-display">⸻</div>

                {/* Block 5: Modern Organizations */}
                <div className="transparency-block text-center max-w-4xl mx-auto py-20">
                    <span className="font-accent text-xs font-medium tracking-[0.2em] uppercase text-graphite-light mb-8 block">
                        BUILT FOR MODERN ORGANIZATIONS
                    </span>
                    <h3 className="font-display text-4xl md:text-5xl font-bold text-ink mb-12 leading-tight">
                        Designed for <br />Scale, Clarity, and Control
                    </h3>
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-16 text-graphite font-elegant text-base">
                        <span>Data-driven decisions</span> •
                        <span>Reduced complexity</span> •
                        <span>Fairness through visibility</span>
                    </div>
                    <div className="space-y-3">
                        <p className="font-display text-2xl md:text-3xl text-graphite">It's not just management.</p>
                        <p className="font-display text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-indigo">
                            It's organizational intelligence.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    )
}
