import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../employee/components/UI/DataTable';
import PayrollFormModal from './PayrollFormModal';
import { DollarSign, Eye, X } from 'lucide-react';

const PayrollPage = ({ userRole, userId, addToast, orgId }) => {
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        // Only fetch if orgId is available
        if (!orgId || orgId === 'null' || orgId === 'undefined') {
            setLoading(false);
            return;
        }

        fetchPayrolls();

        // Real-time subscription
        const subscription = supabase
            .channel('payroll-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'payroll'
            }, () => {
                fetchPayrolls();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [orgId]); // Add orgId as dependency


    const fetchPayrolls = async () => {
        try {
            setLoading(true);

            let rpcName = '';

            // Determine which RPC to call based on role
            // Note: We use the server-validated role check inside the RPC, 
            // but we need to know which one to ask for.
            const isExecOrManager = ['Executive', 'Manager', 'executive', 'manager', 'admin'].includes(userRole);

            if (isExecOrManager) {
                rpcName = 'get_org_payroll_history'; // Returns everyone's data (if allowed)
            } else {
                rpcName = 'get_my_payroll_history'; // Returns ONLY my data
            }

            console.log(`Fetching payrolls using RPC: ${rpcName}`);

            const { data, error } = await supabase.rpc(rpcName);

            if (error) {
                console.error('Error fetching payrolls via RPC:', error);
                addToast('Failed to load payroll records: ' + error.message, 'error');
                setPayrolls([]);
                return;
            }

            // The RPC returns specific error objects sometimes
            if (data && data.error) {
                console.error('RPC returned logic error:', data.error);
                addToast(data.error, 'error');
                setPayrolls([]);
                return;
            }

            // If success, data.data contains the array
            // If the RPC returns a direct array (standard), use it. 
            // Our RPC returns { success: true, data: [...] } structure.
            const pData = data.data || data || [];

            console.log('Payroll Data Loaded:', pData.length);
            setPayrolls(pData);

        } catch (error) {
            console.error('Unexpected error fetching payrolls:', error);
            addToast('Failed to load payroll records', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePayrollSuccess = (message) => {
        addToast(message, 'success');
        fetchPayrolls();
    };

    const handleViewDetails = (payroll) => {
        setSelectedPayroll(payroll);
        setShowDetailsModal(true);
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
                        backgroundColor: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: 'white'
                    }}>
                        {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '2px' }}>{row.name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{row.email}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Month',
            accessor: 'month'
        },
        {
            header: 'Basic Salary',
            accessor: 'basic_salary',
            render: (row) => (
                <span style={{ fontWeight: 600 }}>
                    ₹{row.basic_salary?.toLocaleString()}
                </span>
            )
        },
        {
            header: 'LOP Days',
            accessor: 'lop_days',
            render: (row) => (
                <span style={{
                    color: row.lop_days > 0 ? '#dc2626' : '#059669',
                    fontWeight: 600
                }}>
                    {row.lop_days || 0}
                </span>
            )
        },
        {
            header: 'Net Salary',
            accessor: 'net_salary',
            render: (row) => (
                <span style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: '#059669'
                }}>
                    ₹{row.net_salary?.toLocaleString()}
                </span>
            )
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => (
                <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: row.status === 'generated' ? '#dcfce7' : '#fef3c7',
                    color: row.status === 'generated' ? '#166534' : '#b45309'
                }}>
                    {row.status?.charAt(0).toUpperCase() + row.status?.slice(1)}
                </span>
            )
        },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (row) => (
                <button
                    onClick={() => handleViewDetails(row)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#dbeafe';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                >
                    <Eye size={16} />
                    View Details
                </button>
            )
        }
    ];

    // Only show Generate button for Executive and Manager roles
    const canGenerate = userRole === 'Executive' || userRole === 'Manager' || userRole === 'executive' || userRole === 'manager';

    console.log('PayrollPage - userRole:', userRole, 'canGenerate:', canGenerate);

    return (
        <div style={{
            padding: '32px',
            background: '#f8fafc',
            minHeight: '100vh'
        }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                marginBottom: '32px'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-payroll" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-payroll)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Financials</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: '600' }}>Payroll Control</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                            Payroll <span style={{ background: 'linear-gradient(to right, #818cf8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Records</span>
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                            Comprehensive view of organizational payroll distribution and employee compensation records.
                        </p>
                    </div>

                    {canGenerate && (
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(12px)',
                            padding: '16px 24px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <button
                                onClick={() => setShowGenerateModal(true)}
                                style={{
                                    background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                                    color: 'white',
                                    padding: '12px 24px',
                                    borderRadius: '14px',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                                }}
                            >
                                <DollarSign size={20} />
                                Generate Payroll
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '400px'
                }}>
                    <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading payroll records...</p>
                </div>
            ) : payrolls.length > 0 ? (
                <DataTable
                    title="Payroll Records"
                    columns={columns}
                    data={payrolls}
                />
            ) : (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '48px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                    <DollarSign size={64} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                        No Payroll Records Found
                    </h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                        {canGenerate ? 'Click "Generate Payroll" to create payroll records for employees' : 'No payroll records have been generated yet'}
                    </p>
                    {canGenerate && (
                        <button
                            onClick={() => setShowGenerateModal(true)}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <DollarSign size={20} />
                            Generate Payroll
                        </button>
                    )}
                </div>
            )}

            {/* Generate Payroll Modal */}
            {showGenerateModal && (
                <PayrollFormModal
                    isOpen={showGenerateModal}
                    onClose={() => setShowGenerateModal(false)}
                    onSuccess={handlePayrollSuccess}
                    orgId={orgId}
                />
            )}

            {/* Payroll Details Modal */}
            {showDetailsModal && selectedPayroll && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowDetailsModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '600px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '24px',
                            paddingBottom: '16px',
                            borderBottom: '2px solid #e5e7eb'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                                Payroll Details
                            </h2>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: '#6b7280'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Employee Info */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '16px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '12px'
                            }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    backgroundColor: '#7c3aed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: 'white'
                                }}>
                                    {selectedPayroll.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
                                        {selectedPayroll.name}
                                    </p>
                                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                        {selectedPayroll.email}
                                    </p>
                                    <p style={{ color: '#7c3aed', fontSize: '0.875rem', fontWeight: 600, marginTop: '4px' }}>
                                        {selectedPayroll.month}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Salary Breakdown */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>
                                Salary Breakdown
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Basic Salary</span>
                                    <span style={{ fontWeight: 600 }}>₹{selectedPayroll.basic_salary?.toLocaleString()}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>HRA</span>
                                    <span style={{ fontWeight: 600 }}>₹{selectedPayroll.hra?.toLocaleString()}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Allowances</span>
                                    <span style={{ fontWeight: 600 }}>₹{selectedPayroll.allowances?.toLocaleString()}</span>
                                </div>

                                <div style={{
                                    height: '1px',
                                    backgroundColor: '#e5e7eb',
                                    margin: '8px 0'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                                    <span style={{ color: '#92400e', fontWeight: 600 }}>Gross Salary</span>
                                    <span style={{ fontWeight: 700, color: '#92400e' }}>
                                        ₹{((selectedPayroll.basic_salary || 0) + (selectedPayroll.hra || 0) + (selectedPayroll.allowances || 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>
                                Deductions
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                                    <span style={{ color: '#991b1b' }}>LOP Days</span>
                                    <span style={{ fontWeight: 600, color: '#991b1b' }}>
                                        {selectedPayroll.lop_days || 0} days
                                        {selectedPayroll.lop_days > 0 && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.9em', opacity: 0.8 }}>
                                                (-₹{Math.round((selectedPayroll.basic_salary || 0) + (selectedPayroll.hra || 0) + (selectedPayroll.allowances || 0) - (selectedPayroll.deductions || 0) - (selectedPayroll.professional_tax || 0) - (selectedPayroll.net_salary || 0)).toLocaleString()})
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                                    <span style={{ color: '#991b1b' }}>Professional Tax</span>
                                    <span style={{ fontWeight: 600, color: '#991b1b' }}>₹{selectedPayroll.professional_tax?.toLocaleString() || 0}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                                    <span style={{ color: '#991b1b' }}>Additional Deductions</span>
                                    <span style={{ fontWeight: 600, color: '#991b1b' }}>₹{selectedPayroll.deductions?.toLocaleString()}</span>
                                </div>
                            </div>

                            <div style={{
                                height: '1px',
                                backgroundColor: '#fca5a5',
                                margin: '8px 0'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                                <span style={{ color: '#7f1d1d', fontWeight: 700 }}>Total Deductions</span>
                                <span style={{ fontWeight: 700, color: '#7f1d1d' }}>
                                    - ₹{Math.round(
                                        (selectedPayroll.basic_salary || 0) + (selectedPayroll.hra || 0) + (selectedPayroll.allowances || 0) - (selectedPayroll.net_salary || 0)
                                    ).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Net Salary */}
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#dcfce7',
                            borderRadius: '12px',
                            border: '2px solid #86efac'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>
                                    Net Salary
                                </span>
                                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#166534' }}>
                                    ₹{selectedPayroll.net_salary?.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollPage;
