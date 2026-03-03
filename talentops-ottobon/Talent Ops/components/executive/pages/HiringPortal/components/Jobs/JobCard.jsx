import {
    MapPin,
    Clock,
    Users,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Archive,
    Send
} from 'lucide-react';
import { useState } from 'react';
import { formatDate, getRelativeTime } from '../../../../utils/atsHelpers';
import { EXPERIENCE_LEVELS } from '../../../../utils/atsConstants';

const JobCard = ({ job, onEdit, onDelete, onStatusChange, canManage }) => {
    const [showMenu, setShowMenu] = useState(false);

    const getStatusBadge = (status) => {
        const badges = {
            published: { label: 'Published', class: 'badge-success' },
            draft: { label: 'Draft', class: 'badge-warning' },
            archived: { label: 'Archived', class: 'badge-error' }
        };
        return badges[status] || badges.draft;
    };

    const experienceLabel = EXPERIENCE_LEVELS.find(e => e.id === job.experience)?.name || job.experience;
    const statusBadge = getStatusBadge(job.status);

    return (
        <div className="job-card glass-card">
            <div className="job-card-header">
                <span className={`badge ${statusBadge.class}`}>
                    {statusBadge.label}
                </span>
                {canManage && (
                    <div className="dropdown">
                        <button
                            className="btn-icon btn-ghost"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <MoreVertical size={18} />
                        </button>
                        {showMenu && (
                            <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={() => { onEdit(job); setShowMenu(false); }}>
                                    <Edit size={16} />
                                    <span>Edit</span>
                                </button>
                                {job.status === 'draft' && (
                                    <button
                                        className="dropdown-item"
                                        onClick={() => { onStatusChange(job.id, 'published'); setShowMenu(false); }}
                                    >
                                        <Send size={16} />
                                        <span>Publish</span>
                                    </button>
                                )}
                                {job.status === 'published' && (
                                    <button
                                        className="dropdown-item"
                                        onClick={() => { onStatusChange(job.id, 'archived'); setShowMenu(false); }}
                                    >
                                        <Archive size={16} />
                                        <span>Archive</span>
                                    </button>
                                )}
                                {job.status === 'archived' && (
                                    <button
                                        className="dropdown-item"
                                        onClick={() => { onStatusChange(job.id, 'draft'); setShowMenu(false); }}
                                    >
                                        <Eye size={16} />
                                        <span>Reopen as Draft</span>
                                    </button>
                                )}
                                <div className="dropdown-divider" />
                                <button
                                    className="dropdown-item danger"
                                    onClick={() => { onDelete(job.id); setShowMenu(false); }}
                                >
                                    <Trash2 size={16} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="job-card-body">
                <h3 className="job-title">{job.title}</h3>
                <p className="job-department">{job.department}</p>

                <div className="job-meta">
                    <div className="meta-item">
                        <MapPin size={14} />
                        <span>{job.location}</span>
                    </div>
                    <div className="meta-item">
                        <Clock size={14} />
                        <span>{experienceLabel}</span>
                    </div>
                </div>

                {job.skills && job.skills.length > 0 && (
                    <div className="job-skills">
                        {job.skills.slice(0, 4).map((skill, index) => (
                            <span key={index} className="skill-tag">{skill}</span>
                        ))}
                        {job.skills.length > 4 && (
                            <span className="skill-tag more">+{job.skills.length - 4}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="job-card-footer">
                <div className="applicants">
                    <Users size={16} />
                    <span>{job.applicants || 0} applicants</span>
                </div>
                <span className="posted-time">{getRelativeTime(job.createdAt)}</span>
            </div>

            <style>{`
        .job-card {
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .job-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .job-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }

        .job-card-body {
          flex: 1;
        }

        .job-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: var(--spacing-xs);
          line-height: 1.3;
        }

        .job-department {
          font-size: 0.9375rem;
          color: var(--accent-secondary);
          margin-bottom: var(--spacing-md);
        }

        .job-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .job-skills {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
          margin-top: var(--spacing-md);
        }

        .skill-tag {
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .skill-tag.more {
          background: var(--accent-glow);
          color: var(--accent-tertiary);
        }

        .job-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-secondary);
        }

        .applicants {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .posted-time {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .dropdown {
          position: relative;
        }
        
        .dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--bg-secondary);
            border: 1px solid var(--border-primary);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-xl);
            padding: 8px;
            z-index: 50;
            min-width: 160px;
        }
        
        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 8px 12px;
            text-align: left;
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            color: var(--text-primary);
            transition: background var(--transition-fast);
        }
        
        .dropdown-item:hover {
            background: var(--bg-tertiary);
        }
        
        .dropdown-divider {
            height: 1px;
            background: var(--border-secondary);
            margin: 4px 0;
        }

        .danger {
          color: var(--status-error) !important;
        }
      `}</style>
        </div>
    );
};

export default JobCard;
