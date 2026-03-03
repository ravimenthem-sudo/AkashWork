import React, { useState, useEffect } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export const AddPolicyModal = ({ isOpen, onClose, onSuccess, orgId }) => {
    const [formData, setFormData] = useState({
        title: '',
        category: 'General Policy',
        effective_date: new Date().toISOString().split('T')[0],
        status: 'Active'
    });
    const [customCategory, setCustomCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [policyFile, setPolicyFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Fetch categories from database
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // Try to fetch from a 'policy_categories' table first
                const { data, error } = await supabase
                    .from('policy_categories')
                    .select('name')
                    .eq('org_id', orgId)
                    .order('name');

                if (data && data.length > 0) {
                    setCategories(data.map(c => c.name));
                } else {
                    // Fallback to default categories if table doesn't exist or is empty
                    // Also fetch distinct categories already used in policies to be dynamic
                    const { data: policiesData } = await supabase
                        .from('policies')
                        .select('category')
                        .eq('org_id', orgId);

                    const usedCategories = policiesData ? [...new Set(policiesData.map(p => p.category))] : [];
                    const defaultCategories = [
                        'General Policy',
                        'HR Policy',
                        'IT Policy',
                        'Finance Policy',
                        'Compliance Policy',
                        'POSH (Prevention of Sexual Harassment)',
                        'Operations Policy'
                    ];

                    // Combine defaults and used categories, remove duplicates
                    const allCategories = [...new Set([...defaultCategories, ...usedCategories])].sort();
                    setCategories(allCategories);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
                // Fallback defaults
                setCategories([
                    'General Policy',
                    'HR Policy',
                    'IT Policy',
                    'Finance Policy',
                    'Compliance Policy',
                    'POSH (Prevention of Sexual Harassment)',
                    'Operations Policy'
                ]);
            }
        };
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen, orgId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (file.type !== 'application/pdf') {
                alert('Please upload a PDF file');
                return;
            }
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('File size should not exceed 10MB');
                return;
            }
            setPolicyFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!policyFile) {
            alert('Please upload a policy document');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // 1. Upload file to Supabase Storage
            const fileExt = policyFile.name.split('.').pop();
            const fileName = `${Date.now()}_${formData.title.replace(/\s+/g, '_')}.${fileExt}`;
            const filePath = `${fileName}`;

            setUploadProgress(30);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('policies')
                .upload(filePath, policyFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Failed to upload file: ${uploadError.message}`);
            }

            setUploadProgress(60);

            // 2. Verify the file exists and get public URL
            const { data: fileList, error: listError } = await supabase.storage
                .from('policies')
                .list('', {
                    limit: 1,
                    search: fileName
                });

            if (listError) {
                console.error('Error verifying file:', listError);
            }

            // Get public URL for the uploaded file
            const { data: { publicUrl } } = supabase.storage
                .from('policies')
                .getPublicUrl(filePath);

            console.log('File uploaded successfully!');
            console.log('File path:', filePath);
            console.log('Public URL:', publicUrl);
            console.log('File exists in bucket:', fileList && fileList.length > 0);

            // Verify the URL is accessible
            if (!publicUrl || !publicUrl.includes('policies')) {
                throw new Error('Invalid file URL generated. Please check bucket configuration.');
            }

            setUploadProgress(80);

            // 3. Insert policy record into database
            const { data: policyData, error: dbError } = await supabase
                .from('policies')
                .insert([
                    {
                        title: formData.title,
                        category: formData.category === 'Other' ? customCategory : formData.category,
                        effective_date: formData.effective_date,
                        status: formData.status,
                        file_url: publicUrl,
                        org_id: orgId
                    }
                ])
                .select();

            if (dbError) {
                console.error('Database error:', dbError);
                // If database insert fails, try to delete the uploaded file
                await supabase.storage.from('policies').remove([filePath]);
                throw new Error(`Failed to save policy: ${dbError.message}`);
            }

            setUploadProgress(100);

            // Success!
            console.log('Policy created successfully:', policyData);

            // 4. Send Notification to All Employees
            const { data: allEmployees } = await supabase
                .from('profiles')
                .select('id')
                .eq('org_id', orgId);

            if (allEmployees && allEmployees.length > 0) {
                const { data: { user } } = await supabase.auth.getUser();
                const notificationMessage = `New policy added: ${formData.title}`;

                const notifications = allEmployees.map(emp => ({
                    receiver_id: emp.id,
                    sender_id: user?.id,
                    sender_name: 'HR Department',
                    message: notificationMessage,
                    type: 'policy',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                }));

                const { error: notifError } = await supabase.from('notifications').insert(notifications);
                if (notifError) console.error('Error sending policy notifications:', notifError);
            }

            // Reset form
            setFormData({
                title: '',
                category: 'General Policy',
                effective_date: new Date().toISOString().split('T')[0],
                status: 'Active'
            });
            setCustomCategory('');
            setPolicyFile(null);

            // Call success callback
            if (onSuccess) {
                onSuccess(policyData[0]);
            }

            // Close modal
            onClose();

        } catch (error) {
            console.error('Error creating policy:', error);
            alert(error.message || 'Failed to create policy. Please try again.');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleClose = () => {
        if (!isUploading) {
            setFormData({
                title: '',
                category: 'General Policy',
                effective_date: new Date().toISOString().split('T')[0],
                status: 'Active'
            });
            setPolicyFile(null);
            onClose();
        }
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
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: 'var(--shadow-lg)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Add New Policy</h2>
                    <button
                        onClick={handleClose}
                        disabled={isUploading}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isUploading ? 0.5 : 1
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    {/* Policy Title */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}>
                            Policy Title <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            disabled={isUploading}
                            placeholder="e.g., Work From Home Policy"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.875rem',
                                backgroundColor: isUploading ? '#f5f5f5' : 'white'
                            }}
                        />
                    </div>

                    {/* Category */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}>
                            Category <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            required
                            disabled={isUploading}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.875rem',
                                backgroundColor: isUploading ? '#f5f5f5' : 'white'
                            }}
                        >
                            {categories.map((cat, index) => (
                                <option key={index} value={cat}>{cat}</option>
                            ))}
                            <option value="Other">Other</option>
                        </select>
                        {formData.category === 'Other' && (
                            <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="Enter custom category"
                                required
                                disabled={isUploading}
                                style={{
                                    width: '100%',
                                    marginTop: '8px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.875rem',
                                    backgroundColor: isUploading ? '#f5f5f5' : 'white'
                                }}
                            />
                        )}
                    </div>

                    {/* Effective Date */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}>
                            Effective Date <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            type="date"
                            name="effective_date"
                            value={formData.effective_date}
                            onChange={handleInputChange}
                            required
                            disabled={isUploading}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.875rem',
                                backgroundColor: isUploading ? '#f5f5f5' : 'white'
                            }}
                        />
                    </div>

                    {/* Status */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}>
                            Status <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            required
                            disabled={isUploading}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.875rem',
                                backgroundColor: isUploading ? '#f5f5f5' : 'white'
                            }}
                        >
                            <option value="Active">Active</option>
                            <option value="Draft">Draft</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    {/* File Upload */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}>
                            Policy Document (PDF) <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <div style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '8px',
                            padding: '24px',
                            textAlign: 'center',
                            backgroundColor: isUploading ? '#f5f5f5' : '#fafafa'
                        }}>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                style={{ display: 'none' }}
                                id="policy-file-upload"
                            />
                            <label
                                htmlFor="policy-file-upload"
                                style={{
                                    cursor: isUploading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                            >
                                {policyFile ? (
                                    <>
                                        <FileText size={48} color="var(--accent)" />
                                        <div>
                                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>{policyFile.name}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {(policyFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        {!isUploading && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                                                Click to change file
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Upload size={48} color="var(--text-secondary)" />
                                        <div>
                                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                                                Click to upload or drag and drop
                                            </p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                PDF files only (Max 10MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Upload Progress */}
                    {isUploading && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                                fontSize: '0.875rem'
                            }}>
                                <span>Uploading...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                backgroundColor: '#e5e7eb',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${uploadProgress}%`,
                                    height: '100%',
                                    backgroundColor: 'var(--accent)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                        paddingTop: '20px',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isUploading}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'white',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                opacity: isUploading ? 0.5 : 1
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !policyFile}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isUploading || !policyFile ? '#ccc' : 'var(--primary)',
                                color: 'white',
                                cursor: isUploading || !policyFile ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            {isUploading ? 'Creating...' : 'Create Policy'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
