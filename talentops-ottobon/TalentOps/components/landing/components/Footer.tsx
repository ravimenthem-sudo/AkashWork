import React from 'react'

export function Footer() {
    return (
        <footer className="bg-ink text-paper py-6 px-8 md:px-16 border-t border-graphite/20">
            <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
                <div className="col-span-1 md:col-span-1">
                    <span className="font-display text-2xl font-bold text-gradient-violet mb-2 block">
                        T
                    </span>
                    <span className="font-accent text-xs font-bold tracking-[0.2em] uppercase text-paper block mb-4">
                        TALENT OPS
                    </span>
                    <p className="font-elegant text-mist text-lg italic leading-relaxed opacity-80">
                        Architecture of human potential.
                    </p>
                </div>

                <div>
                    <h5 className="font-accent text-xs font-bold tracking-[0.2em] uppercase text-graphite-light mb-4">
                        Product
                    </h5>
                    <ul className="flex flex-row flex-wrap gap-4 font-body text-sm text-mist/60">
                        <li><a href="#alignment" className="hover:text-accent-violet transition-colors">Alignment</a></li>
                        <li><a href="#performance" className="hover:text-accent-violet transition-colors">Performance</a></li>
                        <li><a href="#growth" className="hover:text-accent-violet transition-colors">Growth</a></li>
                        <li><a href="#people" className="hover:text-accent-violet transition-colors">People</a></li>
                    </ul>
                </div>

                <div>
                    <h5 className="font-accent text-xs font-bold tracking-[0.2em] uppercase text-graphite-light mb-4">
                        Connect
                    </h5>
                    <ul className="flex flex-row flex-wrap gap-4 font-body text-sm text-mist/60">
                        <li><a href="#" className="hover:text-accent-violet transition-colors">LinkedIn</a></li>
                        <li><a href="#" className="hover:text-accent-violet transition-colors">Twitter</a></li>
                        <li><a href="#" className="hover:text-accent-violet transition-colors">Instagram</a></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-graphite/30 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-accent text-graphite-light tracking-wider uppercase">
                <span>&copy; 2025 Talent Ops Platform. All rights reserved.</span>
                <div className="flex gap-8">
                    <a href="#" className="hover:text-mist transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-mist transition-colors">Terms of Service</a>
                </div>
            </div>
        </footer>
    )
}
