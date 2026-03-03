import React, { useState } from 'react';
import ATSDashboard from './pages/ATSDashboard';
import ATSJobs from './pages/ATSJobs';
import ATSCandidates from './pages/ATSCandidates';
import ATSPipeline from './pages/ATSPipeline';
import { LayoutDashboard, Briefcase, Users, Kanban } from 'lucide-react';

const HiringPortal = () => {
    const [activeTab, setActiveTab] = useState('overview');

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <ATSDashboard onNavigate={setActiveTab} />;
            case 'jobs': return <ATSJobs />;
            case 'candidates': return <ATSCandidates />;
            case 'pipeline': return <ATSPipeline />;
            default: return <ATSDashboard onNavigate={setActiveTab} />;
        }
    };

    return (
        <div className="h-full flex flex-col animate-fade-in">
            {/* Internal Navigation Bar */}
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-secondary)] overflow-x-auto">
                {[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'jobs', label: 'Jobs', icon: Briefcase },
                    { id: 'candidates', label: 'Candidates', icon: Users },
                    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-[var(--accent)] text-[var(--accent)]'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

export default HiringPortal;
