import React, { useState, useEffect } from 'react';
import { Award, Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/**
 * SkillBadgeIndicator - Shows if a task has skills recorded and allows viewing them
 * 
 * Usage: <SkillBadgeIndicator taskId={task.id} employeeId={task.assigned_to} />
 */
const SkillBadgeIndicator = ({ taskId, employeeId }) => {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchSkills();
    }, [taskId, employeeId]);

    const fetchSkills = async () => {
        if (!taskId || !employeeId) {
            setLoading(false);
            return;
        }

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
            setSkills(data || []);
        } catch (err) {
            console.error('Error fetching skills:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;
    if (skills.length === 0) return null;

    const hasLateApproval = skills.some(s => s.manager_approved_late);

    return (
        <>
            {/* Badge Button */}
            <button
                onClick={() => setShowModal(true)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: hasLateApproval ? '#fef3c7' : '#dbeafe',
                    color: hasLateApproval ? '#92400e' : '#1e40af',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
                title="View claimed skills"
            >
                <Award size={12} />
                {skills.length} Skill{skills.length > 1 ? 's' : ''}
                {hasLateApproval && ' (Late)'}
            </button>

            {/* Skills Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)'
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            padding: '24px',
                            color: 'white',
                            position: 'relative'
                        }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '16px',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Award size={24} />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                                        Skills Claimed
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
                                        {skills.length} skill{skills.length > 1 ? 's' : ''} exercised in this task
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Skills List */}
                        <div style={{ padding: '24px', maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
                            {skills.map((skillRecord, idx) => {
                                const skill = skillRecord.skills_master;
                                const isEngineering = skill.category === 'engineering';

                                return (
                                    <div key={idx} style={{
                                        padding: '16px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        marginBottom: idx < skills.length - 1 ? '12px' : 0,
                                        backgroundColor: isEngineering ? '#fef3f2' : '#f0f9ff',
                                        position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                            <h4 style={{
                                                margin: 0,
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                color: isEngineering ? '#991b1b' : '#1e40af'
                                            }}>
                                                {skill.skill_name}
                                            </h4>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                color: isEngineering ? '#991b1b' : '#1e40af',
                                                backgroundColor: isEngineering ? '#fecaca' : '#bfdbfe',
                                                padding: '4px 8px',
                                                borderRadius: '6px'
                                            }}>
                                                {skill.category === 'engineering' ? 'Engineering' : 'AI/ML'}
                                            </span>
                                        </div>

                                        {skillRecord.manager_approved_late && (
                                            <div style={{
                                                marginTop: '12px',
                                                padding: '8px 12px',
                                                backgroundColor: '#fef3c7',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                color: '#92400e',
                                                fontWeight: 500
                                            }}>
                                                ⏰ Late Completion (Manager Approved)
                                            </div>
                                        )}

                                        <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                                            Claimed on {new Date(skillRecord.claimed_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SkillBadgeIndicator;
