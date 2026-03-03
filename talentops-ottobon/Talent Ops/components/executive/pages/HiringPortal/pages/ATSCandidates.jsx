import React, { useState } from 'react';
import { Edit, Plus, Eye } from 'lucide-react'; // Added Eye icon
import { useATSData } from '../../../context/ATSDataContext';
import DataTable from '../../../components/UI/DataTable';
import Modal from '../../../components/UI/Modal';
import { useToast } from '../../../context/ToastContext';
import { PIPELINE_STAGES } from '../../../utils/atsConstants';
import { getInitials } from '../../../utils/atsHelpers';
import CandidateProfile from '../components/Candidates/CandidateProfile'; // Import CandidateProfile

const ATSCandidates = () => {
    const { candidates, createCandidate, updateCandidate, jobs, loading } = useATSData();
    const { addToast } = useToast();

    const [showModal, setShowModal] = useState(false);
    const [editingCandidate, setEditingCandidate] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null); // State for viewing profile

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        jobId: '',
        stage: 'applied',
        score: 0,
        source: 'LinkedIn',
        experience: '',
        notes: ''
    });

    // Reset Form
    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            jobId: '',
            stage: 'applied',
            score: 0,
            source: 'LinkedIn',
            experience: '',
            notes: ''
        });
        setEditingCandidate(null);
    };

    // Handle Edit Click
    const handleEdit = (candidate) => {
        setEditingCandidate(candidate);
        setFormData({
            name: candidate.name || '',
            email: candidate.email || '',
            phone: candidate.phone || '',
            jobId: candidate.jobId || '',
            stage: candidate.stage || 'applied',
            score: candidate.score || 0,
            source: candidate.source || 'LinkedIn',
            experience: candidate.experience || '',
            notes: candidate.notes || ''
        });
        setShowModal(true);
    };

    // Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Find job title for denormalization if needed
            const job = jobs.find(j => j.id === formData.jobId);
            const dataToSave = {
                ...formData,
                jobTitle: job ? job.title : 'Unknown'
            };

            if (editingCandidate) {
                await updateCandidate(editingCandidate.id, dataToSave);
                addToast('Candidate updated successfully', 'success');
            } else {
                await createCandidate(dataToSave);
                addToast('Candidate added successfully', 'success');
            }
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error('Error saving candidate:', error);
            addToast('Failed to save candidate', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Columns Configuration
    const columns = [
        {
            header: 'Candidate',
            accessor: 'name',
            render: (row) => {
                const stage = PIPELINE_STAGES.find(s => s.id === row.stage);
                return (
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                            style={{
                                background: `linear-gradient(135deg, ${stage?.color || '#8b5cf6'}, ${stage?.color || '#8b5cf6'}88)`
                            }}
                        >
                            {getInitials(row.name)}
                        </div>
                        <div>
                            <p className="font-medium text-[var(--text-primary)]">{row.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{row.email}</p>
                        </div>
                    </div>
                );
            }
        },
        { header: 'Applied For', accessor: 'jobTitle' },
        {
            header: 'Stage',
            accessor: 'stage',
            render: (row) => {
                const stage = PIPELINE_STAGES.find(s => s.id === row.stage);
                return (
                    <span
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                            backgroundColor: `${stage?.color || '#8b5cf6'}20`,
                            color: stage?.color || '#8b5cf6'
                        }}
                    >
                        {stage?.name || row.stage}
                    </span>
                );
            }
        },
        {
            header: 'Score',
            accessor: 'score',
            render: (row) => {
                const score = row.score || 0;
                let color = 'var(--text-secondary)';
                if (score >= 80) color = 'var(--success)';
                else if (score >= 50) color = 'var(--warning)';
                else if (score > 0) color = 'var(--error)';

                return (
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
                            />
                        </div>
                        <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
                    </div>
                );
            }
        },
        { header: 'Source', accessor: 'source' },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedCandidate(row.id)}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        title="View Profile"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleEdit(row)}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        title="Edit Candidate"
                    >
                        <Edit size={16} />
                    </button>
                </div>
            )
        }
    ];

    if (loading) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading Hiring Portal...</div>;

    return (
        <div className="animate-fade-in relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Candidates</h1>
                    <p className="text-[var(--text-secondary)]">Manage your pipeline and applicants</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                    <Plus size={18} /> Add Candidate
                </button>
            </div>

            <DataTable
                title="Candidate List"
                columns={columns}
                data={candidates || []}
                onAction={(action) => console.log(action)}
            />

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingCandidate ? "Edit Candidate" : "Add Candidate"}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Full Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Email</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Job Position</label>
                            <select
                                required
                                value={formData.jobId}
                                onChange={e => setFormData({ ...formData, jobId: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            >
                                <option value="">Select Job...</option>
                                {jobs.map(job => (
                                    <option key={job.id} value={job.id}>{job.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Stage</label>
                            <select
                                value={formData.stage}
                                onChange={e => setFormData({ ...formData, stage: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            >
                                {PIPELINE_STAGES.map(stage => (
                                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Source</label>
                            <select
                                value={formData.source}
                                onChange={e => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            >
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="Referral">Referral</option>
                                <option value="Website">Website</option>
                                <option value="Agency">Agency</option>
                                <option value="Indeed">Indeed</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Test Score (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.score}
                                onChange={e => setFormData({ ...formData, score: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Experience</label>
                            <input
                                type="text"
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="e.g. 5 years"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] min-h-[100px]"
                            placeholder="Additional candidate notes..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : (editingCandidate ? 'Update Candidate' : 'Add Candidate')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Candidate Profile View */}
            {selectedCandidate && (
                <CandidateProfile
                    candidateId={selectedCandidate}
                    onClose={() => setSelectedCandidate(null)}
                />
            )}
        </div>
    );
};

export default ATSCandidates;
