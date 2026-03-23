import { useEffect } from 'react'

const STYLES = `
/* --- GLOBAL CSS POLYFILL --- */
:root {
  --font-playfair: 'Playfair Display', Georgia, serif;
  --font-cormorant: 'Cormorant Garamond', Garamond, serif;
  --font-inter: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-space: 'Space Grotesk', sans-serif;

  /* Theme Variables */
  --color-ink: #0A0A0B;
  --color-ink-soft: #1A1A1C;
  --color-paper: #FFFFFF;
  --color-paper-warm: #FFFFFF;
  --color-graphite: #2D2D2F;
  --color-graphite-light: #4A4A4D;
  --color-mist: #E8E6E3;
  --color-accent-violet: #7C3AED;
  --color-accent-violet-deep: #5B21B6;
  --color-accent-coral: #F97066;
  --color-accent-coral-soft: #FEB8B3;
  --color-accent-gold: #D4AF37;
  --color-accent-gold-soft: #E8D48A;
  --color-accent-cyan: #06B6D4;
  --color-accent-indigo: #4F46E5;
}

/* Tailwind Theme Polyfills - Ensuring portability without config */
.font-display { font-family: var(--font-playfair); }
.font-elegant { font-family: var(--font-cormorant); }
.font-body { font-family: var(--font-inter); }
.font-accent { font-family: var(--font-space); }

.bg-ink { background-color: var(--color-ink); }
.bg-ink-soft { background-color: var(--color-ink-soft); }
.bg-paper { background-color: var(--color-paper); }
.bg-paper-warm { background-color: var(--color-paper-warm); }
.bg-accent-violet { background-color: var(--color-accent-violet); }
.bg-accent-indigo { background-color: var(--color-accent-indigo); }
.bg-accent-cyan { background-color: var(--color-accent-cyan); }
.bg-accent-gold { background-color: var(--color-accent-gold); }

.text-ink { color: var(--color-ink); }
.text-paper { color: var(--color-paper); }
.text-mist { color: var(--color-mist); }
.text-graphite { color: var(--color-graphite); }
.text-graphite-light { color: var(--color-graphite-light); }
.text-accent-violet { color: var(--color-accent-violet); }
.text-accent-indigo { color: var(--color-accent-indigo); }
.text-accent-cyan { color: var(--color-accent-cyan); }
.text-accent-gold { color: var(--color-accent-gold); }

.border-graphite\\/20 { border-color: rgba(45, 45, 47, 0.2); }
.border-graphite\\/10 { border-color: rgba(45, 45, 47, 0.1); }
.border-white\\/20 { border-color: rgba(255, 255, 255, 0.2); }

/* Global Utilities */
.text-gradient-violet {
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.text-gradient-warm {
    background: linear-gradient(135deg, #F97066 0%, #D4AF37 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
.lenis.lenis-stopped { overflow: hidden; }
.lenis.lenis-scrolling iframe { pointer-events: none; }

body { background-color: var(--color-paper); color: var(--color-ink); overflow-x: hidden; width: 100%; }

/* Navigation.css */
.nav-link {
    position: relative;
    display: block;
    text-transform: uppercase;
    padding: 8px 16px;
    text-decoration: none;
    color: var(--nav-text, #262626);
    font-family: var(--font-body, sans-serif);
    font-size: 12px;
    font-weight: 400;
    transition: .5s;
    z-index: 1;
    letter-spacing: 0.2em;
}
.nav-link:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-top: 2px solid var(--nav-text, #262626);
    border-bottom: 2px solid var(--nav-text, #262626);
    transform: scaleY(2);
    opacity: 0;
    transition: .3s;
    pointer-events: none;
}
.nav-link:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--nav-text, #262626);
    transform: scale(0);
    opacity: 0;
    transition: .3s;
    z-index: -1;
    pointer-events: none;
}
.nav-link:hover {
    color: var(--nav-hover-text, #fff);
}
.nav-link:hover:before {
    transform: scaleY(1);
    opacity: 1;
}
.nav-link:hover:after {
    transform: scale(1);
    opacity: 1;
}
.nav-dark .nav-link {
    --nav-text: #F8F7F4;
    --nav-hover-text: #0A0A0B;
}

/* GoldCard.css */
.gold-card-wrapper { perspective: 1000px; }
.gold-card {
    width: 100%; height: 200px; background: #0A0A0B; position: relative;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    border-radius: 10px; overflow: hidden; transition: all 0.5s ease-in-out;
    cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.05);
}
.gold-border {
    position: absolute; inset: 0px; border: 2px solid #bd9f67; opacity: 0;
    transform: rotate(10deg); transition: all 0.5s ease-in-out; pointer-events: none;
}
.gold-bottom-text {
    position: absolute; left: 50%; bottom: 13px; transform: translateX(-50%);
    font-family: var(--font-accent, sans-serif); font-size: 10px; text-transform: uppercase;
    padding: 0px 5px 0px 8px; color: #bd9f67; background: #0A0A0B; opacity: 0;
    letter-spacing: 7px; transition: all 0.5s ease-in-out; white-space: nowrap;
}
.gold-content {
    transition: all 0.5s ease-in-out; display: flex; flex-direction: column;
    align-items: center; justify-content: center; width: 100%; height: 100%;
}
.gold-logo {
    height: 50px; position: relative; width: 50px; display: flex;
    align-items: center; justify-content: center; overflow: hidden; transition: all 1s ease-in-out;
}
.gold-number {
    font-family: var(--font-display, serif); font-size: 40px; color: #bd9f67;
    font-weight: bold; position: absolute; transition: all 0.5s;
}
.gold-trail { position: absolute; right: 0; height: 100%; width: 100%; opacity: 0; }
.gold-logo-text {
    position: absolute; left: 50%; top: 60%; transform: translate(-50%, -50%);
    margin-top: 20px; color: #bd9f67; font-family: var(--font-display, serif);
    font-size: 18px; opacity: 0; letter-spacing: 0px; transition: all 0.5s ease-in-out 0.2s;
    white-space: nowrap; width: 100%; text-align: center;
}
.gold-card:hover {
    border-radius: 0; transform: scale(1.05); border-color: transparent;
}
.gold-card:hover .gold-logo {
    width: 100%; margin-bottom: 20px; align-items: flex-start; padding-top: 20px;
}
.gold-card:hover .gold-number { transform: translateY(-20px) scale(0.8); opacity: 0; }
.gold-card:hover .gold-border { inset: 15px; opacity: 1; transform: rotate(0); }
.gold-card:hover .gold-bottom-text { letter-spacing: 3px; opacity: 1; transform: translateX(-50%); }
.gold-card:hover .gold-logo-text { opacity: 1; letter-spacing: 1px; margin-top: 0; }
.gold-card:hover .gold-trail { animation: gold-trail 1s ease-in-out; }
@keyframes gold-trail {
    0% { background: linear-gradient(90deg, rgba(189, 159, 103, 0) 90%, rgb(189, 159, 103) 100%); opacity: 0; }
    30% { background: linear-gradient(90deg, rgba(189, 159, 103, 0) 70%, rgb(189, 159, 103) 100%); opacity: 1; }
    70% { background: linear-gradient(90deg, rgba(189, 159, 103, 0) 70%, rgb(189, 159, 103) 100%); opacity: 1; }
    95% { background: linear-gradient(90deg, rgba(189, 159, 103, 0) 90%, rgb(189, 159, 103) 100%); opacity: 0; }
}

/* holographic.css */
.holographic-card {
    --holo-rgb: 124, 58, 237;
    position: relative; overflow: hidden; transition: all 0.5s ease; z-index: 1;
}
.holographic-card::before {
    content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
    background: linear-gradient(0deg, transparent, transparent 30%, rgba(var(--holo-rgb), 0.3));
    transform: rotate(-45deg); transition: all 0.5s ease; opacity: 0; pointer-events: none; z-index: 2;
}
.holographic-card:hover {
    transform: scale(1.05); box-shadow: 0 0 20px rgba(var(--holo-rgb), 0.5);
}
.holographic-card:hover::before {
    opacity: 1; transform: rotate(-45deg) translateY(100%);
}
.holographic-card-red { --holo-rgb: 239, 68, 68; }
.holographic-card-theme { --holo-rgb: 124, 58, 237; }
.holographic-card-green { --holo-rgb: 34, 197, 94; }

/* hover-underline.css */
.hover-underline { color: inherit; position: relative; display: inline-block; }
.hover-underline::after, .hover-underline::before {
    content: ''; position: absolute; width: 100%; height: 2px;
    background: linear-gradient(to right, #4F46E5, #7C3AED, #06B6D4);
    bottom: -5px; left: 0; transform: scaleX(0); transform-origin: right; transition: transform 0.4s ease-out;
}
.hover-underline::before { bottom: auto; top: -5px; transform-origin: left; }
.hover-underline:hover::after, .hover-underline:hover::before { transform: scaleX(1); }
`

export const StylesInjection = () => {
    useEffect(() => {
        // Inject Google Fonts
        const link = document.createElement('link')
        link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        link.rel = "stylesheet"
        document.head.appendChild(link)

        // Inject Styles if not already present
        if (!document.getElementById('talentops-consolidated-styles')) {
            const style = document.createElement('style')
            style.id = 'talentops-consolidated-styles'
            style.innerHTML = STYLES
            document.head.appendChild(style)
        }
    }, [])
    return null
}
