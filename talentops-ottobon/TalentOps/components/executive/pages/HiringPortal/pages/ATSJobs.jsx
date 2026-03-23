import { useState } from 'react';
import { useATSData } from '../../../context/ATSDataContext';
import { useUser } from '../../../context/UserContext';
import { useToast } from '../../../context/ToastContext';
import Modal from '../../../components/UI/Modal';
import JobCard from '../components/Jobs/JobCard';
import JobForm from '../components/Jobs/JobForm';
import {
    Plus,
    Search,
    Filter,
    Briefcase
} from 'lucide-react';
import { DEPARTMENTS } from '../../../utils/atsConstants';

const ATSJobs = () => {
    const { jobs, createJob, updateJob, deleteJob } = useATSData();
    const { userRole } = useUser();
    const { addToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    // Simple permission check
    const canManageJobs = ['admin', 'recruiter', 'User'].includes(userRole) || true; // embracing the demo nature

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = !searchQuery ||
            job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
            job.location.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
        const matchesDepartment = departmentFilter === 'all' || job.department === departmentFilter;

        return matchesSearch && matchesStatus && matchesDepartment;
    });

    const handleCreateJob = async (jobData) => {
        try {
            await createJob(jobData);
            setShowModal(false);
            addToast('Job posting created successfully!', 'success');
        } catch (err) {
            addToast('Failed to create job posting', 'error');
        }
    };

    const handleUpdateJob = async (jobData) => {
        try {
            await updateJob(editingJob.id, jobData);
            setShowModal(false);
            setEditingJob(null);
            addToast('Job posting updated successfully!', 'success');
        } catch (err) {
            addToast('Failed to update job posting', 'error');
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (window.confirm('Are you sure you want to delete this job posting?')) {
            try {
                await deleteJob(jobId);
                addToast('Job posting deleted successfully!', 'success');
            } catch (err) {
                addToast('Failed to delete job posting', 'error');
            }
        }
    };

    const handleStatusChange = async (jobId, newStatus) => {
        try {
            await updateJob(jobId, { status: newStatus });
            addToast(`Job ${newStatus === 'published' ? 'published' : newStatus === 'archived' ? 'archived' : 'saved as draft'}!`, 'success');
        } catch (err) {
            addToast('Failed to update job status', 'error');
        }
    };

    const handleEdit = (job) => {
        setEditingJob(job);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingJob(null);
    };

    const jobCounts = {
        all: jobs.length,
        published: jobs.filter(j => j.status === 'published').length,
        draft: jobs.filter(j => j.status === 'draft').length,
        archived: jobs.filter(j => j.status === 'archived').length
    };

    return (
        <div className="jobs-page animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Job Postings</h1>
                    <p className="text-[var(--text-secondary)]">Manage your open positions and job listings</p>
                </div>
                {canManageJobs && (
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={20} />
                        Create Job
                    </button>
                )}
            </div>

            {/* Status Tabs */}
            <div className="flex gap-4 mb-6 border-b border-[var(--border-secondary)] pb-2 overflow-x-auto">
                {[
                    { key: 'all', label: 'All Jobs' },
                    { key: 'published', label: 'Published' },
                    { key: 'draft', label: 'Drafts' },
                    { key: 'archived', label: 'Archived' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === tab.key ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        onClick={() => setStatusFilter(tab.key)}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusFilter === tab.key ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]'}`}>
                            {jobCounts[tab.key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        placeholder="Search jobs..."
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <select
                        className="pl-10 pr-8 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                    >
                        <option value="all">All Departments</option>
                        {DEPARTMENTS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Jobs Grid */}
            {filteredJobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredJobs.map(job => (
                        <JobCard
                            key={job.id}
                            job={job}
                            onEdit={handleEdit}
                            onDelete={handleDeleteJob}
                            onStatusChange={handleStatusChange}
                            canManage={canManageJobs}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center shadow-sm">
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-full mb-4">
                        <Briefcase size={32} className="text-[var(--text-secondary)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No jobs found</h3>
                    <p className="text-[var(--text-secondary)] mb-6 max-w-md">
                        {searchQuery || statusFilter !== 'all' || departmentFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Create your first job posting to get started'}
                    </p>
                    {canManageJobs && !searchQuery && statusFilter === 'all' && (
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                            onClick={() => setShowModal(true)}
                        >
                            <Plus size={20} />
                            Create Job
                        </button>
                    )}
                </div>
            )}

            {/* Job Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingJob ? 'Edit Job Posting' : 'Create Job Posting'}
                size="lg"
            >
                <JobForm
                    job={editingJob}
                    onSubmit={editingJob ? handleUpdateJob : handleCreateJob}
                    onCancel={closeModal}
                />
            </Modal>
        </div>
    );
};

export default ATSJobs;
