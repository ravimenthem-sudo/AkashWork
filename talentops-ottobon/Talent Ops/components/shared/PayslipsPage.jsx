import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Download, FileText, Calendar, DollarSign, Plus, Eye } from 'lucide-react';
import DataTable from '../employee/components/UI/DataTable';
import PayslipFormModal from './payslip/PayslipFormModal';

const PayslipsPage = ({ userRole, userId, addToast, orgId }) => {
    const [payslips, setPayslips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [savedCompanies, setSavedCompanies] = useState([]); // Lifted state for company details
    const [employees, setEmployees] = useState([]); // Lifted state for employee dropdown

    // Safe toast function
    const showToast = (message, type) => {
        if (addToast) {
            addToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    };

    useEffect(() => {
        // Only fetch if orgId is available
        if (!orgId || orgId === 'null' || orgId === 'undefined') {
            setLoading(false);
            return;
        }

        fetchPayslips();
    }, [userId, userRole, refreshTrigger, orgId]);

    // Fetch saved companies once on load to ensure instant dropdown availability
    const fetchSavedCompanies = async () => {
        if (!orgId) return;
        try {
            const { data, error } = await supabase
                .from('company_details')
                .select('*')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setSavedCompanies(data);
                localStorage.setItem(`savedCompanies_${orgId}`, JSON.stringify(data));
            }
        } catch (err) {
            console.error('Error fetching saved companies:', err);
        }
    };

    useEffect(() => {
        if (orgId) {
            // Load from cache first for instant display
            const cached = localStorage.getItem(`savedCompanies_${orgId}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setSavedCompanies(parsed);
                } catch (e) { console.warn('Cache parse error', e); }
            }

            fetchSavedCompanies();
            fetchEmployees();
        }
    }, [orgId]);

    const fetchEmployees = async () => {
        if (!orgId) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('org_id', orgId)
                .order('full_name');

            if (data) setEmployees(data);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    // Realtime Payslips
    useEffect(() => {
        const channel = supabase
            .channel('payslips-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'payslips',
                filter: `org_id=eq.${orgId}`
            }, (payload) => {
                console.log('Realtime Payslip Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId]);

    const fetchPayslips = async () => {
        // Prevent fetching if core user data is missing
        if (!userId || !userRole) {
            console.log('Waiting for user ID and Role...');
            return;
        }

        // Safety check: ensure orgId is valid
        if (!orgId || orgId === 'null' || orgId === 'undefined') {
            console.error('Invalid orgId:', orgId);
            setPayslips([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Role-based filtering
            const normalizedRole = userRole ? userRole.toLowerCase().trim() : '';

            // Fetch payslips based on role
            let payslipsQuery = supabase
                .from('payslips')
                .select('*')
                .eq('org_id', orgId)
                .order('month', { ascending: false });

            // Check if user is Executive or Manager (they see ALL payslips)
            const isExecutive = normalizedRole.includes('executive');
            const isManager = normalizedRole.includes('manager');
            const isTeamLead = normalizedRole === 'team_lead';
            const isEmployee = normalizedRole === 'employee';

            // Only filter for employees and team leads
            if (isEmployee || isTeamLead) {
                payslipsQuery = payslipsQuery.eq('employee_id', userId);
            } else if (isExecutive || isManager) {
                // No filter - fetch all payslips
            } else {
                console.warn('⚠️ Unknown role, defaulting to user-specific payslips');
                payslipsQuery = payslipsQuery.eq('employee_id', userId);
            }

            const { data: payslipsData, error: payslipsError } = await payslipsQuery;

            if (payslipsError) {
                console.error('Error fetching payslips:', payslipsError);
                showToast('Failed to load payslips: ' + payslipsError.message, 'error');
                return;
            }

            if (!payslipsData || payslipsData.length === 0) {
                setPayslips([]);
                setLoading(false);
                return;
            }

            // Get unique employee IDs from payslips to fetch their profiles
            const employeeIds = [...new Set(payslipsData.map(p => p.employee_id))];

            // Fetch profiles for these employees
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('org_id', orgId)
                .in('id', employeeIds);

            if (profilesError) {
                console.error('Error fetching profiles:', profilesError);
            }

            // Create a map of employee_id to profile
            const profileMap = {};
            if (profilesData) {
                profilesData.forEach(profile => {
                    profileMap[profile.id] = profile;
                });
            }

            // Transform data for display
            const transformedData = payslipsData.map(payslip => ({
                id: payslip.id,
                employee_id: payslip.employee_id,
                name: profileMap[payslip.employee_id]?.full_name || 'Unknown',
                email: profileMap[payslip.employee_id]?.email || 'N/A',
                role: profileMap[payslip.employee_id]?.role || 'N/A',
                month: payslip.month || 'N/A',
                amount: payslip.amount ? `₹${Number(payslip.amount).toLocaleString()}` : 'N/A',
                status: 'Paid',
                storage_url: payslip.storage_url
            }));

            setPayslips(transformedData);
        } catch (error) {
            console.error('Unexpected error fetching payslips:', error);
            showToast('An unexpected error occurred while loading payslips', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleView = (payslip) => {
        if (payslip.storage_url) {
            window.open(payslip.storage_url, '_blank');
        } else {
            showToast('Payslip URL not found', 'error');
        }
    };

    const handleDownload = async (payslip) => {
        if (!payslip.storage_url) {
            showToast('Payslip file not available', 'warning');
            return;
        }

        try {
            // Direct download using the public URL - instant and efficient
            const link = document.createElement('a');
            link.href = payslip.storage_url;
            link.download = `Payslip_${payslip.month || 'doc'}_${payslip.name || 'employee'}.pdf`;
            link.target = '_blank'; // Fallback if download attribute doesn't work
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Payslip download started', 'success');

        } catch (error) {
            console.error('Download error:', error);
            showToast(`Could not download: ${error.message || 'File missing'}`, 'error');
        }
    };

    const handlePayslipSuccess = (message) => {
        showToast(message, 'success');
        setRefreshTrigger(prev => prev + 1); // Refresh the list
    };

    const columns = [
        {
            header: 'Employee',
            accessor: 'name',
            render: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#e0f2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: '#075985'
                    }}>
                        {row.name.charAt(0)}
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '2px' }}>{row.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Month',
            accessor: 'month',
            render: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="var(--text-secondary)" />
                    <span style={{ fontWeight: 500 }}>{row.month}</span>
                </div>
            )
        },
        {
            header: 'Amount',
            accessor: 'amount',
            render: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>{row.amount}</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => (
                <span style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#dcfce7',
                    color: '#166534'
                }}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'Payslip',
            accessor: 'action',
            render: (row) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleView(row)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            backgroundColor: 'white',
                            color: '#7c3aed',
                            border: '1px solid #7c3aed',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Eye size={16} />
                        View
                    </button>
                    <button
                        onClick={() => handleDownload(row)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            backgroundColor: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)',
                            transition: 'transform 0.2s'
                        }}
                    >
                        <Download size={16} />
                        Download
                    </button>
                </div>
            )
        }
    ];

    // Determine if user can add payslips
    const canAddPayslips = userRole && (userRole.toLowerCase().includes('executive') || userRole.toLowerCase().includes('manager'));

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-secondary)'
            }}>
                <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p style={{ fontSize: '1.1rem' }}>Loading payslips...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
            {/* Compact Header - Matching Leave Requests Style */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 28px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                marginBottom: '20px'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Payslips</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            {userRole === 'employee' || userRole === 'team_lead' ? 'Your Payslips' : 'Payslip Repository'}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                            Secure access to employee financial statements and payroll documentation.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                        {canAddPayslips && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                style={{
                                    background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                                    color: 'white',
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
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
                                <Plus size={16} strokeWidth={2.5} />
                                Generate
                            </button>
                        )}

                        <div style={{
                            padding: '10px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            textAlign: 'right'
                        }}>
                            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>
                                Records
                            </p>
                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white', lineHeight: 1 }}>{payslips.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payslips Table */}
            {payslips.length > 0 ? (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    border: '1px solid #e2e8f0'
                }}>
                    <DataTable
                        title="Comprehensive Payslip Ledger"
                        columns={columns}
                        data={payslips}
                    />
                </div>
            ) : (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '120px 20px',
                    textAlign: 'center',
                    border: '2px dashed #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '20px'
                    }}>
                        <FileText size={32} color="#cbd5e1" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                        No Records Found
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                        {userRole === 'employee' || userRole === 'team_lead'
                            ? 'Your financial vault is currently empty. Direct deposits will appear here.'
                            : 'The payslip repository is empty. Initialize your first generation above.'}
                    </p>
                </div>
            )}

            {/* New Payslip Form Modal */}
            <PayslipFormModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handlePayslipSuccess}
                orgId={orgId}
                savedCompaniesProp={savedCompanies}
                employeesProp={employees}
                onRefreshCompanies={fetchSavedCompanies}
            />

        </div>
    );
};

export default PayslipsPage;
