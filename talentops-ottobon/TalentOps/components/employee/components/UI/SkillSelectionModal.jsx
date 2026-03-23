import React, { useState, useEffect } from 'react';
import { Check, Loader, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';

const SkillSelectionModal = ({ isOpen, onClose, task, onSkillsSaved }) => {
    const { addToast } = useToast();
    const { userId, orgId } = useUser();
    const [skills, setSkills] = useState([]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState('engineering');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && task) {
            fetchSkills();
            checkExistingSkills();
        }
    }, [isOpen, task]);

    const fetchSkills = async () => {
        try {
            const { data, error } = await supabase
                .from('skills_master')
                .select('*')
                .order('category, skill_name');

            if (error) throw error;
            setSkills(data || []);
        } catch (err) {
            console.error('Error fetching skills:', err);
            addToast('Failed to load skills', 'error');
        } finally {
            setLoading(false);
        }
    };

    const checkExistingSkills = async () => {
        try {
            const { data, error } = await supabase
                .from('task_skills')
                .select('skill_id')
                .eq('task_id', task.id)
                .eq('employee_id', userId);

            if (error) throw error;

            if (data && data.length > 0) {
                // Skills already recorded - close modal
                addToast('Skills already recorded for this task', 'info');
                onClose();
            }
        } catch (err) {
            console.error('Error checking existing skills:', err);
        }
    };

    const toggleSkill = (skillId) => {
        setError('');
        setSelectedSkills(prev => {
            if (prev.includes(skillId)) {
                return prev.filter(id => id !== skillId);
            } else {
                // No limit - select as many as you want!
                return [...prev, skillId];
            }
        });
    };

    const handleSave = async () => {
        if (selectedSkills.length === 0) {
            setError('Please select at least 1 skill');
            return;
        }

        setSaving(true);
        try {
            // Check if task was late and if manager approved
            const isLate = task.due_date && new Date() > new Date(task.due_date);
            const managerApprovedLate = task.access_status === 'approved' && isLate;

            const inserts = selectedSkills.map(skillId => ({
                task_id: task.id,
                employee_id: userId,
                skill_id: skillId,
                org_id: orgId,
                manager_approved_late: managerApprovedLate
            }));

            const { error } = await supabase
                .from('task_skills')
                .insert(inserts);

            if (error) throw error;

            addToast(`Successfully recorded ${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''}!`, 'success');

            if (onSkillsSaved) {
                onSkillsSaved();
            }

            onClose();
        } catch (err) {
            console.error('Error saving skills:', err);
            addToast('Failed to save skills: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const engineeringSkills = skills.filter(s => s.category === 'engineering');
    const aiMlSkills = skills.filter(s => s.category === 'ai_ml');
    const displaySkills = activeCategory === 'engineering' ? engineeringSkills : aiMlSkills;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 32px 24px 32px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
                                🎯 What did you learn?
                            </h3>
                            <p style={{ fontSize: '0.95rem', opacity: 0.95 }}>
                                Select all skills you used in this task
                            </p>
                        </div>
                    </div>
                </div>

                {/* Category Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '2px solid #e5e7eb',
                    backgroundColor: '#f9fafb'
                }}>
                    <button
                        onClick={() => setActiveCategory('engineering')}
                        style={{
                            flex: 1,
                            padding: '16px',
                            border: 'none',
                            backgroundColor: activeCategory === 'engineering' ? 'white' : 'transparent',
                            color: activeCategory === 'engineering' ? '#667eea' : '#6b7280',
                            fontWeight: activeCategory === 'engineering' ? 700 : 600,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            borderBottom: activeCategory === 'engineering' ? '3px solid #667eea' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Engineering ({engineeringSkills.length})
                    </button>
                    <button
                        onClick={() => setActiveCategory('ai_ml')}
                        style={{
                            flex: 1,
                            padding: '16px',
                            border: 'none',
                            backgroundColor: activeCategory === 'ai_ml' ? 'white' : 'transparent',
                            color: activeCategory === 'ai_ml' ? '#764ba2' : '#6b7280',
                            fontWeight: activeCategory === 'ai_ml' ? 700 : 600,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            borderBottom: activeCategory === 'ai_ml' ? '3px solid #764ba2' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        AI/ML ({aiMlSkills.length})
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <Loader className="animate-spin" size={32} color="#667eea" />
                        </div>
                    ) : (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                gap: '12px',
                                marginBottom: '24px'
                            }}>
                                {displaySkills.map(skill => {
                                    const isSelected = selectedSkills.includes(skill.id);
                                    return (
                                        <button
                                            key={skill.id}
                                            onClick={() => toggleSkill(skill.id)}
                                            style={{
                                                padding: '16px 12px',
                                                borderRadius: '16px',
                                                border: isSelected ? '2px solid #667eea' : '2px solid #e5e7eb',
                                                backgroundColor: isSelected ? '#f0f4ff' : 'white',
                                                color: isSelected ? '#667eea' : '#374151',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                minHeight: '70px',
                                                textAlign: 'center',
                                                boxShadow: isSelected ? '0 4px 12px rgba(102, 126, 234, 0.2)' : 'none',
                                                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                    e.currentTarget.style.transform = 'scale(1.02)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }
                                            }}
                                        >
                                            {isSelected && <Check size={18} />}
                                            <span>{skill.skill_name}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selection Count */}
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: selectedSkills.length > 0 ? '#f0f4ff' : '#f9fafb',
                                borderRadius: '12px',
                                border: `1px solid ${selectedSkills.length > 0 ? '#c7d2fe' : '#e5e7eb'}`,
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                color: selectedSkills.length > 0 ? '#667eea' : '#6b7280',
                                fontWeight: 600
                            }}>
                                {selectedSkills.length === 0 ? 'No skills selected yet' :
                                    `${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''} selected`}
                            </div>

                            {error && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '12px',
                                    color: '#991b1b',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 32px',
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={handleSave}
                        disabled={saving || selectedSkills.length === 0}
                        style={{
                            padding: '14px 32px',
                            borderRadius: '12px',
                            border: 'none',
                            background: selectedSkills.length > 0
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : '#e5e7eb',
                            color: selectedSkills.length > 0 ? 'white' : '#9ca3af',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: selectedSkills.length > 0 && !saving ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: selectedSkills.length > 0 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (selectedSkills.length > 0 && !saving) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = selectedSkills.length > 0 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none';
                        }}
                    >
                        {saving ? (
                            <>
                                <Loader className="animate-spin" size={18} />
                                Saving...
                            </>
                        ) : (
                            <>
                                Save Skills
                                <Check size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SkillSelectionModal;
