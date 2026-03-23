import { useState } from 'react';
import { DEPARTMENTS, EXPERIENCE_LEVELS, LOCATIONS, COMMON_SKILLS, JOB_STATUS } from '../../../../utils/atsConstants';
import { X, Plus } from 'lucide-react';

const JobForm = ({ job, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        title: job?.title || '',
        department: job?.department || '',
        location: job?.location || '',
        experience: job?.experience || '',
        skills: job?.skills || [],
        description: job?.description || '',
        status: job?.status || 'draft'
    });

    const [skillInput, setSkillInput] = useState('');
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const addSkill = (skill) => {
        if (skill && !formData.skills.includes(skill)) {
            setFormData(prev => ({
                ...prev,
                skills: [...prev.skills, skill]
            }));
        }
        setSkillInput('');
    };

    const removeSkill = (skillToRemove) => {
        setFormData(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skillToRemove)
        }));
    };

    const handleSkillKeyDown = (e) => {
        if (e.key === 'Enter' && skillInput.trim()) {
            e.preventDefault();
            addSkill(skillInput.trim());
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.title.trim()) newErrors.title = 'Job title is required';
        if (!formData.department) newErrors.department = 'Department is required';
        if (!formData.location) newErrors.location = 'Location is required';
        if (!formData.experience) newErrors.experience = 'Experience level is required';
        if (!formData.description.trim()) newErrors.description = 'Description is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="job-form">
            <div className="form-grid">
                <div className="form-group">
                    <label className="form-label">Job Title *</label>
                    <input
                        type="text"
                        name="title"
                        className={`form-input ${errors.title ? 'error' : ''}`}
                        placeholder="e.g. Senior Frontend Developer"
                        value={formData.title}
                        onChange={handleChange}
                    />
                    {errors.title && <span className="error-text">{errors.title}</span>}
                </div>

                <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select
                        name="department"
                        className={`form-select ${errors.department ? 'error' : ''}`}
                        value={formData.department}
                        onChange={handleChange}
                    >
                        <option value="">Select Department</option>
                        {DEPARTMENTS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                    {errors.department && <span className="error-text">{errors.department}</span>}
                </div>

                <div className="form-group">
                    <label className="form-label">Location *</label>
                    <select
                        name="location"
                        className={`form-select ${errors.location ? 'error' : ''}`}
                        value={formData.location}
                        onChange={handleChange}
                    >
                        <option value="">Select Location</option>
                        {LOCATIONS.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                    {errors.location && <span className="error-text">{errors.location}</span>}
                </div>

                <div className="form-group">
                    <label className="form-label">Experience Level *</label>
                    <select
                        name="experience"
                        className={`form-select ${errors.experience ? 'error' : ''}`}
                        value={formData.experience}
                        onChange={handleChange}
                    >
                        <option value="">Select Experience</option>
                        {EXPERIENCE_LEVELS.map(exp => (
                            <option key={exp.id} value={exp.id}>{exp.name}</option>
                        ))}
                    </select>
                    {errors.experience && <span className="error-text">{errors.experience}</span>}
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Required Skills</label>
                <div className="skills-input-wrapper">
                    <div className="skills-tags">
                        {formData.skills.map((skill, index) => (
                            <span key={index} className="skill-tag">
                                {skill}
                                <button type="button" onClick={() => removeSkill(skill)}>
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            className="skill-input"
                            placeholder="Type and press Enter to add..."
                            value={skillInput}
                            onChange={(e) => setSkillInput(e.target.value)}
                            onKeyDown={handleSkillKeyDown}
                        />
                        {skillInput && (
                            <button
                                type="button"
                                className="add-skill-btn"
                                onClick={() => addSkill(skillInput.trim())}
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="skill-suggestions">
                    {skillInput && !COMMON_SKILLS.some(s => s.toLowerCase() === skillInput.toLowerCase()) && (
                        <button
                            type="button"
                            className="skill-suggestion"
                            style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                            onClick={() => addSkill(skillInput.trim())}
                        >
                            <Plus size={12} /> Add "{skillInput}"
                        </button>
                    )}
                    {COMMON_SKILLS
                        .filter(s => !formData.skills.includes(s))
                        .filter(s => !skillInput || s.toLowerCase().includes(skillInput.toLowerCase()))
                        .slice(0, 8)
                        .map(skill => (
                            <button
                                key={skill}
                                type="button"
                                className="skill-suggestion"
                                onClick={() => addSkill(skill)}
                            >
                                <Plus size={12} /> {skill}
                            </button>
                        ))}
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Job Description *</label>
                <textarea
                    name="description"
                    className={`form-textarea ${errors.description ? 'error' : ''}`}
                    placeholder="Describe the role, responsibilities, and requirements..."
                    rows={6}
                    value={formData.description}
                    onChange={handleChange}
                />
                {errors.description && <span className="error-text">{errors.description}</span>}
            </div>

            <div className="form-group">
                <label className="form-label">Status</label>
                <div className="status-options">
                    {[
                        { value: 'draft', label: 'Save as Draft', desc: 'Not visible to candidates' },
                        { value: 'published', label: 'Publish Now', desc: 'Make visible immediately' }
                    ].map(option => (
                        <label key={option.value} className={`status-option ${formData.status === option.value ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="status"
                                value={option.value}
                                checked={formData.status === option.value}
                                onChange={handleChange}
                            />
                            <div className="status-content">
                                <span className="status-label">{option.label}</span>
                                <span className="status-desc">{option.desc}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                    {job ? 'Update Job' : 'Create Job'}
                </button>
            </div>

            <style>{`
        .job-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-lg);
        }

        .form-input.error,
        .form-select.error,
        .form-textarea.error {
          border-color: var(--status-error);
        }

        .error-text {
          display: block;
          font-size: 0.8125rem;
          color: var(--status-error);
          margin-top: var(--spacing-xs);
        }

        .skills-input-wrapper {
          background: var(--bg-glass);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          padding: var(--spacing-sm);
          min-height: 48px;
        }

        .skills-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
          align-items: center;
        }

        .skill-tag {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--accent-glow);
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          color: var(--accent-tertiary);
        }

        .skill-tag button {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 2px;
          opacity: 0.7;
          transition: opacity var(--transition-fast);
        }

        .skill-tag button:hover {
          opacity: 1;
        }

        .skill-input {
          flex: 1;
          min-width: 150px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 0.9375rem;
          color: var(--text-primary);
          padding: var(--spacing-xs);
        }

        .skill-input::placeholder {
          color: var(--text-muted);
        }

        .skill-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
          margin-top: var(--spacing-sm);
        }

        .skill-suggestion {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .skill-suggestion:hover {
          background: var(--bg-glass-hover);
          border-color: var(--accent-primary);
          color: var(--text-primary);
        }

        .add-skill-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-primary);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          margin-left: var(--spacing-sm);
          flex-shrink: 0;
        }

        .add-skill-btn:hover {
          background: var(--accent-hover);
        }

        .status-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-md);
        }

        .status-option {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--bg-glass);
          border: 2px solid var(--border-primary);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .status-option:hover {
          border-color: var(--border-accent);
        }

        .status-option.selected {
          border-color: var(--accent-primary);
          background: var(--accent-glow);
        }

        .status-option input {
          accent-color: var(--accent-primary);
          margin-top: 3px;
        }

        .status-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .status-label {
          font-weight: 500;
          color: var(--text-primary);
        }

        .status-desc {
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-md);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--border-secondary);
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .status-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </form>
    );
};

export default JobForm;
