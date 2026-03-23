import React, { useState, useEffect } from 'react'
import { throttle } from '../utils/throttle'

const Wave = () => (
    <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="absolute top-[-95%] left-0 w-[400%] h-full text-accent-indigo opacity-90 fill-current animate-wave"
    >
        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" />
    </svg>
)

export function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)

    useEffect(() => {
        const handleScroll = () => {
            const totalScroll = document.documentElement.scrollTop
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
            const scroll = totalScroll / windowHeight

            setScrollProgress(Math.min(100, Math.max(0, scroll * 100)))

            if (totalScroll > 100) {
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        const throttledScroll = throttle(handleScroll, 100)
        window.addEventListener('scroll', throttledScroll, { passive: true })
        handleScroll() // Initial call
        return () => window.removeEventListener('scroll', throttledScroll as any)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }

    return (
        <>
            <style>{`
                @keyframes wave {
                    0% { transform: translateX(0) translateZ(0) scaleY(1); }
                    50% { transform: translateX(-25%) translateZ(0) scaleY(0.85); }
                    100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
                }
                .animate-wave {
                    animation: wave 5s linear infinite;
                }
                @keyframes wave-back {
                        0% { transform: translateX(0) translateZ(0) scaleY(1); }
                    50% { transform: translateX(-25%) translateZ(0) scaleY(0.85); }
                    100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
                }
                    .animate-wave-back {
                    animation: wave-back 8s linear infinite reverse;
                }
            `}</style>

            <button
                onClick={scrollToTop}
                className={`fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-300 overflow-hidden border-2 border-accent-indigo bg-white group hover:-translate-y-1 hover:shadow-xl ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
                    }`}
                aria-label="Scroll to top"
            >
                {/* Liquid Container */}
                <div
                    className="absolute bottom-0 left-0 w-full z-0 bg-accent-indigo"
                    style={{ height: `${scrollProgress}%`, transition: 'height 0.1s linear' }}
                >
                    <div className="absolute bottom-full translate-y-1 left-0 w-full h-4 overflow-visible">
                        {/* Front Wave */}
                        <svg
                            viewBox="0 0 1200 120"
                            preserveAspectRatio="none"
                            className="absolute bottom-0 left-0 w-[400%] h-full fill-accent-indigo animate-wave origin-bottom"
                        >
                            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" transform="scale(1, -1) translate(0, -100)" />
                        </svg>

                        {/* Back Wave (Parallax) */}
                        <svg
                            viewBox="0 0 1200 120"
                            preserveAspectRatio="none"
                            className="absolute bottom-0 left-0 w-[400%] h-full fill-accent-indigo/50 animate-wave-back origin-bottom z-[-1]"
                        >
                            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" transform="scale(1, -1) translate(0, -100)" />
                        </svg>
                    </div>
                </div>

                {/* Icons */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-accent-indigo transition-opacity duration-300"
                        style={{ opacity: scrollProgress > 45 ? 0 : 1 }}
                    >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white transition-opacity duration-300"
                        style={{ opacity: scrollProgress > 45 ? 1 : 0 }}
                    >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                </div>

            </button>
        </>
    )
}
