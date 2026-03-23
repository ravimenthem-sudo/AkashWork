import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useATSData } from '../../../context/ATSDataContext';
import { useUser } from '../../../context/UserContext';
import { useToast } from '../../../context/ToastContext';
import { PIPELINE_STAGES } from '../../../utils/atsConstants';
import { getInitials } from '../../../utils/atsHelpers';
// import { Link } from 'react-router-dom';
import {
    Filter,
    Users,
    ChevronRight,
    Mail,
    Phone,
    Briefcase
} from 'lucide-react';

import CandidateProfile from '../components/Candidates/CandidateProfile';

const ATSPipeline = () => {
    const { candidates, jobs, moveCandidateToStage } = useATSData();
    const { userRole } = useUser();
    const { addToast } = useToast();
    const [jobFilter, setJobFilter] = useState('all');
    const [selectedCandidateId, setSelectedCandidateId] = useState(null);

    const canManageCandidates = ['admin', 'recruiter', 'User'].includes(userRole) || true;

    const filteredCandidates = candidates.filter(c =>
        jobFilter === 'all' || c.jobId === jobFilter
    );

    // Group candidates by stage
    const candidatesByStage = PIPELINE_STAGES.reduce((acc, stage) => {
        acc[stage.id] = filteredCandidates.filter(c => c.stage === stage.id);
        return acc;
    }, {});

    const handleDragEnd = async (result) => {
        if (!result.destination || !canManageCandidates) return;

        const { draggableId, destination } = result;
        const newStage = destination.droppableId;

        // Optimistic update locally could be added here if needed, 
        // but for now we rely on the context update
        if (result.source.droppableId === newStage) return;

        try {
            await moveCandidateToStage(draggableId, newStage);
            const stageName = PIPELINE_STAGES.find(s => s.id === newStage)?.name;
            addToast(`Candidate moved to ${stageName}`, 'success');
        } catch (err) {
            addToast('Failed to move candidate', 'error');
        }
    };

    return (
        <div className="animate-fade-in h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Candidate Pipeline</h1>
                    <p className="text-[var(--text-secondary)]">Track candidates across recruitment stages</p>
                </div>
                <div className="flex items-center gap-3 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-primary)]">
                    <Filter size={16} className="text-[var(--text-secondary)] ml-2" />
                    <select
                        className="bg-transparent text-sm text-[var(--text-primary)] focus:outline-none py-1 pr-2"
                        value={jobFilter}
                        onChange={(e) => setJobFilter(e.target.value)}
                    >
                        <option value="all">All Jobs ({filteredCandidates.length})</option>
                        {jobs.filter(j => j.status === 'published').map(job => (
                            <option key={job.id} value={job.id}>{job.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex gap-4 pb-4 h-full min-w-max">
                        {PIPELINE_STAGES.map(stage => {
                            const stageCandidates = candidatesByStage[stage.id] || [];
                            return (
                                <div key={stage.id} className="flex-shrink-0 w-80 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] flex flex-col max-h-[calc(100vh-250px)]">
                                    <div className="p-3 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-tertiary)]/50 rounded-t-xl">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: stage.color || '#8b5cf6' }}
                                            />
                                            <span className="font-semibold text-[var(--text-primary)] text-sm">{stage.name}</span>
                                        </div>
                                        <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded-full text-xs font-medium text-[var(--text-secondary)]">
                                            {stageCandidates.length}
                                        </span>
                                    </div>

                                    <Droppable droppableId={stage.id} isDropDisabled={!canManageCandidates}>
                                        {(provided, snapshot) => (
                                            <div
                                                className={`flex-1 p-2 overflow-y-auto transition-colors custom-scrollbar ${snapshot.isDraggingOver ? 'bg-[var(--accent)]/5' : ''}`}
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                            >
                                                {stageCandidates.map((candidate, index) => (
                                                    <Draggable
                                                        key={candidate.id}
                                                        draggableId={candidate.id}
                                                        index={index}
                                                        isDragDisabled={!canManageCandidates}
                                                    >
                                                        {(provided, snapshot) => (
                                                            <div
                                                                className={`bg-[var(--surface)] p-3 rounded-lg border border-[var(--border-primary)] mb-3 shadow-sm hover:shadow-md transition-all group cursor-pointer ${snapshot.isDragging ? 'rotate-2 shadow-lg ring-2 ring-[var(--accent)] z-50' : ''}`}
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{
                                                                    ...provided.draggableProps.style
                                                                }}
                                                                onClick={() => setSelectedCandidateId(candidate.id)}
                                                            >
                                                                <div className="flex items-start gap-3 mb-3">
                                                                    <div
                                                                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                                                        style={{
                                                                            background: `linear-gradient(135deg, ${stage.color || '#8b5cf6'}, ${stage.color || '#8b5cf6'}88)`
                                                                        }}
                                                                    >
                                                                        {getInitials(candidate.name)}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">{candidate.name}</h4>
                                                                        <p className="text-xs text-[var(--text-secondary)] truncate">{candidate.jobTitle}</p>
                                                                    </div>
                                                                </div>

                                                                {candidate.skills && candidate.skills.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                                        {candidate.skills.slice(0, 3).map((skill, i) => (
                                                                            <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded border border-[var(--border-secondary)] text-[10px] text-[var(--text-secondary)] truncate max-w-[80px]">
                                                                                {skill}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-secondary)]">
                                                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                                        <a
                                                                            href={`mailto:${candidate.email}`}
                                                                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                                                                            title={candidate.email}
                                                                        >
                                                                            <Mail size={12} />
                                                                        </a>
                                                                        {candidate.phone && (
                                                                            <a
                                                                                href={`tel:${candidate.phone}`}
                                                                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                                                                                title={candidate.phone}
                                                                            >
                                                                                <Phone size={12} />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-0.5 text-xs text-[var(--accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        View <ChevronRight size={12} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}

                                                {(!stageCandidates || stageCandidates.length === 0) && (
                                                    <div className="flex flex-col items-center justify-center py-8 text-[var(--text-secondary)] opacity-50">
                                                        <Users size={20} className="mb-1" />
                                                        <span className="text-xs">No candidates</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            </div>

            {selectedCandidateId && (
                <CandidateProfile
                    candidateId={selectedCandidateId}
                    onClose={() => setSelectedCandidateId(null)}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--border-primary);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--text-secondary);
                }
                
                /* Apply to the horizontal container as well */
                .overflow-x-auto::-webkit-scrollbar {
                    height: 8px;
                }
                .overflow-x-auto::-webkit-scrollbar-track {
                    background: transparent;
                }
                .overflow-x-auto::-webkit-scrollbar-thumb {
                    background: var(--border-primary);
                    border-radius: 4px;
                }
                .overflow-x-auto::-webkit-scrollbar-thumb:hover {
                    background: var(--text-secondary);
                }
            `}</style>
        </div>
    );
};

export default ATSPipeline;
