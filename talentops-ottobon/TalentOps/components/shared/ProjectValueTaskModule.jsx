import React, { useState } from 'react';
import {
    Plus,
    Calendar,
    Clock,
    Target,
    User,
    CheckCircle2,
    TrendingUp,
    Brain,
    Layout,
    ChevronDown,
    AlertCircle,
    Check
} from 'lucide-react';

/**
 * Value-Based Task Module UI
 * Extends the existing Project-side Task Module.
 * Follows the established design system and tokens.
 */

// Skills constants as requested
const SKILLS = [
    'Frontend',
    'Backend',
    'Workflows',
    'Databases',
    'Prompting',
    'Non-popular LLMs',
    'Fine-tuning',
    'Data Labelling',
    'Content Generation'
];

// Mock Assignees as requested
const MOCK_ASSIGNEES = [
    { id: 1, name: 'Alex Rivera', skillScore: 88, load: 65, avatar: null },
    { id: 2, name: 'Sarah Chen', skillScore: 94, load: 40, avatar: null },
    { id: 3, name: 'Michael Ross', skillScore: 72, load: 85, avatar: null },
    { id: 4, name: 'Elena Gilbert', skillScore: 81, load: 30, avatar: null },
];

export const ValueTaskCreateForm = () => {
    const [allocatedHours, setAllocatedHours] = useState(10);
    const [pointsPerHour, setPointsPerHour] = useState(50);
    const [selectedSkill, setSelectedSkill] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState(null);

    const totalPoints = allocatedHours * pointsPerHour;

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(to right, #f8fafc, #ffffff)'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Plus size={20} color="var(--accent)" /> Create Value Task
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Define effort and value for this project task.
                </p>
            </div>

            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
                {/* Left Column: Task Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <section>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Task Details
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Task Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Implement Vector Search"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Description</label>
                                <textarea
                                    placeholder="Describe the objective and deliverables..."
                                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Start Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={16} style={iconInputStyle} />
                                        <input type="date" style={inputWithIconStyle} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Due Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={16} style={iconInputStyle} />
                                        <input type="date" style={inputWithIconStyle} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={18} /> Points Configuration
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Allocated Hours</label>
                                <input
                                    type="number"
                                    value={allocatedHours}
                                    onChange={(e) => setAllocatedHours(Number(e.target.value))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Points per Hour</label>
                                <input
                                    type="number"
                                    value={pointsPerHour}
                                    onChange={(e) => setPointsPerHour(Number(e.target.value))}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#0369a1' }}>Total Task Value</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{totalPoints}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>Points</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Skill & Assignee Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <section>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Skill Mapping
                        </h3>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Primary Skill Required</label>
                            <div style={{ position: 'relative' }}>
                                <Brain size={16} style={iconInputStyle} />
                                <select
                                    value={selectedSkill}
                                    onChange={(e) => setSelectedSkill(e.target.value)}
                                    style={inputWithIconStyle}
                                >
                                    <option value="">Select a skill...</option>
                                    {SKILLS.map(skill => (
                                        <option key={skill} value={skill}>{skill}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Assignee Selection
                        </h3>
                        <div style={{
                            flex: 1,
                            backgroundColor: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 80px 80px', gap: '12px' }}>
                                <span>EMPLOYEE</span>
                                <span style={{ textAlign: 'center' }}>SKILL SCORE</span>
                                <span style={{ textAlign: 'center' }}>LOAD</span>
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {MOCK_ASSIGNEES.sort((a, b) => a.skillScore - b.skillScore).map(emp => (
                                    <div
                                        key={emp.id}
                                        onClick={() => setSelectedAssignee(emp.id)}
                                        style={{
                                            padding: '12px',
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(140px, 1fr) 80px 80px',
                                            gap: '12px',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: selectedAssignee === emp.id ? '#eff6ff' : 'transparent',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', color: 'white', fontWeight: 600
                                            }}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>{emp.name}</span>
                                            {selectedAssignee === emp.id && <Check size={14} color="var(--accent)" />}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textAlign: 'center' }}>{emp.skillScore}%</span>
                                            <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${emp.skillScore}%`, height: '100%', background: '#3b82f6' }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                                                backgroundColor: emp.load > 80 ? '#fee2e2' : emp.load > 50 ? '#fef3c7' : '#dcfce7',
                                                color: emp.load > 80 ? '#991b1b' : emp.load > 50 ? '#92400e' : '#166534',
                                                fontWeight: 600
                                            }}>
                                                {emp.load}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <button style={{
                        marginTop: 'auto',
                        padding: '14px',
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        borderRadius: '10px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Target size={18} /> Assign Task
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ProjectTaskDetail = () => {
    const [timeSpent, setTimeSpent] = useState(4);
    const allocatedHours = 12;
    const basePoints = 600;

    const remainingHours = allocatedHours - timeSpent;
    const progressPercent = (timeSpent / allocatedHours) * 100;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Task Overview Card */}
                <div style={{
                    backgroundColor: 'var(--surface)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                                    Prompting
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Task ID: #T-9042</span>
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>Optimize RAG Context Retrieval</h2>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Base Potential</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>600 pts</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                        <div style={statCardStyle}>
                            <Clock size={18} color="var(--accent)" />
                            <div>
                                <div style={statLabelStyle}>Allocated Time</div>
                                <div style={statValueStyle}>{allocatedHours} Hours</div>
                            </div>
                        </div>
                        <div style={statCardStyle}>
                            <Target size={18} color="#10b981" />
                            <div>
                                <div style={statLabelStyle}>Success Rate</div>
                                <div style={statValueStyle}>98.5%</div>
                            </div>
                        </div>
                        <div style={statCardStyle}>
                            <User size={18} color="#8b5cf6" />
                            <div>
                                <div style={statLabelStyle}>Role Type</div>
                                <div style={statValueStyle}>Technical</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Task Progress</h3>
                            <span style={{
                                backgroundColor: '#dcfce7', color: '#166534',
                                padding: '4px 12px', borderRadius: '20px',
                                fontSize: '0.75rem', fontWeight: 700
                            }}>
                                IN PROGRESS
                            </span>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Overall Completion</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{Math.round(progressPercent)}%</span>
                            </div>
                            <div style={{ height: '12px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
                                    borderRadius: '6px'
                                }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Record Time Spent (Hours)
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max={allocatedHours}
                                    step="0.5"
                                    value={timeSpent}
                                    onChange={(e) => setTimeSpent(Number(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                />
                            </div>
                            <div style={{
                                width: '100px', padding: '10px', backgroundColor: 'white',
                                borderRadius: '8px', border: '1px solid var(--border)',
                                textAlign: 'center', fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)'
                            }}>
                                {timeSpent}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                            <div style={{ flex: 1, padding: '12px', backgroundColor: 'white', borderRadius: '10px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Remaining</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: remainingHours < 2 ? '#ef4444' : '#64748b' }}>{remainingHours}h</div>
                            </div>
                            <div style={{ flex: 1, padding: '12px', backgroundColor: 'white', borderRadius: '10px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Current Burn</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#64748b' }}>1.2h / day</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Completion Summary Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <ValueTaskCompletionSummary
                    allocatedHours={allocatedHours}
                    actualHours={timeSpent}
                    basePoints={basePoints}
                />
            </div>
        </div>
    );
};

export const ValueTaskCompletionSummary = ({ allocatedHours = 12, actualHours = 10, basePoints = 600 }) => {
    const isEarly = actualHours < allocatedHours;
    const bonusPoints = isEarly ? Math.round((allocatedHours - actualHours) * 25) : 0;
    const finalPoints = basePoints + bonusPoints;

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            position: 'sticky',
            top: '24px'
        }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                Task Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={summaryRowStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>Allocated Hours</span>
                    <span style={{ fontWeight: 600 }}>{allocatedHours}h</span>
                </div>
                <div style={summaryRowStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>Actual Hours</span>
                    <span style={{ fontWeight: 600 }}>{actualHours}h</span>
                </div>
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />
                <div style={summaryRowStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Points</span>
                    <span style={{ fontWeight: 600 }}>{basePoints}</span>
                </div>
                <div style={summaryRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Efficiency Bonus</span>
                        <AlertCircle size={14} color="var(--text-secondary)" />
                    </div>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>+{bonusPoints}</span>
                </div>

                <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        Final Points Earned
                    </div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--accent)' }}>
                        {finalPoints}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                        Points will be credited upon manager approval
                    </div>
                </div>

                <button style={{
                    marginTop: '12px',
                    padding: '16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}>
                    <CheckCircle2 size={20} /> Mark as Completed
                </button>
            </div>
        </div>
    );
};

// Main Module Container for demonstration
const ProjectTaskModule = () => {
    const [view, setView] = useState('create'); // 'create' or 'detail'

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
            {/* View Switcher for Demo */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <button
                    onClick={() => setView('create')}
                    style={view === 'create' ? activeTabStyle : inactiveTabStyle}
                >
                    Manager: Create Task
                </button>
                <button
                    onClick={() => setView('detail')}
                    style={view === 'detail' ? activeTabStyle : inactiveTabStyle}
                >
                    Employee: Task Progress
                </button>
            </div>

            {view === 'create' ? <ValueTaskCreateForm /> : <ProjectTaskDetail />}
        </div>
    );
};

// Styles
const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    '&:focus': {
        borderColor: 'var(--accent)'
    }
};

const inputWithIconStyle = {
    ...inputStyle,
    paddingLeft: '40px'
};

const iconInputStyle = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    pointerEvents: 'none'
};

const statCardStyle = {
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
};

const statLabelStyle = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase'
};

const statValueStyle = {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-main)'
};

const summaryRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem'
};

const activeTabStyle = {
    padding: '8px 20px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '0.875rem'
};

const inactiveTabStyle = {
    padding: '8px 20px',
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '0.875rem'
};

export default ProjectTaskModule;
