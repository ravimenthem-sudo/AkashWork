import React, { useState, useEffect } from 'react'
import { throttle } from '../utils/throttle'
import { useNavigate } from 'react-router-dom'

export function Navigation() {
    const [scrolled, setScrolled] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 100)

            const darkSections = ['cta']
            let isDarkSection = false
            const navHeight = 100 // Approximate nav height for trigger point

            for (const id of darkSections) {
                const el = document.getElementById(id)
                if (el) {
                    const rect = el.getBoundingClientRect()
                    // Check if section is overlapping with the navigation area
                    if (rect.top <= navHeight && rect.bottom >= navHeight / 2) {
                        isDarkSection = true
                        break
                    }
                }
            }
            setIsDark(isDarkSection)
        }

        const throttledScroll = throttle(handleScroll, 100)
        window.addEventListener('scroll', throttledScroll, { passive: true })
        handleScroll() // Initial call
        return () => window.removeEventListener('scroll', throttledScroll as any)
    }, [])

    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
    }, [isMobileMenuOpen])

    const handleLoginClick = () => {
        navigate('/login')
        setIsMobileMenuOpen(false)
    };

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 ${isMobileMenuOpen
                ? 'h-screen bg-white'
                : `h-auto ${scrolled ? 'bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]' : 'bg-transparent backdrop-blur-sm'}`
                } ${isDark && !isMobileMenuOpen ? 'nav-dark' : ''}`}
        >
            <div className="flex items-center justify-between px-6 md:px-16 py-6 md:py-8">
                <div className={`flex items-center gap-2 relative z-[1002] ${isMobileMenuOpen ? 'text-ink' : ''}`}>
                    <span className="font-display text-2xl md:text-3xl font-bold text-gradient-violet">T</span>
                    <span className={`font-accent text-[0.65rem] md:text-xs font-medium tracking-[0.1em] uppercase transition-colors duration-300 ${isDark && !isMobileMenuOpen ? 'text-paper' : 'text-graphite'}`}>
                        Talent Ops
                    </span>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex gap-12">
                    {['FEATURES', 'TRUST', 'LIFECYCLE', 'AUDIENCE'].map((item) => (
                        <a
                            key={item}
                            href={`#${item.toLowerCase()}`}
                            className={`relative text-xs font-body font-normal tracking-[0.2em] uppercase transition-colors duration-300 hover:text-accent-violet ${isDark && !isMobileMenuOpen ? 'text-paper' : 'text-ink'
                                }`}
                        >
                            {item}
                        </a>
                    ))}
                </div>

                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-8">
                    <button
                        onClick={handleLoginClick}
                        className={`font-accent text-xs font-semibold tracking-[0.15em] uppercase transition-colors duration-300 px-4 py-2 ${isDark
                            ? 'text-paper hover:text-neutral-300'
                            : 'text-ink hover:text-accent-violet'
                            }`}
                    >
                        Login
                    </button>
                    <a
                        href="#cta"
                        className={`font-accent text-xs font-semibold tracking-[0.15em] uppercase px-8 py-4 rounded-sm transition-all duration-300 hover:-translate-y-0.5 ${isDark
                            ? 'text-ink bg-paper hover:bg-neutral-200'
                            : 'text-paper bg-ink hover:bg-accent-violet'
                            }`}
                    >
                        Begin
                    </a>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className={`md:hidden relative z-[1002] p-2 focus:outline-none transition-colors duration-300 ${isDark && !isMobileMenuOpen ? 'text-paper' : 'text-ink'}`}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <div className="w-6 h-5 flex flex-col justify-between">
                        <span className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                        <span className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                        <span className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
                    </div>
                </button>
            </div>

            {/* Mobile Menu Content */}
            <div className={`absolute inset-0 top-[80px] bg-white flex flex-col items-center justify-start pt-12 gap-8 transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                {['FEATURES', 'TRUST', 'LIFECYCLE', 'AUDIENCE'].map((item) => (
                    <a
                        key={item}
                        href={`#${item.toLowerCase()}`}
                        className="font-display text-2xl text-ink font-bold hover:text-accent-violet"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        {item}
                    </a>
                ))}
                <div className="flex flex-col items-center gap-6 mt-8">
                    <button
                        onClick={handleLoginClick}
                        className="font-accent text-sm font-semibold tracking-[0.15em] uppercase text-ink hover:text-accent-violet"
                    >
                        Login
                    </button>
                    <a
                        href="#cta"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="font-accent text-sm font-semibold tracking-[0.15em] uppercase px-8 py-4 bg-ink text-paper rounded-sm"
                    >
                        Begin
                    </a>
                </div>
            </div>
        </nav>
    )
}
