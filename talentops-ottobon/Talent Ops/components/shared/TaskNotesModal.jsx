import React, { useState, useEffect } from 'react';
import { X, FileText, Clock, User, AlertCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/**
 * TaskNotesModal - Modal for adding and viewing immutable task notes
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - task: { id, title, assigned_to }
 * - userId: current user's UUID
 * - userRole: 'employee', 'manager', 'team_lead', 'executive', 'org_admin'
 * - orgId: organization UUID
 * - addToast: (message, type) => void
 * - canAddNote: boolean (computed by parent based on role/assignment)
 */
const TaskNotesModal = ({
    isOpen,
    onClose,
    task,
    userId,
    userRole,
    orgId,
    addToast,
    canAddNote = false
}) => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [authorName, setAuthorName] = useState('');

    // Fetch notes and author name
    useEffect(() => {
        if (isOpen && task?.id) {
            fetchNotes();
            fetchAuthorName();
        }
    }, [isOpen, task?.id]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('task_notes')
                .select(`
                    id,
                    note_text,
                    created_at,
                    author_id,
                    profiles:author_id (full_name, avatar_url)
                `)
                .eq('task_id', task.id)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotes(data || []);
        } catch (error) {
            console.error('Error fetching notes:', error);
            addToast?.('Failed to load notes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchAuthorName = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();
            setAuthorName(data?.full_name || 'Unknown');
        } catch (error) {
            console.error('Error fetching author name:', error);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim()) {
            addToast?.('Please enter a note', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('task_notes')
                .insert({
                    task_id: task.id,
                    author_id: userId,
                    note_text: newNote.trim(),
                    org_id: orgId
                });

            if (error) throw error;

            addToast?.('Note added successfully', 'success');
            setNewNote('');
            fetchNotes(); // Refresh notes
        } catch (error) {
            console.error('Error adding note:', error);
            addToast?.('Failed to add note', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (!isOpen) return null;

    return (
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
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--surface, #ffffff)',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border, #e5e7eb)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FileText size={20} color="white" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                                Task Notes
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
                                {task?.title?.slice(0, 40)}{task?.title?.length > 40 ? '...' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            color: 'var(--text-secondary, #6b7280)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background, #f3f4f6)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Add Note Section */}
                {canAddNote && (
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                        backgroundColor: 'var(--background, #f9fafb)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <User size={14} color="var(--text-secondary, #6b7280)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
                                {authorName} • {new Date().toLocaleDateString()}
                            </span>
                        </div>
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Write your note here..."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '10px',
                                border: '1px solid var(--border, #e5e7eb)',
                                outline: 'none',
                                fontSize: '0.9rem',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                backgroundColor: 'var(--surface, #ffffff)'
                            }}
                        />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '12px'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                color: '#f59e0b'
                            }}>
                                <AlertCircle size={14} />
                                <span>Notes cannot be edited after saving</span>
                            </div>
                            <button
                                onClick={handleAddNote}
                                disabled={submitting || !newNote.trim()}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: submitting || !newNote.trim()
                                        ? '#d1d5db'
                                        : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: submitting || !newNote.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Send size={16} />
                                {submitting ? 'Saving...' : 'Save Note'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Notes List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px 24px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #6b7280)' }}>
                            Loading notes...
                        </div>
                    ) : notes.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: 'var(--text-secondary, #6b7280)'
                        }}>
                            <FileText size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ margin: 0 }}>No notes yet</p>
                            {canAddNote && (
                                <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
                                    Be the first to add a note!
                                </p>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {notes.map((note) => (
                                <div
                                    key={note.id}
                                    style={{
                                        display: 'flex',
                                        gap: '12px',
                                        padding: '16px',
                                        backgroundColor: 'var(--background, #f9fafb)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border, #e5e7eb)'
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        flexShrink: 0
                                    }}>
                                        {note.profiles?.avatar_url ? (
                                            <img
                                                src={note.profiles.avatar_url}
                                                alt=""
                                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            getInitials(note.profiles?.full_name)
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '8px'
                                        }}>
                                            <span style={{
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                color: 'var(--text-primary, #111827)'
                                            }}>
                                                {note.profiles?.full_name || 'Unknown'}
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary, #6b7280)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <Clock size={12} />
                                                {formatDate(note.created_at)}
                                            </span>
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            color: 'var(--text-primary, #374151)',
                                            lineHeight: 1.5,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {note.note_text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskNotesModal;
