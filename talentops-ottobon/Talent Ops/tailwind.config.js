/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './components/**/*.{js,ts,jsx,tsx}',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                display: ['var(--font-playfair)'],
                elegant: ['var(--font-cormorant)'],
                body: ['var(--font-inter)'],
                accent: ['var(--font-space)'],
            },
            colors: {
                ink: '#0A0A0B',
                'ink-soft': '#1A1A1C',
                paper: '#F8F7F4',
                'paper-warm': '#FAF8F5',
                graphite: '#2D2D2F',
                'graphite-light': '#4A4A4D',
                mist: '#E8E6E3',
                'accent-violet': '#7C3AED',
                'accent-violet-deep': '#5B21B6',
                'accent-coral': '#F97066',
                'accent-coral-soft': '#FEB8B3',
                'accent-gold': '#D4AF37',
                'accent-gold-soft': '#E8D48A',
                'accent-cyan': '#06B6D4',
                'accent-indigo': '#4F46E5',
            },
        },
    },
    plugins: [],
}
