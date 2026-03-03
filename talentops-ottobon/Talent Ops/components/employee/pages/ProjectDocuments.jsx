import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Edit3, Save, X, Code, FileQuestion, ListTodo, Loader2, Download, Upload, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';

const ProjectDocuments = ({ userRole, addToast: parentAddToast = null }) => {
    const { currentProject, projectRole } = useProject();
    const toastContext = useToast() || {};
    const addToast = parentAddToast || toastContext.addToast || ((msg) => console.log('Toast:', msg));
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [newDoc, setNewDoc] = useState({ title: '', content: '', doc_type: 'requirements' });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [selectedFilter, setSelectedFilter] = useState('all');

    const isManager = projectRole === 'manager' || projectRole === 'team_lead';

    const docTypes = [
        { value: 'all', label: 'All Documents', icon: FileText, color: '#64748b' },
        { value: 'requirements', label: 'Requirements', icon: FileQuestion, color: '#8b5cf6' },
        { value: 'tech_stack', label: 'Tech Stack', icon: Code, color: '#3b82f6' },
        { value: 'project_tasks', label: 'Project Tasks', icon: ListTodo, color: '#10b981' },
        { value: 'other', label: 'Other', icon: FileText, color: '#6b7280' }
    ];

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            let data, error;
            let projectMap = {};

            if (userRole === 'executive') {
                // Fetch ALL documents for executives
                const result = await supabase
                    .from('project_documents')
                    .select('*')
                    .order('created_at', { ascending: false });
                data = result.data;
                error = result.error;

                // Fetch project names manually
                if (data) {
                    const projectIds = [...new Set(data.map(d => d.project_id).filter(Boolean))];
                    if (projectIds.length > 0) {
                        const { data: projectsData } = await supabase
                            .from('projects')
                            .select('id, name')
                            .in('id', projectIds);

                        if (projectsData) {
                            projectsData.forEach(p => projectMap[p.id] = p.name);
                        }
                    }
                }
            } else {
                if (!currentProject?.id) {
                    setLoading(false);
                    return;
                }
                const result = await supabase
                    .from('project_documents')
                    .select('*')
                    .eq('project_id', currentProject.id)
                    .order('created_at', { ascending: false });
                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            // Fetch uploader profiles
            let uploaderIds = [];
            if (data) {
                uploaderIds = [...new Set(data.map(d => d.created_by).filter(Boolean))];
            }

            let profileMap = {};
            if (uploaderIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, role')
                    .in('id', uploaderIds);

                if (profiles) {
                    profiles.forEach(p => profileMap[p.id] = p);
                }
            }

            // Attach project names and uploader info
            const enhancedData = (data || []).map(doc => {
                const uploader = profileMap[doc.created_by];
                return {
                    ...doc,
                    project_name: (userRole === 'executive' ? projectMap[doc.project_id] : currentProject?.name) || 'Unknown Project',
                    uploader_name: uploader?.full_name || 'Unknown',
                    uploader_role: uploader?.role || 'Member'
                };
            });

            setDocuments(enhancedData);
        } catch (err) {
            console.error('Error fetching documents:', err);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [currentProject?.id, userRole]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleAddDocument = async () => {
        console.log('DEBUG: Attempting to add document');
        console.log('DEBUG: Current Project:', currentProject);
        console.log('DEBUG: Project ID being sent:', currentProject?.id);

        if (!newDoc.title.trim()) {
            addToast('Please enter a title', 'error');
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('DEBUG: User ID:', user?.id);

            let fileUrl = null;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${currentProject.id}/${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('project-docs')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('project-docs')
                    .getPublicUrl(fileName);

                fileUrl = urlData.publicUrl;
            }

            const { data: docData, error } = await supabase.from('project_documents').insert({
                project_id: currentProject.id,
                title: newDoc.title,
                content: newDoc.content,
                doc_type: newDoc.doc_type,
                file_url: fileUrl,
                created_by: user.id
            })
                .select()
                .single();

            if (error) throw error;

            // Send Notifications to Team Members
            try {
                const { data: members, error: membersError } = await supabase
                    .from('project_members')
                    .select('user_id')
                    .eq('project_id', currentProject.id);

                if (!membersError && members) {
                    const recipients = members
                        .map(m => m.user_id)
                        .filter(uid => uid !== user.id);

                    if (recipients.length > 0) {
                        const notifications = recipients.map(uid => ({
                            receiver_id: uid,
                            sender_id: user.id,
                            sender_name: 'Project Documents',
                            message: `New document added: ${newDoc.title}`,
                            type: 'document_upload',
                            is_read: false,
                            created_at: new Date().toISOString()
                        }));
                        await supabase.from('notifications').insert(notifications);
                    }
                }
            } catch (notifyErr) {
                console.error('Error sending document notifications:', notifyErr);
            }

            addToast('Document added successfully', 'success');
            setShowAddModal(false);
            setNewDoc({ title: '', content: '', doc_type: 'requirements' });
            setFile(null);
            fetchDocuments();
        } catch (err) {
            console.error('Error adding document:', err);
            addToast('Failed to add document: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateDocument = async (id) => {
        try {
            const { error } = await supabase
                .from('project_documents')
                .update({ title: editingDoc.title, content: editingDoc.content, doc_type: editingDoc.doc_type })
                .eq('id', id);

            if (error) throw error;
            addToast('Document updated', 'success');
            setEditingDoc(null);
            fetchDocuments();
        } catch (err) {
            console.error('Error updating document:', err);
            addToast('Failed to update document', 'error');
        }
    };

    const handleDeleteDocument = async (id) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            const { error } = await supabase.from('project_documents').delete().eq('id', id);
            if (error) throw error;
            addToast('Document deleted', 'success');
            fetchDocuments();
        } catch (err) {
            console.error('Error deleting document:', err);
            addToast('Failed to delete document', 'error');
        }
    };

    const getDocTypeInfo = (type) => docTypes.find(d => d.value === type) || docTypes[4]; // Default to 'other' if not found

    const filteredDocuments = selectedFilter === 'all'
        ? documents
        : documents.filter(doc => doc.doc_type === selectedFilter);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748b' }}>
                <Loader2 size={24} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: '12px' }}>Loading documents...</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Compact Header - Matching Leave Requests Style */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 28px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Project Documents</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            Project Documents
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                            Shared resources and documentation for {currentProject?.name}
                        </p>
                    </div>

                    {isManager && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(6, 182, 212, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
                            }}
                        >
                            <Plus size={16} strokeWidth={2.5} /> Add Document
                        </button>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div style={{
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
            }}>
                {/* Document Type Filters */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {docTypes.map(type => {
                        const count = type.value === 'all'
                            ? documents.length
                            : documents.filter(d => d.doc_type === type.value).length;

                        const isActive = selectedFilter === type.value;

                        return (
                            <div
                                key={type.value}
                                onClick={() => setSelectedFilter(type.value)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 14px',
                                    borderRadius: '20px',
                                    backgroundColor: isActive ? type.color : `${type.color}10`,
                                    border: isActive ? `1px solid ${type.color}` : `1px solid ${type.color}30`,
                                    color: isActive ? 'white' : type.color,
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    boxShadow: isActive ? `0 4px 12px ${type.color}40` : 'none',
                                    transform: isActive ? 'translateY(-1px)' : 'none'
                                }}
                            >
                                <type.icon size={14} />
                                {type.label} <span style={{ opacity: 0.7, marginLeft: '2px' }}>({count})</span>
                            </div>
                        );
                    })}
                </div>

                {/* Documents Grid */}
                {filteredDocuments.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        borderColor: '#e2e8f0',
                        borderStyle: 'dashed',
                        borderWidth: '2px',
                        borderRadius: '16px',
                        color: '#64748b',
                        backgroundColor: '#ffffff'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <FileText size={28} style={{ color: '#94a3b8' }} />
                        </div>
                        <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                            {selectedFilter === 'all' ? 'No documents shared yet' : `No ${selectedFilter.replace('_', ' ') || 'matching'} documents`}
                        </p>
                        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Add documents to share with your team</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                        {filteredDocuments.map(doc => {
                            const typeInfo = getDocTypeInfo(doc.doc_type);
                            const isEditing = editingDoc?.id === doc.id;

                            return (
                                <div key={doc.id} style={{
                                    backgroundColor: 'white',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                    border: '1px solid #e2e8f0',
                                    transition: 'all 0.2s ease'
                                }}>
                                    {/* Doc Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                backgroundColor: `${typeInfo.color}15`,
                                                border: `1px solid ${typeInfo.color}25`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <typeInfo.icon size={18} color={typeInfo.color} />
                                            </div>
                                            {isEditing ? (
                                                <input
                                                    value={editingDoc.title}
                                                    onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                                                    style={{
                                                        fontSize: '0.9rem', fontWeight: 600, border: '1px solid #e2e8f0',
                                                        borderRadius: '6px', padding: '4px 8px', width: '180px'
                                                    }}
                                                />
                                            ) : (
                                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>{doc.title}</h3>
                                            )}
                                        </div>
                                        {userRole === 'executive' && (
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto', marginRight: '10px' }}>
                                                {doc.project_name}
                                            </div>
                                        )}
                                        {isManager && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleUpdateDocument(doc.id)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer' }}>
                                                            <Save size={14} />
                                                        </button>
                                                        <button onClick={() => setEditingDoc(null)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleDeleteDocument(doc.id)} style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
                                                        <Trash2 size={14} color="#94a3b8" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    {isEditing ? (
                                        <textarea
                                            value={editingDoc.content}
                                            onChange={(e) => setEditingDoc({ ...editingDoc, content: e.target.value })}
                                            style={{
                                                width: '100%', minHeight: '80px', border: '1px solid #e2e8f0',
                                                borderRadius: '6px', padding: '8px', fontSize: '0.85rem',
                                                resize: 'vertical', marginBottom: '12px'
                                            }}
                                        />
                                    ) : (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {doc.content || 'No description.'}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                            <span style={{ fontSize: '0.7rem' }}>by {doc.uploader_name} ({doc.uploader_role})</span>
                                        </span>

                                        {doc.file_url && (
                                            <button
                                                onClick={() => setViewingDoc(doc)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6',
                                                    textDecoration: 'none', background: 'none', border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px', padding: '24px',
                        width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '20px' }}>Add New Document</h2>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Title *</label>
                            <input
                                type="text"
                                value={newDoc.title}
                                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                                placeholder="Document title"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.9rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Type</label>
                            <select
                                value={newDoc.doc_type}
                                onChange={(e) => setNewDoc({ ...newDoc, doc_type: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.9rem' }}
                            >
                                {docTypes.map(type => (
                                    type.value !== 'all' && <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Description</label>
                            <textarea
                                value={newDoc.content}
                                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                                placeholder="Optional description..."
                                rows={3}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.9rem', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Upload File</label>
                            <div style={{
                                border: '2px dashed #e2e8f0', borderRadius: '8px', padding: '20px',
                                textAlign: 'center', cursor: 'pointer', backgroundColor: '#f9fafb'
                            }}>
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    id="file-upload"
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <Upload size={24} color="#94a3b8" />
                                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                        {file ? file.name : 'Click to upload'}
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowAddModal(false)} disabled={uploading} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button onClick={handleAddDocument} disabled={uploading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', cursor: 'pointer', fontWeight: 600, opacity: uploading ? 0.7 : 1 }}>
                                {uploading ? 'Uploading...' : 'Add Document'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Modal */}
            {viewingDoc && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1100,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '12px',
                        width: '100%', maxWidth: '900px', height: '85vh',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Preview Header */}
                        <div style={{
                            padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    padding: '8px', borderRadius: '8px', backgroundColor: '#f1f5f9',
                                    color: '#64748b'
                                }}>
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                        {viewingDoc.title}
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                        Previewing document
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <a
                                    href={viewingDoc.file_url}
                                    download // Attribute to force download if possible, otherwise just link
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 16px', borderRadius: '8px',
                                        backgroundColor: '#0f172a', color: 'white',
                                        textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600
                                    }}
                                >
                                    <Download size={16} /> Download
                                </a>
                                <button
                                    onClick={() => setViewingDoc(null)}
                                    style={{
                                        padding: '8px', borderRadius: '8px',
                                        border: '1px solid #e2e8f0', backgroundColor: 'white',
                                        color: '#64748b', cursor: 'pointer', display: 'flex'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Preview Content */}
                        <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0' }}>
                            {(() => {
                                const ext = viewingDoc.file_url?.split('.').pop()?.split('?')[0]?.toLowerCase();
                                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                                    return (
                                        <img
                                            src={viewingDoc.file_url}
                                            alt={viewingDoc.title}
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        />
                                    );
                                }
                                // Native Browser Support (PDF, Text, HTML)
                                else if (['pdf', 'txt', 'html', 'htm', 'md', 'json'].includes(ext)) {
                                    return (
                                        <iframe
                                            src={viewingDoc.file_url}
                                            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
                                            title="Document Preview"
                                        />
                                    );
                                }
                                // Office Documents (Google Docs Viewer)
                                else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) {
                                    const encodedUrl = encodeURIComponent(viewingDoc.file_url);
                                    return (
                                        <iframe
                                            src={`https://docs.google.com/gview?url=${encodedUrl}&embedded=true`}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="Office Document Preview"
                                        />
                                    );
                                } else {
                                    return (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <div style={{
                                                width: '80px', height: '80px', borderRadius: '50%',
                                                backgroundColor: '#e2e8f0', color: '#64748b',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 20px auto'
                                            }}>
                                                <FileText size={40} />
                                            </div>
                                            <h4 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                                                Preview not available
                                            </h4>
                                            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                                                This file type cannot be previewed directly.
                                            </p>
                                            <a
                                                href={viewingDoc.file_url}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                    padding: '10px 20px', borderRadius: '8px',
                                                    backgroundColor: '#3b82f6', color: 'white',
                                                    textDecoration: 'none', fontWeight: 600
                                                }}
                                            >
                                                <Download size={18} /> Download File
                                            </a>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDocuments;
