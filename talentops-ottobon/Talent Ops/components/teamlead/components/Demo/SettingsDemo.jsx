import React, { useState, useEffect } from 'react';
import { User, Mail, Users, Lock, Eye, EyeOff, Save, Shield, Edit2, Phone, MapPin, Camera } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';

const SettingsDemo = () => {
    const [userProfile, setUserProfile] = useState(null);
    const [teamName, setTeamName] = useState('');
    const [departmentName, setDepartmentName] = useState('');
    const [projectRoles, setProjectRoles] = useState([]);
    const [compensationData, setCompensationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editedProfile, setEditedProfile] = useState({});
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showCompensation, setShowCompensation] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    const handlePhotoUpload = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'File size must be less than 10MB' });
                return;
            }

            setUploadingPhoto(true);

            const fileExt = file.name.split('.').pop();
            const fileName = `${userProfile.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update Profile via RPC
            const { data: rpcData, error: updateError } = await supabase.rpc('update_my_profile', {
                p_phone: userProfile.phone || '',
                p_location: userProfile.location || '',
                p_avatar_url: publicUrl
            });

            if (updateError) throw updateError;
            if (rpcData && !rpcData.success) throw new Error(rpcData.error);

            // Update local state
            setUserProfile({ ...userProfile, avatar_url: publicUrl });
            setEditedProfile({ ...editedProfile, avatar_url: publicUrl });
            setMessage({ type: 'success', text: 'Profile photo updated successfully!' });

        } catch (error) {
            console.error('Error uploading photo:', error);
            setMessage({ type: 'error', text: 'Failed to upload profile photo' });
        } finally {
            setUploadingPhoto(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const { data: rpcResponse, error } = await supabase.rpc('get_my_profile_details');

            if (error) throw error;
            if (rpcResponse && !rpcResponse.success) throw new Error(rpcResponse.error);

            const profileData = rpcResponse.data;

            if (profileData) {
                // Populate profile state
                const fullProfile = {
                    ...profileData,
                    id: profileData.id,
                    email: profileData.email,
                    full_name: profileData.full_name,
                    phone: profileData.phone,
                    location: profileData.location,
                    avatar_url: profileData.avatar_url,
                    role: profileData.role,
                    job_title: profileData.job_title,
                    employment_type: profileData.employment_type,
                    department: profileData.department_name
                };

                setUserProfile(fullProfile);
                setEditedProfile(fullProfile);

                setDepartmentName(profileData.department_name);

                const allProjects = [];
                if (profileData.primary_project) {
                    allProjects.push({
                        projectName: profileData.primary_project,
                        role: 'Member'
                    });
                }

                if (profileData.project_assignments && profileData.project_assignments.length > 0) {
                    const additionalProjects = profileData.project_assignments
                        .filter(p => p.projectName !== profileData.primary_project)
                        .map(p => ({
                            projectName: p.projectName,
                            role: p.role || 'Member'
                        }));
                    allProjects.push(...additionalProjects);
                }

                if (allProjects.length > 0) {
                    setProjectRoles(allProjects);
                }

                if (profileData.compensation) {
                    setCompensationData(profileData.compensation);
                }
            }
        } catch (error) {
            console.error('Error fetching profile via RPC:', error);
            setMessage({ type: 'error', text: 'Failed to load profile data' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            // Update Profile via RPC
            const { data, error } = await supabase.rpc('update_my_profile', {
                p_phone: editedProfile.phone,
                p_location: editedProfile.location,
                p_avatar_url: null
            });

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else if (data && !data.success) {
                setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
            } else {
                setUserProfile(editedProfile);
                setEditMode(false);
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile' });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        // Validation
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match!' });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters long!' });
            return;
        }

        try {
            // Update password using Supabase Auth
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'success', text: 'Password updated successfully!' });
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                setShowPasswordForm(false);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update password' });
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading settings...
            </div>
        );
    }

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '8px' }}>
                    Profile Settings
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Manage your profile information and security settings
                </p>
            </div>

            {/* Message */}
            {message.text && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: '24px'
                }}>
                    {message.text}
                </div>
            )}

            {/* Profile Information Card */}
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={24} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Profile Information</h3>
                    </div>
                    {!editMode ? (
                        <button
                            onClick={() => setEditMode(true)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.875rem'
                            }}
                        >
                            <Edit2 size={14} />
                            Edit Contact Info
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleSaveProfile}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.875rem'
                                }}
                            >
                                <Save size={14} />
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setEditMode(false);
                                    setEditedProfile(userProfile);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile Photo Section */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '4px solid white',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            backgroundColor: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {userProfile?.avatar_url ? (
                                <img
                                    src={userProfile.avatar_url}
                                    alt="Profile"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <User size={64} color="#94a3b8" />
                            )}
                        </div>
                        <label
                            htmlFor="profile-photo-upload"
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                right: '0',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                padding: '8px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'transform 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Camera size={16} />
                        </label>
                        <input
                            id="profile-photo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            style={{ display: 'none' }}
                            disabled={uploadingPhoto}
                        />
                    </div>
                    {uploadingPhoto && <p style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Uploading...</p>}
                    <p style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Allowed JPG, GIF or PNG. Max size of 10MB</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Full Name */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Full Name
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {userProfile?.full_name || 'N/A'}
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            <Mail size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Email Address
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {userProfile?.email || 'N/A'}
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            <Phone size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Phone Number
                        </label>
                        {editMode ? (
                            <input
                                type="tel"
                                value={editedProfile.phone || ''}
                                onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                                placeholder="Enter phone number"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    fontSize: '0.95rem'
                                }}
                            />
                        ) : (
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontWeight: 500
                            }}>
                                {userProfile?.phone || 'Not provided'}
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            <MapPin size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Location
                        </label>
                        {editMode ? (
                            <input
                                type="text"
                                value={editedProfile.location || ''}
                                onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                                placeholder="Enter location"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    fontSize: '0.95rem'
                                }}
                            />
                        ) : (
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontWeight: 500
                            }}>
                                {userProfile?.location || 'Not provided'}
                            </div>
                        )}
                    </div>

                    {/* Role */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Role
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            textTransform: 'capitalize'
                        }}>
                            {userProfile?.role || 'N/A'}
                        </div>
                    </div>

                    {/* Team */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            <Users size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Team
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {teamName || 'No team assigned'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Work Information Card */}
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Users size={24} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Work Information</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Job Title */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Job Title
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {userProfile?.job_title || 'Not assigned'}
                        </div>
                    </div>

                    {/* Employment Type */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Employment Type
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {userProfile?.employment_type || 'Not specified'}
                        </div>
                    </div>

                    {/* Department */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Department
                        </label>
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--background)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}>
                            {departmentName || 'Not assigned'}
                        </div>
                    </div>

                    {/* Project */}
                    <div style={{ gridColumn: projectRoles.length > 1 ? '1 / -1' : 'auto' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: '8px'
                        }}>
                            Project{projectRoles.length > 1 ? 's' : ''}
                        </label>
                        {projectRoles.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {projectRoles.map((assignment, index) => (
                                    <div key={index} style={{
                                        padding: '12px 16px',
                                        backgroundColor: 'var(--background)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 500,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>{assignment.projectName}</span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            backgroundColor: '#e0f2fe',
                                            color: '#075985',
                                            fontWeight: 600
                                        }}>
                                            {assignment.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                color: 'var(--text-secondary)',
                                fontWeight: 500,
                                fontStyle: 'italic'
                            }}>
                                No project assigned
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Compensation Details Card */}
            {compensationData && (
                <div style={{
                    backgroundColor: 'var(--surface)',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Compensation Details</h3>
                        <button
                            onClick={() => setShowCompensation(!showCompensation)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: showCompensation ? 'var(--primary)' : 'var(--background)',
                                color: showCompensation ? 'white' : 'var(--text-primary)',
                                border: showCompensation ? 'none' : '1px solid var(--border)',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.875rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!showCompensation) {
                                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!showCompensation) {
                                    e.currentTarget.style.backgroundColor = 'var(--background)';
                                }
                            }}
                        >
                            {showCompensation ? <EyeOff size={16} /> : <Eye size={16} />}
                            {showCompensation ? 'Hide Details' : 'View Details'}
                        </button>
                    </div>

                    {showCompensation && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Basic Salary */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    Basic Salary
                                </span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    ₹{compensationData.basic_salary?.toLocaleString('en-IN') || '0'}
                                </span>
                            </div>

                            {/* House Rent Allowance */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    House Rent Allowance
                                </span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    ₹{compensationData.hra?.toLocaleString('en-IN') || '0'}
                                </span>
                            </div>

                            {/* Other Allowances */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    Other Allowances
                                </span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    ₹{compensationData.allowances?.toLocaleString('en-IN') || '0'}
                                </span>
                            </div>

                            {/* Total Monthly Compensation */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '20px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                border: '2px solid #e2e8f0',
                                marginTop: '8px'
                            }}>
                                <span style={{ fontSize: '1.1rem', color: '#1e293b', fontWeight: 700 }}>
                                    Total Monthly Compensation
                                </span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                                    ₹{((compensationData.basic_salary || 0) + (compensationData.hra || 0) + (compensationData.allowances || 0)).toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Security Settings Card */}
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Shield size={24} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Security</h3>
                </div>

                {!showPasswordForm ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>Password</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Last updated: Recently
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPasswordForm(true)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Lock size={16} />
                                Change Password
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handlePasswordChange}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Current Password */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '8px'
                                }}>
                                    Current Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.current ? 'text' : 'password'}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px 40px 12px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: '0.95rem'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '8px'
                                }}>
                                    New Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px 40px 12px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: '0.95rem'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '8px'
                                }}>
                                    Confirm New Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px 40px 12px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: '0.95rem'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Message */}
                            {message.text && (
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                                    color: message.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.875rem',
                                    fontWeight: 500
                                }}>
                                    {message.text}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '12px 20px',
                                        backgroundColor: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Save size={16} />
                                    Update Password
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordForm(false);
                                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        setMessage({ type: '', text: '' });
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px 20px',
                                        backgroundColor: 'var(--background)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SettingsDemo;
