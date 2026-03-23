import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trash2, Plus, StickyNote, Pencil, Check, X, CheckCircle, Circle } from 'lucide-react';

const NotesTile = () => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setNotes(data);
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const addNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notes')
                .insert({
                    user_id: user.id,
                    content: newNote.trim(),
                    is_completed: false
                })
                .select()
                .single();

            if (data) {
                setNotes([data, ...notes]);
                setNewNote('');
            }
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const deleteNote = async (id) => {
        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id);

            if (!error) {
                setNotes(notes.filter(n => n.id !== id));
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const updateNote = async (id, updates) => {
        try {
            const { data, error } = await supabase
                .from('notes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (data) {
                setNotes(notes.map(n => n.id === id ? data : n));
            }
        } catch (error) {
            console.error('Error updating note:', error);
        }
    };

    const toggleComplete = (note) => {
        updateNote(note.id, { is_completed: !note.is_completed });
    };

    const startEditing = (note) => {
        setEditingNoteId(note.id);
        setEditText(note.content);
    };

    const cancelEditing = () => {
        setEditingNoteId(null);
        setEditText('');
    };

    const saveEdit = async () => {
        if (!editText.trim()) return;
        await updateNote(editingNoteId, { content: editText.trim() });
        setEditingNoteId(null);
        setEditText('');
    };

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '320px',
            position: 'relative'
        }}>
            {/* Notes List */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }} className="custom-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <div style={{ width: '20px', height: '20px', border: '2px solid #f1f5f9', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                ) : notes.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                        <StickyNote size={40} color="#94a3b8" strokeWidth={1.5} />
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 600, marginTop: '12px' }}>No notes for today</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} style={{
                            backgroundColor: note.is_completed ? '#f8fafc' : '#ffffff',
                            padding: '16px',
                            borderRadius: '16px',
                            border: note.is_completed ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'start',
                            gap: '12px',
                            transition: 'all 0.2s',
                            boxShadow: note.is_completed ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            <button
                                onClick={() => toggleComplete(note)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0',
                                    marginTop: '2px',
                                    color: note.is_completed ? '#0ea5e9' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {note.is_completed ? <CheckCircle size={20} fill="#0ea5e9" color="#fff" /> : <Circle size={20} />}
                            </button>

                            <div style={{ flex: 1 }}>
                                {editingNoteId === note.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            autoFocus
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: '10px',
                                                border: '1px solid #0ea5e9',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                backgroundColor: '#fff'
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEditing();
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <span style={{
                                        wordBreak: 'break-word',
                                        lineHeight: '1.5',
                                        textDecoration: note.is_completed ? 'line-through' : 'none',
                                        color: note.is_completed ? '#94a3b8' : '#1e293b',
                                        fontSize: '0.95rem',
                                        fontWeight: 500
                                    }}>
                                        {note.content}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px', transition: 'color 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Note Input */}
            <form onSubmit={addNote} style={{
                display: 'flex',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #f1f5f9'
            }}>
                <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Capture a thought..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        fontSize: '0.95rem',
                        outline: 'none',
                        color: '#1e293b',
                        fontWeight: 500
                    }}
                />
                <button
                    type="submit"
                    disabled={!newNote.trim()}
                    style={{
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: newNote.trim() ? 'pointer' : 'default',
                        opacity: newNote.trim() ? 1 : 0.6,
                        boxShadow: '0 4px 6px rgba(14, 165, 233, 0.2)'
                    }}
                >
                    <Plus size={18} />
                </button>
            </form>
            <style>
                {`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                `}
            </style>
        </div>
    );
};

export default NotesTile;
