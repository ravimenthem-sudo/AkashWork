import React, { useState, useEffect } from 'react';
import {
    X,
    Mail,
    Phone,
    Briefcase,
    MapPin,
    Calendar,
    Clock,
    FileText,
    Link as LinkIcon,
    DollarSign,
    User,
    Award
} from 'lucide-react';
import { useATSData } from '../../../../context/ATSDataContext';
import { getInitials } from '../../../../utils/atsHelpers';
import ResumeCard from './ResumeCard';
import { PIPELINE_STAGES } from '../../../../utils/atsConstants';

const CandidateProfile = ({ candidateId, onClose }) => {
    const { getCandidateById, jobs, updateCandidate, moveCandidateToStage } = useATSData();
    const [candidate, setCandidate] = useState(null);
    const [job, setJob] = useState(null);

    useEffect(() => {
        if (candidateId) {
            const data = getCandidateById(candidateId);
            setCandidate(data);
            if (data?.jobId) {
                const jobData = jobs.find(j => j.id === data.jobId);
                setJob(jobData);
            }
        }
    }, [candidateId, getCandidateById, jobs]);

    if (!candidate) return null;

    const currentStage = PIPELINE_STAGES.find(s => s.id === candidate.stage);

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[var(--surface)] shadow-2xl h-full flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)] bg-[var(--bg-surface)]">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-md border-4 border-[var(--surface)]"
                            style={{
                                background: `linear-gradient(135deg, ${currentStage?.color || '#8b5cf6'}, ${currentStage?.color || '#8b5cf6'}88)`
                            }}
                        >
                            {getInitials(candidate.name)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{candidate.name}</h2>
                            <p className="text-[var(--text-secondary)]">{candidate.jobTitle || 'No current role'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">

                        {/* Quick Actions / Status */}
                        <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-[var(--text-secondary)]">Current Stage:</span>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] rounded-lg shadow-sm">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: currentStage?.color }}
                                    />
                                    <span className="font-semibold text-[var(--text-primary)]">{currentStage?.name}</span>
                                </div>
                            </div>

                            <select
                                className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border-primary)] rounded-lg text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                value={candidate.stage}
                                onChange={(e) => moveCandidateToStage(candidate.id, e.target.value)}
                            >
                                {PIPELINE_STAGES.map(stage => (
                                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Contact & Info */}
                            <div className="space-y-4">
                                <h3 className="section-title">Contact Information</h3>
                                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-primary)] p-4 space-y-3">
                                    <a href={`mailto:${candidate.email}`} className="flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                                        <Mail size={18} />
                                        <span className="text-sm">{candidate.email}</span>
                                    </a>
                                    <a href={`tel:${candidate.phone}`} className="flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                                        <Phone size={18} />
                                        <span className="text-sm">{candidate.phone || 'N/A'}</span>
                                    </a>
                                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                                        <MapPin size={18} />
                                        <span className="text-sm">{candidate.location || 'Location not specified'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                                        <Briefcase size={18} />
                                        <span className="text-sm">{candidate.experience || 'Experience not specified'}</span>
                                    </div>
                                    {candidate.portfolio && (
                                        <a href={candidate.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                                            <LinkIcon size={18} />
                                            <span className="text-sm">Portfolio / Website</span>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Job Application Details */}
                            <div className="space-y-4">
                                <h3 className="section-title">Application Details</h3>
                                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-primary)] p-4 space-y-3">
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-[var(--text-secondary)] shrink-0">Applied For</span>
                                        <span className="text-sm font-medium text-[var(--text-primary)] text-right">{job?.title || 'General Application'}</span>
                                    </div>
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-[var(--text-secondary)] shrink-0">Date Applied</span>
                                        <span className="text-sm font-medium text-[var(--text-primary)] text-right">
                                            {new Date(candidate.appliedAt || candidate.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-[var(--text-secondary)] shrink-0">Source</span>
                                        <span className="text-sm font-medium text-[var(--text-primary)] text-right">{candidate.source || 'Direct'}</span>
                                    </div>
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-[var(--text-secondary)] shrink-0">Expected Salary</span>
                                        <span className="text-sm font-medium text-[var(--text-primary)] text-right">{candidate.expectedSalary || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resume Section */}
                        <div className="space-y-4">
                            <h3 className="section-title">Resume & Documents</h3>
                            <ResumeCard candidate={candidate} />
                        </div>

                        {/* Skills */}
                        {candidate.skills && candidate.skills.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="section-title">Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {candidate.skills.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-full text-sm font-medium border border-[var(--border-primary)]"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes / About */}
                        {candidate.notes && (
                            <div className="space-y-4">
                                <h3 className="section-title">Notes</h3>
                                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-primary)] text-sm text-[var(--text-secondary)] leading-relaxed">
                                    {candidate.notes}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <style>{`
                .section-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-secondary);
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default CandidateProfile;
