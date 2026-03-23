import React from 'react';
import { StylesInjection } from '../landing/styles/StylesInjection';
import { Navigation } from '../landing/components/Navigation';
import { Footer } from '../landing/components/Footer';
import { ScrollToTop } from '../landing/components/ScrollToTop';
import { SmoothScroll } from '../landing/components/SmoothScroll';
import { ClickSpark } from '../landing/components/ClickSpark';
import { CursorGlow } from '../landing/components/CursorGlow';

// Sections
import { HeroSection } from '../landing/sections/HeroSection';
import { ProblemSection } from '../landing/sections/ProblemSection';
import { WhyNowSection } from '../landing/sections/WhyNowSection';
import { NewAgeTalentSection } from '../landing/sections/NewAgeTalentSection';
import { OfferSection } from '../landing/sections/OfferSection';
import { FixedTaskLifecycle } from '../landing/sections/FixedTaskLifecycle';
import { AiIntelligenceSection } from '../landing/sections/AiIntelligenceSection';
import { AiThinkingSection } from '../landing/sections/AiThinkingSection';
import { ProductivitySection } from '../landing/sections/ProductivitySection';
import { TransparencySection } from '../landing/sections/TransparencySection';
import { UseCasesSection } from '../landing/sections/UseCasesSection';
import { TargetAudienceSection } from '../landing/sections/TargetAudienceSection';
import { BuiltForIndiaSection } from '../landing/sections/BuiltForIndiaSection';
import { CorePhilosophy } from '../landing/sections/CorePhilosophy';
import { PhilosophyReinforcement } from '../landing/sections/PhilosophyReinforcement';
import { LearningLoopSection } from '../landing/sections/LearningLoopSection';
import { CTASection } from '../landing/sections/CTASection';

export function LandingPage() {
    return (
        <SmoothScroll>
            {/* Inject global styles and fonts required for the landing page */}
            <StylesInjection />

            <ClickSpark>
                <div className="relative w-full bg-paper text-ink selection:bg-accent-violet selection:text-white font-body">
                    <Navigation />

                    <main>
                        <HeroSection />

                        {/* Features ID used in OfferSection */}
                        <OfferSection />

                        <ProblemSection />

                        <NewAgeTalentSection />

                        <BuiltForIndiaSection />
                        <AiThinkingSection />
                        <ProductivitySection />
                        <LearningLoopSection />
                        <WhyNowSection />
                        <UseCasesSection />
                        <PhilosophyReinforcement />
                        <CorePhilosophy />

                        {/* Lifecycle ID used in FixedTaskLifecycle */}
                        <FixedTaskLifecycle />

                        <AiIntelligenceSection />

                        {/* Audience ID used in TargetAudienceSection */}
                        <TargetAudienceSection />

                        {/* Trust ID used in TransparencySection */}
                        <TransparencySection />

                        <CTASection />
                    </main>

                    <Footer />

                    <ScrollToTop />
                    <CursorGlow />
                </div>
            </ClickSpark>
        </SmoothScroll>
    );
}
