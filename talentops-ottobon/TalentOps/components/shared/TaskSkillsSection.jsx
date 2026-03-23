import React, { useState, useEffect } from 'react';
import { Award, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/**
 * TaskSkillsSection - Displays claimed skills for a task in the task details modal
 */
const TaskSkillsSection = ({ taskId, employeeId }) => {
    const [taskSkills, setTaskSkills] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSkills = async () => {
            if (!taskId || !employeeId) {
                console.log('TaskSkillsSection: Missing taskId or employeeId', { taskId, employeeId });
                setLoading(false);
                return;
            }

            console.log('TaskSkillsSection: Fetching skills for', { taskId, employeeId });

            try {
                const { data, error } = await supabase
                    .from('task_skills')
                    .select(`
                        *,
                        skills_master (
                            id,
                            skill_name,
                            category
                        )
                    `)
                    .eq('task_id', taskId)
                    .eq('employee_id', employeeId);

                if (error) throw error;
                console.log('TaskSkillsSection: Fetched skills:', data);
                setTaskSkills(data || []);
            } catch (err) {
                console.error('Error fetching task skills:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSkills();
    }, [taskId, employeeId]);

    if (loading) {
        return (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Loading skills...
                </div>
            </div>
        );
    }

    if (!taskSkills || taskSkills.length === 0) {
        // Show a message only for debugging - can be removed later
        return (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Award size={16} /> Skills Claimed
                </label>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '12px' }}>
                    No skills claimed for this task yet.
                </div>
            </div>
        );
    }

    return (
        <div style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
            borderRadius: '16px',
            border: '1px solid #e0e7ff',
            marginTop: '20px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '2px solid #e0e7ff'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '10px',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}>
                    <Award size={20} color="white" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Skills Claimed
                    </h4>
                    <p style={{
                        margin: '2px 0 0 0',
                        fontSize: '0.8rem',
                        color: '#6b7280',
                        fontWeight: 500
                    }}>
                        {taskSkills.length} skill{taskSkills.length > 1 ? 's' : ''} demonstrated in this task
                    </p>
                </div>
            </div>

            {/* Skills Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px'
            }}>
                {taskSkills.map((skillRecord, idx) => {
                    const skill = skillRecord.skills_master;
                    const isEngineering = skill.category === 'engineering';

                    const categoryConfig = isEngineering ? {
                        gradient: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                        borderColor: '#fca5a5',
                        textColor: '#991b1b',
                        badgeBg: '#dc2626',
                        iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        label: 'Engineering'
                    } : {
                        gradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        borderColor: '#93c5fd',
                        textColor: '#1e40af',
                        badgeBg: '#3b82f6',
                        iconBg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                        label: 'AI/ML'
                    };

                    return (
                        <div
                            key={idx}
                            style={{
                                background: 'white',
                                borderRadius: '14px',
                                border: `2px solid ${categoryConfig.borderColor}`,
                                padding: '16px',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'default',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = `0 12px 24px ${categoryConfig.borderColor}40`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                            }}
                        >
                            {/* Decorative gradient bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '4px',
                                background: categoryConfig.iconBg
                            }} />

                            {/* Content */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '8px'
                            }}>
                                <h5 style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: categoryConfig.textColor,
                                    letterSpacing: '-0.02em'
                                }}>
                                    {skill.skill_name}
                                </h5>

                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: 'white',
                                    background: categoryConfig.badgeBg,
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    letterSpacing: '0.5px',
                                    whiteSpace: 'nowrap',
                                    boxShadow: `0 2px 8px ${categoryConfig.badgeBg}40`
                                }}>
                                    {categoryConfig.label}
                                </span>
                            </div>

                            {/* Late approval badge */}
                            {skillRecord.manager_approved_late && (
                                <div style={{
                                    marginTop: '10px',
                                    padding: '8px 12px',
                                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                    borderRadius: '8px',
                                    border: '1px solid #fbbf24',
                                    fontSize: '0.75rem',
                                    color: '#92400e',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 6px rgba(251, 191, 36, 0.2)'
                                }}>
                                    <Clock size={14} />
                                    Late Completion (Manager Approved)
                                </div>
                            )}

                            {/* Timestamp */}
                            <div style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid #f3f4f6',
                                fontSize: '11px',
                                color: '#9ca3af',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Clock size={12} color="#9ca3af" />
                                {new Date(skillRecord.claimed_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskSkillsSection;
