import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Users,
    Calendar,
    DollarSign,
    AlertTriangle,
    Plus,
    Filter,
    Search,
    X,
    Clock
} from 'lucide-react';

// ================================
// PROJECT ANALYTICS - Main Component
// ================================
const ProjectAnalytics = ({ userRole = 'manager', dashboardPrefix = '/manager-dashboard', orgId }) => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('financials');
    const [showFinancialModal, setShowFinancialModal] = useState(false);
    const [savingFinancial, setSavingFinancial] = useState(false);
    const [financialForm, setFinancialForm] = useState({
        period_label: '',
        period_start: '',
        period_end: '',
        revenue: '',
        salary_cost: '',
        other_costs: ''
    });

    const isExecutive = userRole.toLowerCase() === 'executive';

    useEffect(() => {
        if (orgId) {
            fetchProjects();
        }
    }, [orgId]);

    const fetchProjects = async () => {
        try {
            setLoading(true);

            // Try fetching with all analytics columns first
            let { data, error } = await supabase
                .from('projects')
                .select(`
                    id,
                    name,
                    description,
                    status,
                    start_date,
                    end_date,
                    total_budget,
                    total_revenue,
                    total_cost,
                    owner_id
                `)
                .eq('org_id', orgId)
                .order('name');

            // If error (likely missing columns), fallback to basic query
            if (error) {
                console.warn('Full query failed, trying basic query:', error.message);
                const basicResult = await supabase
                    .from('projects')
                    .select('id, name')
                    .eq('org_id', orgId)
                    .order('name');

                data = basicResult.data;
                error = basicResult.error;

                if (error) throw error;
            }

            // Fetch member counts and owner names for each project
            const projectsWithMembers = await Promise.all(
                (data || []).map(async (project) => {
                    // Get member count from project_members table (members are linked via project_id)
                    const { count } = await supabase
                        .from('project_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('project_id', project.id);

                    // Get owner name if owner_id exists
                    let managerName = 'Unassigned';
                    if (project.owner_id) {
                        const { data: ownerData } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', project.owner_id)
                            .single();
                        managerName = ownerData?.full_name || 'Unassigned';
                    }

                    return {
                        ...project,
                        name: project.name,
                        description: project.description || '',
                        status: project.status || 'active',
                        start_date: project.start_date || null,
                        end_date: project.end_date || null,
                        total_budget: project.total_budget || 0,
                        total_revenue: project.total_revenue || 0,
                        total_cost: project.total_cost || 0,
                        manager_name: managerName,
                        member_count: count || 0,
                        net_profit: (project.total_revenue || 0) - (project.total_cost || 0)
                    };
                })
            );

            setProjects(projectsWithMembers);
            setError(null);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError(err.message || 'Failed to load projects');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(project => {
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
        const matchesSearch = project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.description?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return { bg: '#dcfce7', text: '#16a34a' };
            case 'completed': return { bg: '#dbeafe', text: '#2563eb' };
            case 'on_hold': return { bg: '#fef3c7', text: '#d97706' };
            case 'cancelled': return { bg: '#fee2e2', text: '#dc2626' };
            default: return { bg: '#f1f5f9', text: '#64748b' };
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    // Save financial entry
    const saveFinancialEntry = async () => {
        if (!selectedProject || !financialForm.period_start || !financialForm.period_end) {
            alert('Please fill in required fields (dates)');
            return;
        }

        setSavingFinancial(true);
        try {
            const { error } = await supabase
                .from('team_financials')
                .insert({
                    team_id: selectedProject.id,
                    period_type: 'monthly',
                    period_label: financialForm.period_label || null,
                    period_start: financialForm.period_start,
                    period_end: financialForm.period_end,
                    revenue: parseFloat(financialForm.revenue) || 0,
                    salary_cost: parseFloat(financialForm.salary_cost) || 0,
                    other_costs: parseFloat(financialForm.other_costs) || 0
                });

            if (error) throw error;

            // Update team totals
            const newRevenue = parseFloat(financialForm.revenue) || 0;
            const newCost = parseFloat(financialForm.salary_cost) + parseFloat(financialForm.other_costs) || 0;

            await supabase
                .from('projects')
                .update({
                    total_revenue: (selectedProject.total_revenue || 0) + newRevenue,
                    total_cost: (selectedProject.total_cost || 0) + newCost,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedProject.id);

            // Reset form and close modal
            setFinancialForm({
                period_label: '',
                period_start: '',
                period_end: '',
                revenue: '',
                salary_cost: '',
                other_costs: ''
            });
            setShowFinancialModal(false);

            // Refresh data
            fetchProjects();
            // Trigger detail refresh by resetting selected project
            const updatedProject = {
                ...selectedProject,
                total_revenue: (selectedProject.total_revenue || 0) + newRevenue,
                total_cost: (selectedProject.total_cost || 0) + newCost
            };
            setSelectedProject(updatedProject);
        } catch (error) {
            console.error('Error saving financial entry:', error);
            alert('Error saving financial entry: ' + error.message);
        } finally {
            setSavingFinancial(false);
        }
    };

    // ================================
    // Project List View
    // ================================
    const ProjectListView = () => {
        // Calculate summary stats
        const totalProjects = projects.length;
        const activeProjects = projects.filter(p => p.status === 'active').length;
        const totalRevenue = projects.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
        const totalProfit = projects.reduce((sum, p) => sum + (p.net_profit || 0), 0);

        return (
            <div>
                {/* Premium Header Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                    marginBottom: '24px'
                }}>
                    {/* SVG Mesh Pattern Overlay */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="mesh-project-list" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#mesh-project-list)" />
                        </svg>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                                <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Project Analytics</span>
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                                Project Analytics
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                                Financial performance and resource allocation overview
                            </p>
                        </div>

                        {isExecutive && (
                            <button style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.2s'
                            }}>
                                <Plus size={16} />
                                Add Project
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Stats Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    {[
                        { label: 'Total Projects', value: totalProjects, icon: '📊', color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'Active Projects', value: activeProjects, icon: '🚀', color: '#10b981', bg: '#ecfdf5' },
                        { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: '💰', color: '#16a34a', bg: '#f0fdf4' },
                        { label: 'Net Profit', value: formatCurrency(totalProfit), icon: totalProfit >= 0 ? '📈' : '📉', color: totalProfit >= 0 ? '#16a34a' : '#dc2626', bg: totalProfit >= 0 ? '#f0fdf4' : '#fef2f2' }
                    ].map((stat, idx) => (
                        <div key={idx} style={{
                            backgroundColor: 'white',
                            borderRadius: '14px',
                            padding: '20px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: stat.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.4rem'
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{stat.label}</p>
                                <p style={{ fontSize: '1.25rem', fontWeight: '700', color: stat.color, margin: 0 }}>{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters Section */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '24px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    backgroundColor: 'white',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0'
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#94a3b8'
                        }} />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 44px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '0.9rem',
                                backgroundColor: '#f8fafc',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>

                    {/* Status Filter Pills */}
                    <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                        {['all', 'active', 'completed', 'on_hold'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: statusFilter === status ? '#0f172a' : 'transparent',
                                    color: statusFilter === status ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {status === 'all' ? 'All' : status === 'on_hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Project Cards Grid */}
                {loading ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 40px',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
                        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading projects...</p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 40px',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.5rem' }}>📁</div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>No projects found</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Try adjusting your search or filter criteria</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px'
                    }}>
                        {filteredProjects.map(project => {
                            const statusStyle = getStatusColor(project.status);
                            const isProfitable = project.net_profit >= 0;

                            return (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                                        e.currentTarget.style.borderColor = '#3b82f6';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                >
                                    {/* Top Accent Line */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '3px',
                                        background: isProfitable ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #ef4444, #dc2626)'
                                    }}></div>

                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.3 }}>
                                                {project.name}
                                            </h3>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Users size={12} />
                                                {project.manager_name}
                                            </p>
                                        </div>
                                        <span style={{
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            backgroundColor: statusStyle.bg,
                                            color: statusStyle.text,
                                            textTransform: 'capitalize'
                                        }}>
                                            {(project.status || 'active').replace('_', ' ')}
                                        </span>
                                    </div>

                                    {/* Duration */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '16px',
                                        padding: '10px 12px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '10px',
                                        color: '#64748b',
                                        fontSize: '0.8rem'
                                    }}>
                                        <Calendar size={14} />
                                        <span>
                                            {project.start_date
                                                ? new Date(project.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                                                : 'Not set'
                                            }
                                            {project.end_date && ` → ${new Date(project.end_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                                        </span>
                                    </div>

                                    {/* Financial Summary */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <div style={{
                                            padding: '14px',
                                            backgroundColor: '#f0fdf4',
                                            borderRadius: '10px',
                                            borderLeft: '3px solid #10b981'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Revenue</div>
                                            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#16a34a' }}>
                                                {formatCurrency(project.total_revenue)}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '14px',
                                            backgroundColor: '#fef2f2',
                                            borderRadius: '10px',
                                            borderLeft: '3px solid #ef4444'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Cost</div>
                                            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#dc2626' }}>
                                                {formatCurrency(project.total_cost)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profit/Loss & Team */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingTop: '16px',
                                        borderTop: '1px solid #f1f5f9'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '8px',
                                                backgroundColor: isProfitable ? '#f0fdf4' : '#fef2f2',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {isProfitable ? <TrendingUp size={14} color="#16a34a" /> : <TrendingDown size={14} color="#dc2626" />}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: '700', color: isProfitable ? '#16a34a' : '#dc2626', fontSize: '0.95rem' }}>
                                                    {formatCurrency(Math.abs(project.net_profit))}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '4px' }}>
                                                    {isProfitable ? 'profit' : 'loss'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            backgroundColor: '#f1f5f9',
                                            borderRadius: '20px',
                                            color: '#64748b'
                                        }}>
                                            <Users size={14} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{project.member_count}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    };

    // ================================
    // Project Detail View
    // ================================
    const ProjectDetailView = () => {
        const [teamMembers, setTeamMembers] = useState([]);
        const [financials, setFinancials] = useState([]);
        const [loadingDetails, setLoadingDetails] = useState(true);

        useEffect(() => {
            if (selectedProject) {
                fetchProjectDetails();
            }
        }, [selectedProject]);

        const fetchProjectDetails = async () => {
            setLoadingDetails(true);
            try {
                // Fetch project members from project_members table joined with profiles
                const { data: memberAssignments, error: memberError } = await supabase
                    .from('project_members')
                    .select(`
                        id,
                        user_id,
                        role,
                        joined_at,
                        profiles:user_id(id, full_name, email, role)
                    `)
                    .eq('project_id', selectedProject.id);

                // Debug: Log query results
                console.log('Project members query result:', { memberAssignments, memberError });

                if (memberError) {
                    console.error('Error fetching project members:', memberError);
                }

                // Map assignments to expected member format
                const members = (memberAssignments || []).map(assignment => ({
                    id: assignment.id,
                    profile_id: assignment.user_id,
                    assignment_start: assignment.joined_at || selectedProject.start_date || new Date().toISOString().split('T')[0],
                    assignment_end: null, // Ongoing
                    role_in_project: assignment.role?.toLowerCase() || 'other',
                    profiles: assignment.profiles
                }));

                console.log('Mapped members:', members);
                setTeamMembers(members);

                // Fetch financials (may not exist if SQL hasn't been run)
                try {
                    const { data: fins, error: finsError } = await supabase
                        .from('team_financials')
                        .select('*')
                        .eq('team_id', selectedProject.id)
                        .order('period_start');

                    if (!finsError) {
                        setFinancials(fins || []);
                    } else {
                        console.warn('team_financials table not found:', finsError.message);
                        setFinancials([]);
                    }
                } catch (e) {
                    console.warn('Could not fetch financials:', e);
                    setFinancials([]);
                }
            } catch (error) {
                console.error('Error fetching project details:', error);
            } finally {
                setLoadingDetails(false);
            }
        };

        const statusStyle = getStatusColor(selectedProject?.status);
        const isProfitable = (selectedProject?.net_profit || 0) >= 0;

        return (
            <div>
                {/* Premium Header Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                    marginBottom: '24px'
                }}>
                    {/* SVG Mesh Pattern Overlay */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="mesh-project-detail" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#mesh-project-detail)" />
                        </svg>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Back Button */}
                        <button
                            onClick={() => setSelectedProject(null)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                marginBottom: '16px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ArrowLeft size={14} />
                            Back to Projects
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                    <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>
                                        {selectedProject?.name}
                                    </h1>
                                    <span style={{
                                        padding: '5px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        backgroundColor: statusStyle.bg,
                                        color: statusStyle.text,
                                        textTransform: 'capitalize'
                                    }}>
                                        {(selectedProject?.status || 'active').replace('_', ' ')}
                                    </span>
                                </div>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Users size={14} />
                                    Managed by <span style={{ color: '#22d3ee', fontWeight: '600' }}>{selectedProject?.manager_name}</span>
                                </p>
                            </div>

                            {/* Quick Stats in Banner */}
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    textAlign: 'center'
                                }}>
                                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Duration</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        {selectedProject?.start_date
                                            ? new Date(selectedProject.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                                            : 'Not set'}
                                    </p>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    backdropFilter: 'blur(10px)',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    textAlign: 'center'
                                }}>
                                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Team Size</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white' }}>{teamMembers.length} Members</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Summary Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    {[
                        {
                            label: 'Total Revenue',
                            value: formatCurrency(selectedProject?.total_revenue),
                            icon: '💰',
                            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            bg: '#ecfdf5'
                        },
                        {
                            label: 'Total Cost',
                            value: formatCurrency(selectedProject?.total_cost),
                            icon: '📊',
                            gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            bg: '#fef2f2'
                        },
                        {
                            label: 'Net Profit',
                            value: formatCurrency(selectedProject?.net_profit),
                            icon: isProfitable ? '📈' : '📉',
                            gradient: isProfitable ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            bg: isProfitable ? '#ecfdf5' : '#fef2f2'
                        },
                        {
                            label: 'ROI',
                            value: selectedProject?.total_cost > 0
                                ? `${((selectedProject?.net_profit / selectedProject?.total_cost) * 100).toFixed(1)}%`
                                : 'N/A',
                            icon: '🎯',
                            gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            bg: '#eff6ff'
                        }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '20px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Top Accent */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: stat.gradient
                            }}></div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>{stat.value}</p>
                                </div>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    backgroundColor: stat.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem'
                                }}>
                                    {stat.icon}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Premium Tabs */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '0',
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        padding: '0 8px'
                    }}>
                        {[
                            { id: 'financials', label: 'Financials', icon: DollarSign },
                            { id: 'team', label: 'Team & Resources', icon: Users },
                            { id: 'timeline', label: 'Timeline', icon: Calendar },
                            { id: 'time', label: 'Time & Effort', icon: Clock }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === tab.id ? 'white' : 'transparent',
                                    fontSize: '0.9rem',
                                    fontWeight: activeTab === tab.id ? '600' : '500',
                                    color: activeTab === tab.id ? '#0f172a' : '#64748b',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderRadius: activeTab === tab.id ? '12px 12px 0 0' : '0',
                                    marginBottom: activeTab === tab.id ? '-1px' : '0',
                                    borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div style={{ padding: '24px' }}>
                        {loadingDetails ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    border: '3px solid #e2e8f0',
                                    borderTopColor: '#3b82f6',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading details...</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'financials' && <FinancialsTab financials={financials} />}
                                {activeTab === 'team' && <TeamTab members={teamMembers} isExecutive={isExecutive} />}
                                {activeTab === 'timeline' && <TimelineTab project={selectedProject} members={teamMembers} />}
                                {activeTab === 'time' && <TimeTrackingTab teamId={selectedProject.id} />}
                            </>
                        )}
                    </div>
                </div>

                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    };

    // ================================
    // Financials Tab
    // ================================
    const FinancialsTab = ({ financials }) => {
        if (financials.length === 0) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 40px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '16px',
                    border: '1px dashed #cbd5e1'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        fontSize: '2rem'
                    }}>
                        💰
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>No Financial Data Yet</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', maxWidth: '300px', margin: '0 auto 20px' }}>
                        Start tracking revenue, costs, and profits for this project
                    </p>
                    {isExecutive && (
                        <button
                            onClick={() => setShowFinancialModal(true)}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Plus size={16} />
                            Add Financial Entry
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>Period</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>Revenue</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>Salary Cost</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>Other Costs</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.8rem' }}>Net Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {financials.map((fin, i) => (
                            <tr key={fin.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                                    {fin.period_label || new Date(fin.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#16a34a' }}>
                                    {formatCurrency(fin.revenue)}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#dc2626' }}>
                                    {formatCurrency(fin.salary_cost)}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#d97706' }}>
                                    {formatCurrency(fin.other_costs)}
                                </td>
                                <td style={{
                                    padding: '14px 16px',
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    color: fin.net_profit >= 0 ? '#16a34a' : '#dc2626'
                                }}>
                                    {formatCurrency(fin.net_profit)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // ================================
    // Team Tab
    // ================================
    const TeamTab = ({ members, isExecutive }) => {
        const hasAtRiskMembers = members.some(m => m.profiles?.employment_status === 'notice_period');

        const getRoleColor = (role) => {
            switch (role?.toLowerCase()) {
                case 'manager': return { bg: '#dbeafe', color: '#2563eb' };
                case 'team_lead': return { bg: '#fae8ff', color: '#a855f7' };
                case 'employee': return { bg: '#dcfce7', color: '#16a34a' };
                default: return { bg: '#f1f5f9', color: '#64748b' };
            }
        };

        if (members.length === 0) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 40px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '16px',
                    border: '1px dashed #cbd5e1'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        fontSize: '2rem'
                    }}>
                        👥
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>No Team Members</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                        No team members have been assigned to this project yet
                    </p>
                </div>
            );
        }

        return (
            <div>
                {hasAtRiskMembers && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        border: '1px solid #fecaca'
                    }}>
                        <AlertTriangle size={18} color="#dc2626" />
                        <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '0.9rem' }}>
                            Some team members are on notice period - resource gaps may occur
                        </span>
                    </div>
                )}

                {/* Team Stats */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        padding: '12px 20px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{ fontSize: '1.1rem' }}>👥</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Total:</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>{members.length}</span>
                    </div>
                </div>

                {/* Team Member Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {members.map((member) => {
                        const isOnNotice = member.profiles?.employment_status === 'notice_period';
                        const roleStyle = getRoleColor(member.role_in_project);
                        const initials = member.profiles?.full_name?.split(' ').map(n => n[0]).join('') || '??';

                        return (
                            <div key={member.id} style={{
                                backgroundColor: 'white',
                                borderRadius: '14px',
                                padding: '20px',
                                border: isOnNotice ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                transition: 'all 0.2s',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Top Accent */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: isOnNotice ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                }}></div>

                                <div style={{ display: 'flex', gap: '14px' }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: '700',
                                        fontSize: '1.1rem',
                                        flexShrink: 0
                                    }}>
                                        {initials}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                                                {member.profiles?.full_name}
                                            </h4>
                                            {isOnNotice && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: '700',
                                                    backgroundColor: '#dc2626',
                                                    color: 'white'
                                                }}>
                                                    <AlertTriangle size={10} />
                                                    NOTICE
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {member.profiles?.email}
                                        </p>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                backgroundColor: roleStyle.bg,
                                                color: roleStyle.color,
                                                textTransform: 'capitalize'
                                            }}>
                                                {(member.role_in_project || 'other').replace('_', ' ')}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} />
                                                {new Date(member.assignment_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ================================
    // Timeline Tab (Gantt-style)
    // ================================
    const TimelineTab = ({ project, members }) => {
        // Group members by role
        const roleGroups = members.reduce((acc, member) => {
            const role = member.role_in_project || 'other';
            if (!acc[role]) acc[role] = [];
            acc[role].push(member);
            return acc;
        }, {});

        const projectStart = project?.start_date ? new Date(project.start_date) : new Date();
        // Always show exactly 6 months from current date for timeline
        const now = new Date();
        const timelineStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
        const timelineEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0); // End of 6th month

        // Generate exactly 6 months array
        const months = [];
        let current = new Date(timelineStart);
        for (let i = 0; i < 6; i++) {
            months.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }

        // Use timeline end for project calculations
        const projectEnd = timelineEnd;

        const getBarStyle = (member, monthStart, monthEnd) => {
            const assignStart = new Date(member.assignment_start);
            const lastWorkingDay = member.profiles?.last_working_day
                ? new Date(member.profiles.last_working_day)
                : null;
            const assignEnd = member.assignment_end
                ? new Date(member.assignment_end)
                : projectEnd;

            const isOnNotice = member.profiles?.employment_status === 'notice_period';
            const effectiveEnd = isOnNotice && lastWorkingDay ? lastWorkingDay : assignEnd;

            // Check if this month is within assignment
            if (monthEnd < assignStart || monthStart > effectiveEnd) {
                // Check if this is a gap period (after last working day but before original assignment end)
                if (isOnNotice && lastWorkingDay && monthStart > lastWorkingDay && monthStart <= assignEnd) {
                    return { type: 'gap', color: '#ef4444' }; // Red for gap
                }
                return { type: 'empty' };
            }

            return { type: 'allocated', color: '#10b981' }; // Green for allocated
        };

        if (members.length === 0) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    color: '#64748b'
                }}>
                    <Calendar size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ margin: 0 }}>No team members to display timeline</p>
                </div>
            );
        }

        return (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'auto' }}>
                {/* Legend */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    padding: '16px',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: '#10b981', borderRadius: '4px' }}></div>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Allocated</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: '#ef4444', borderRadius: '4px' }}></div>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Resource Gap</span>
                    </div>
                </div>

                <div style={{ minWidth: `${150 + months.length * 80}px`, padding: '20px' }}>
                    {/* Header - Months */}
                    <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '150px', flexShrink: 0 }}></div>
                        {months.map((month, i) => (
                            <div key={i} style={{
                                width: '80px',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#64748b'
                            }}>
                                {month.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                            </div>
                        ))}
                    </div>

                    {/* Rows by Role */}
                    {Object.entries(roleGroups).map(([role, roleMembers]) => (
                        <div key={role}>
                            {/* Role Header */}
                            <div style={{
                                backgroundColor: '#f1f5f9',
                                padding: '8px 12px',
                                marginTop: '12px',
                                marginBottom: '4px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                textTransform: 'capitalize',
                                color: '#475569'
                            }}>
                                {role.replace('_', ' ')}
                            </div>

                            {/* Member Rows */}
                            {roleMembers.map(member => (
                                <div key={member.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{
                                        width: '150px',
                                        flexShrink: 0,
                                        fontSize: '0.85rem',
                                        padding: '8px 0',
                                        paddingLeft: '12px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {member.profiles?.full_name}
                                    </div>
                                    {months.map((month, i) => {
                                        const monthStart = new Date(month);
                                        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
                                        const barStyle = getBarStyle(member, monthStart, monthEnd);

                                        return (
                                            <div key={i} style={{
                                                width: '80px',
                                                height: '32px',
                                                padding: '4px 2px'
                                            }}>
                                                {barStyle.type !== 'empty' && (
                                                    <div style={{
                                                        height: '100%',
                                                        backgroundColor: barStyle.color,
                                                        borderRadius: '4px',
                                                        opacity: barStyle.type === 'gap' ? 0.7 : 1,
                                                        backgroundImage: barStyle.type === 'gap'
                                                            ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)'
                                                            : 'none'
                                                    }}></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ================================
    // Main Render
    // ================================

    // Show error state if there's an error
    if (error && !loading) {
        return (
            <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '24px',
                    textAlign: 'center',
                    maxWidth: '600px',
                    margin: '40px auto'
                }}>
                    <h2 style={{ color: '#dc2626', marginBottom: '12px' }}>Unable to Load Projects</h2>
                    <p style={{ color: '#991b1b', marginBottom: '16px' }}>{error}</p>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
                        If you haven't run the database migration yet, please execute the SQL in
                        <code style={{ backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                            database/project_analytics_setup.sql
                        </code> in your Supabase SQL Editor.
                    </p>
                    <button
                        onClick={() => { setError(null); setLoading(true); fetchProjects(); }}
                        style={{
                            padding: '10px 24px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ... inside ProjectAnalytics component ...

    // ================================
    // Time & Effort Tab (Auto-Calculated)
    // ================================
    const TimeTrackingTab = ({ teamId }) => {
        const [stats, setStats] = useState([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            fetchAutoStats();
        }, [teamId]);

        const fetchAutoStats = async () => {
            try {
                // 1. Fetch Tasks for this Project
                const { data: projectTasks, error: taskError } = await supabase
                    .from('tasks')
                    .select('id, assigned_to, status, created_at')
                    .eq('project_id', teamId);

                if (taskError) throw taskError;

                if (!projectTasks || projectTasks.length === 0) {
                    setStats([]);
                    setLoading(false);
                    return;
                }

                // 2. Identify Team Members involved
                const userIds = [...new Set(projectTasks.map(t => t.assigned_to).filter(Boolean))];

                if (userIds.length === 0) {
                    setStats([]);
                    setLoading(false);
                    return;
                }

                // 3. Fetch Profiles (now including role)
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .in('id', userIds);

                // 4. Fetch Global Tasks (All projects) to calculate Work Distribution Ratio
                const { data: globalTasks } = await supabase
                    .from('tasks')
                    .select('id, assigned_to')
                    .in('assigned_to', userIds);

                // 5. Fetch Attendance
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('employee_id, date, total_hours')
                    .in('employee_id', userIds);

                // 6. Calculate Metrics with Weighted Logic
                const calculatedStats = userIds.map(uid => {
                    const userProjectTasks = projectTasks.filter(t => t.assigned_to === uid);
                    const userTotalTasks = globalTasks?.filter(t => t.assigned_to === uid) || [];
                    const userAttendance = attendance?.filter(a => a.employee_id === uid) || [];

                    // Totals
                    const totalAttendanceHours = userAttendance.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) || 0), 0);
                    const completedTasks = userProjectTasks.filter(t => t.status === 'Completed').length;

                    // Weighted Calculation
                    // Formula: Total Attendance * (Project Tasks / Total Assigned Tasks)
                    const projectTaskCount = userProjectTasks.length;
                    const globalTaskCount = userTotalTasks.length;

                    let weightedHours = 0;
                    if (globalTaskCount > 0) {
                        // Prevent division by zero
                        weightedHours = totalAttendanceHours * (projectTaskCount / globalTaskCount);
                    }

                    return {
                        user_id: uid,
                        profile: profiles.find(p => p.id === uid),
                        project_task_count: projectTaskCount,
                        global_task_count: globalTaskCount,
                        completed_tasks: completedTasks,
                        days_present: userAttendance.length,
                        total_attendance_hours: totalAttendanceHours,
                        weighted_hours: weightedHours
                    };
                });

                setStats(calculatedStats);
            } catch (err) {
                console.error('Error fetching auto stats:', err);
            } finally {
                setLoading(false);
            }
        };

        if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Calculating metrics...</div>;

        if (stats.length === 0) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 40px',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px dashed #cbd5e1'
                }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%', background: '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                        color: '#94a3b8'
                    }}>
                        <Clock size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>No Activity Data</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        No tasks have been assigned or completed for this project yet.
                    </p>
                </div>
            );
        }

        // Helper component for Charts (Inlined here for scope access or define outside)


        return (
            <div>
                {/* Visual Analytics Sections */}
                <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
                    {/* Left: Main Chart Area */}
                    <div style={{
                        flex: 2,
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '24px',
                        border: '1px solid #eef2f6',
                        minHeight: '320px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Team Contribution</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Estimated hours per member based on task load</p>
                        </div>

                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                            {stats.map((stat) => (
                                <div key={stat.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <div
                                        title={`${stat.weighted_hours.toFixed(1)} hrs`}
                                        style={{
                                            width: '32px',
                                            height: `${Math.max((stat.weighted_hours / (stats.reduce((a, b) => Math.max(a, b.weighted_hours), 0) || 1)) * 150, 4)}px`,
                                            background: 'linear-gradient(to top, #3b82f6, #8b5cf6)',
                                            borderRadius: '20px 20px 6px 6px',
                                            opacity: 0.9,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s'
                                        }}
                                    ></div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textAlign: 'center', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {stat.profile?.full_name?.split(' ')[0] || 'User'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Key Metrics */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <StatCard
                            label="Total Project Hours"
                            value={stats.reduce((acc, curr) => acc + curr.weighted_hours, 0).toFixed(1)}
                            subLabel="hrs"
                            icon={<Clock size={20} />}
                            color="#3b82f6"
                        />
                        <StatCard
                            label="Avg. Burden"
                            value={`${(stats.reduce((acc, curr) => acc + (curr.project_task_count / (curr.global_task_count || 1)), 0) / stats.length * 100).toFixed(0)}%`}
                            subLabel="load"
                            icon={<TrendingUp size={20} />} // Assuming TrendingUp is imported, if not use ChartBar or Activity
                            color="#f59e0b"
                        />
                        <StatCard
                            label="Active Contributors"
                            value={stats.length}
                            icon={<Users size={20} />} // Assuming Users is imported
                            color="#10b981"
                        />
                    </div>
                </div>

                {/* Detailed Data Table */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Employee</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Role</th>
                                <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Project Burden</th>
                                <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Task Ratio</th>
                                <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Total Attendance</th>
                                <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Est. Project Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat) => (
                                <tr key={stat.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 500, color: '#0f172a' }}>{stat.profile?.full_name || 'Unknown'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{stat.profile?.email}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: stat.profile?.role === 'Executive' ? '#fef3c7' : stat.profile?.role === 'Manager' ? '#e0e7ff' : '#f1f5f9',
                                            color: stat.profile?.role === 'Executive' ? '#d97706' : stat.profile?.role === 'Manager' ? '#4f46e5' : '#64748b',
                                            border: `1px solid ${stat.profile?.role === 'Executive' ? '#fcd34d' : stat.profile?.role === 'Manager' ? '#c7d2fe' : '#e2e8f0'}`
                                        }}>
                                            {stat.profile?.role || 'Employee'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>
                                        {((stat.project_task_count / (stat.global_task_count || 1)) * 100).toFixed(0)}%
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
                                        {stat.project_task_count} / {stat.global_task_count}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: '#94a3b8' }}>
                                        {stat.total_attendance_hours.toFixed(1)}h
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                        {stat.weighted_hours.toFixed(1)}h
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    * Project Hours = Total Attendance × (Project Tasks / Total User Tasks)
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {selectedProject ? <ProjectDetailView /> : <ProjectListView />}

            {/* Add Financial Entry Modal */}
            {showFinancialModal && (
                // ... existing modal code ...
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.2)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '20px',
                            borderBottom: '1px solid #e2e8f0'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                                Add Financial Entry
                            </h2>
                            <button
                                onClick={() => setShowFinancialModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#64748b'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px' }}>
                            {/* ... Form inputs ... */}
                            <p style={{ color: '#64748b', marginBottom: '20px' }}>
                                Project: <strong>{selectedProject?.name}</strong>
                            </p>

                            {/* Period Label */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                    Period Label (optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., January 2025, Q1 2025"
                                    value={financialForm.period_label}
                                    onChange={(e) => setFinancialForm({ ...financialForm, period_label: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            {/* Date Range */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                        Period Start *
                                    </label>
                                    <input
                                        type="date"
                                        value={financialForm.period_start}
                                        onChange={(e) => setFinancialForm({ ...financialForm, period_start: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                        Period End *
                                    </label>
                                    <input
                                        type="date"
                                        value={financialForm.period_end}
                                        onChange={(e) => setFinancialForm({ ...financialForm, period_end: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Revenue */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                    Revenue (₹)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={financialForm.revenue}
                                    onChange={(e) => setFinancialForm({ ...financialForm, revenue: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            {/* Costs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                        Salary Cost (₹)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={financialForm.salary_cost}
                                        onChange={(e) => setFinancialForm({ ...financialForm, salary_cost: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                                        Other Costs (₹)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={financialForm.other_costs}
                                        onChange={(e) => setFinancialForm({ ...financialForm, other_costs: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Net Preview */}
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                textAlign: 'center'
                            }}>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Net Profit: </span>
                                <span style={{
                                    fontWeight: 'bold',
                                    color: (parseFloat(financialForm.revenue) || 0) - ((parseFloat(financialForm.salary_cost) || 0) + (parseFloat(financialForm.other_costs) || 0)) >= 0 ? '#16a34a' : '#dc2626'
                                }}>
                                    {formatCurrency((parseFloat(financialForm.revenue) || 0) - ((parseFloat(financialForm.salary_cost) || 0) + (parseFloat(financialForm.other_costs) || 0)))}
                                </span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowFinancialModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveFinancialEntry}
                                    disabled={savingFinancial}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: savingFinancial ? '#94a3b8' : '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: savingFinancial ? 'not-allowed' : 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {savingFinancial ? 'Saving...' : 'Save Entry'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper component for Charts
const StatCard = ({ label, value, subLabel, icon, color }) => (
    <div style={{
        backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', gap: '12px', flex: 1
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: `${color}15`, color: color }}>
                {icon}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{value}</h3>
            {subLabel && <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>{subLabel}</span>}
        </div>
    </div>
);

export default ProjectAnalytics;
