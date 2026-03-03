import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    getDaysInMonth,
    getWorkingDaysInMonth,
    calculatePresentDays,
    calculateApprovedLeaveDays,
    fetchEmployeeFinance,
    calculateLOPDays,
    calculateLOPAmount,
    calculateNetSalary,
    formatMonthYear,
    checkPayrollExists
} from '../../utils/payrollCalculations';
import { X, FileText, CheckSquare, Square, Calculator, AlertTriangle } from 'lucide-react';
import './payslip/PayslipFormModal.css';

const PayrollFormModal = ({ isOpen, onClose, onSuccess, orgId }) => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Form state
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Calculation preview data
    const [payrollPreview, setPayrollPreview] = useState([]);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setSelectedEmployees([]);
        setSelectAll(false);
        setSelectedMonth('');
        setSelectedYear(new Date().getFullYear());
        setPayrollPreview([]);
        setShowPreview(false);
        setError('');
        setProgress({ current: 0, total: 0 });
    };

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('org_id', orgId)
                .order('full_name');

            if (error) {
                console.error('Error fetching employees:', error);
                setError('Failed to load employees: ' + error.message);
                return;
            }

            if (data) {
                setEmployees(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching employees:', err);
            setError('Failed to load employees');
        }
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(employees.map(emp => emp.id));
        }
        setSelectAll(!selectAll);
    };

    const handleEmployeeToggle = (employeeId) => {
        setSelectedEmployees(prev => {
            const newSelection = prev.includes(employeeId)
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId];

            setSelectAll(newSelection.length === employees.length);
            return newSelection;
        });
    };

    const handleCalculatePreview = async () => {
        if (selectedEmployees.length === 0) {
            setError('Please select at least one employee');
            return;
        }

        if (!selectedMonth) {
            setError('Please select a month');
            return;
        }

        setCalculating(true);
        setError('');
        setPayrollPreview([]);

        const preview = [];
        const warnings = [];
        const monthYear = formatMonthYear(parseInt(selectedMonth), selectedYear);

        for (const employeeId of selectedEmployees) {
            const employee = employees.find(e => e.id === employeeId);

            try {
                // Check if payroll already exists
                const exists = await checkPayrollExists(employeeId, monthYear, orgId);
                if (exists) {
                    warnings.push(`${employee.full_name}: Payroll already exists for ${monthYear}`);
                    continue;
                }

                // Fetch finance data
                const financeData = await fetchEmployeeFinance(employeeId, orgId);
                if (!financeData) {
                    warnings.push(`${employee.full_name}: No active salary data found`);
                    continue;
                }

                // Calculate working days (M-F pool) and total calendar days (salary divisor)
                const workingDaysPool = getWorkingDaysInMonth(parseInt(selectedMonth), selectedYear);
                const totalCalendarDays = getDaysInMonth(parseInt(selectedMonth), selectedYear);

                const presentDays = await calculatePresentDays(employeeId, parseInt(selectedMonth), selectedYear, orgId);
                const leaveDays = await calculateApprovedLeaveDays(employeeId, parseInt(selectedMonth), selectedYear, orgId);

                // Calculate LOP using the Mon-Fri working days pool
                const lopDays = calculateLOPDays(workingDaysPool, presentDays, leaveDays);

                // Use total calendar days as divisor for dynamic per-day amount
                const lopAmount = calculateLOPAmount(financeData.basic_salary, financeData.hra, financeData.allowances, totalCalendarDays, lopDays);

                // Add to preview with default deductions
                preview.push({
                    employee_id: employeeId,
                    employee_name: employee.full_name,
                    basic_salary: financeData.basic_salary,
                    hra: financeData.hra,
                    allowances: financeData.allowances,
                    professional_tax: financeData.professional_tax || 0,
                    total_working_days: totalCalendarDays, // Show total days in month as the basis
                    present_days: presentDays,
                    leave_days: leaveDays,
                    lop_days: lopDays,
                    lop_amount: lopAmount,
                    additional_deductions: 0, // User input
                    net_salary: calculateNetSalary(
                        financeData.basic_salary,
                        financeData.hra,
                        financeData.allowances,
                        financeData.professional_tax || 0,
                        0,
                        lopAmount
                    )
                });
            } catch (error) {
                console.error(`Error calculating for ${employee.full_name}:`, error);
                warnings.push(`${employee.full_name}: ${error.message}`);
            }
        }

        if (preview.length === 0) {
            setError(warnings.join('\n') || 'No valid employees to process. Please check salary data.');
            setCalculating(false);
            return;
        }

        if (warnings.length > 0) {
            setError('⚠️ Warnings:\n' + warnings.join('\n'));
        }

        setPayrollPreview(preview);
        setShowPreview(true);
        setCalculating(false);
    };

    const handleDeductionChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const additionalDeductions = parseFloat(value) || 0;
                return {
                    ...item,
                    additional_deductions: additionalDeductions,
                    net_salary: calculateNetSalary(
                        item.basic_salary,
                        item.hra,
                        item.allowances,
                        item.professional_tax,
                        additionalDeductions,
                        item.lop_amount
                    )
                };
            }
            return item;
        }));
    };

    const handleLopDaysChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const lopDays = Math.max(0, parseFloat(value) || 0);
                const lopAmount = calculateLOPAmount(item.basic_salary, item.hra, item.allowances, item.total_working_days, lopDays);

                return {
                    ...item,
                    lop_days: lopDays,
                    lop_amount: lopAmount,
                    net_salary: calculateNetSalary(
                        item.basic_salary,
                        item.hra,
                        item.allowances,
                        item.professional_tax,
                        item.additional_deductions,
                        lopAmount
                    )
                };
            }
            return item;
        }));
    };

    const handleWorkingDaysChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const workingDays = Math.max(1, parseInt(value) || 1);
                // LOP amount stays constant - always based on calendar days in month
                // Only update the working days field, don't recalculate LOP

                return {
                    ...item,
                    total_working_days: workingDays
                    // LOP amount and net salary remain unchanged
                };
            }
            return item;
        }));
    };

    const handlePresentDaysChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const presentDays = Math.max(0, parseInt(value) || 0);
                // Present days is informational only - doesn't affect LOP calculation
                return {
                    ...item,
                    present_days: presentDays
                };
            }
            return item;
        }));
    };

    const handleLeaveDaysChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const leaveDays = Math.max(0, parseInt(value) || 0);
                // Leave days is informational only - doesn't affect LOP calculation
                return {
                    ...item,
                    leave_days: leaveDays
                };
            }
            return item;
        }));
    };

    const handleGeneratePayroll = async () => {
        if (payrollPreview.length === 0) {
            setError('Please calculate preview first');
            return;
        }

        setLoading(true);
        setError('');
        setProgress({ current: 0, total: payrollPreview.length });

        const monthYear = formatMonthYear(parseInt(selectedMonth), selectedYear);
        let successCount = 0;
        const failures = [];

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        for (let i = 0; i < payrollPreview.length; i++) {
            const item = payrollPreview[i];
            setProgress({ current: i + 1, total: payrollPreview.length });

            try {
                const { error } = await supabase
                    .from('payroll')
                    .insert({
                        employee_id: item.employee_id,
                        month: monthYear,
                        basic_salary: item.basic_salary,
                        hra: item.hra,
                        allowances: item.allowances,
                        professional_tax: item.professional_tax,
                        deductions: item.additional_deductions,
                        lop_days: item.lop_days,
                        total_working_days: item.total_working_days,
                        present_days: item.present_days,
                        leave_days: item.leave_days,
                        net_salary: item.net_salary,
                        generated_by: user?.id,
                        status: 'generated',
                        org_id: orgId
                    });

                if (error) throw error;

                // Send Payslip Notification
                const notificationMessage = `Your payslip for ${monthYear} has been generated.`;
                await supabase.from('notifications').insert({
                    receiver_id: item.employee_id,
                    sender_id: user?.id,
                    sender_name: 'Finance Department',
                    message: notificationMessage,
                    type: 'payslip',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });

                successCount++;
            } catch (error) {
                console.error(`Error generating payroll for ${item.employee_name}:`, error);
                failures.push(`${item.employee_name}: ${error.message}`);
            }
        }

        setLoading(false);
        setProgress({ current: 0, total: 0 });

        const message = `Successfully generated payroll for ${successCount} out of ${payrollPreview.length} employee(s)`
            + (failures.length > 0 ? `\n\nFailed:\n${failures.join('\n')}` : '');

        if (onSuccess) {
            onSuccess(message);
        }

        if (successCount > 0) {
            handleClose();
        } else {
            setError('Failed to generate any payroll records:\n' + failures.join('\n'));
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    const years = Array.from({ length: 11 }, (_, i) => 2030 - i);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
        }} onClick={handleClose}>
            <div
                style={{
                    maxWidth: showPreview ? '1600px' : '1100px',
                    width: '95%',
                    backgroundColor: 'white',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '95vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Generate Payroll</h2>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Financial Processing Engine v2.0</p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '32px', overflowY: 'auto' }}>
                    {/* Error Alert */}
                    {error && (
                        <div style={{
                            whiteSpace: 'pre-line',
                            backgroundColor: '#fff1f2',
                            border: '1px solid #fecaca',
                            color: '#e11d48',
                            padding: '16px',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}>
                            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    {loading && progress.total > 0 && (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#f5f3ff',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            border: '1px solid #ddd6fe'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <p style={{ fontWeight: 700, color: '#5b21b6', fontSize: '0.95rem' }}>
                                    Generating Financial Records...
                                </p>
                                <span style={{ fontWeight: 700, color: '#7c3aed' }}>{progress.current} / {progress.total}</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#ede9fe',
                                borderRadius: '10px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(progress.current / progress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#7c3aed',
                                    borderRadius: '10px',
                                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                    backgroundSize: '40px 40px'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    {!showPreview ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            {/* Left Column - Employee Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '-10px', display: 'block' }}>Selection Hub</label>

                                <div
                                    onClick={handleSelectAll}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '16px',
                                        backgroundColor: selectAll ? '#f5f3ff' : '#f8fafc',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        border: selectAll ? '2px solid #7c3aed' : '2px solid #e2e8f0',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {selectAll ? <CheckSquare size={22} color="#7c3aed" /> : <Square size={22} color="#94a3b8" />}
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 700, color: selectAll ? '#5b21b6' : '#475569', fontSize: '0.95rem' }}>
                                            Select All Personnel
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total {employees.length} employees found</p>
                                    </div>
                                </div>

                                <div style={{
                                    maxHeight: '350px',
                                    overflowY: 'auto',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '20px',
                                    padding: '12px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    {employees.map(emp => (
                                        <div
                                            key={emp.id}
                                            onClick={() => handleEmployeeToggle(emp.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '14px',
                                                borderRadius: '14px',
                                                cursor: 'pointer',
                                                backgroundColor: selectedEmployees.includes(emp.id) ? 'white' : 'transparent',
                                                boxShadow: selectedEmployees.includes(emp.id) ? '0 4px 12px rgba(124, 58, 237, 0.08)' : 'none',
                                                border: selectedEmployees.includes(emp.id) ? '1.5px solid #7c3aed' : '1.5px solid transparent',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                border: selectedEmployees.includes(emp.id) ? '2px solid #7c3aed' : '2px solid #cbd5e1',
                                                backgroundColor: selectedEmployees.includes(emp.id) ? '#7c3aed' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                transition: 'all 0.2s'
                                            }}>
                                                {selectedEmployees.includes(emp.id) && <CheckSquare size={16} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginBottom: '2px' }}>{emp.full_name}</p>
                                                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{emp.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    padding: '12px 20px',
                                    backgroundColor: '#7c3aed',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    alignSelf: 'flex-start',
                                    boxShadow: '0 4px 10px rgba(124, 58, 237, 0.2)'
                                }}>
                                    {selectedEmployees.length} EMPLOYEES TARGETED
                                </div>
                            </div>

                            {/* Right Column - Parameters & Rules */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block' }}>Target Month</label>
                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '16px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                transition: 'border-color 0.2s'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        >
                                            <option value="">Select month...</option>
                                            {months.map(month => (
                                                <option key={month.value} value={month.value}>
                                                    {month.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block' }}>Fiscal Year</label>
                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '16px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                outline: 'none'
                                            }}
                                        >
                                            {years.map(year => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '24px',
                                    backgroundColor: '#f0f9ff',
                                    borderRadius: '24px',
                                    border: '1.5px solid #bae6fd',
                                    boxShadow: '0 4px 15px rgba(186, 230, 253, 0.2)'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 16px 0',
                                        color: '#0369a1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '1.1rem',
                                        fontWeight: 800
                                    }}>
                                        <div style={{ backgroundColor: 'white', padding: '6px', borderRadius: '8px' }}>
                                            <Calculator size={20} />
                                        </div>
                                        Payroll Calculation Rules
                                    </h4>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {[
                                            { label: 'Working Days', val: 'Actual calendar days in month' },
                                            { label: 'Present Days', val: 'Verified biometric/portal records' },
                                            { label: 'Wait Quota', val: 'Paid leaves within allowance limit' },
                                            { label: 'LOP Factor', val: 'Absence not covered by quota' },
                                            { label: 'Net Formula', val: '(Gross Earnings) - (Deductions + LOP)' }
                                        ].map((rule, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                <span style={{ color: '#0369a1', fontWeight: 700 }}>{rule.label}</span>
                                                <div style={{ height: '1px', flex: 1, backgroundColor: '#bae6fd', margin: '0 12px', opacity: 0.5 }} />
                                                <span style={{ color: '#075985', fontWeight: 500 }}>{rule.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        style={{
                                            flex: 1,
                                            padding: '16px',
                                            borderRadius: '16px',
                                            fontWeight: 700,
                                            border: '2px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCalculatePreview}
                                        disabled={calculating || selectedEmployees.length === 0 || !selectedMonth}
                                        style={{
                                            flex: 1.5,
                                            padding: '16px',
                                            borderRadius: '16px',
                                            fontWeight: 800,
                                            border: 'none',
                                            backgroundColor: '#4f46e5',
                                            backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                            color: 'white',
                                            cursor: selectedEmployees.length === 0 || !selectedMonth ? 'not-allowed' : 'pointer',
                                            boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            opacity: selectedEmployees.length === 0 || !selectedMonth ? 0.6 : 1,
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => { if (selectedEmployees.length > 0) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(79, 70, 229, 0.4)'; } }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.3)'; }}
                                    >
                                        <Calculator size={20} />
                                        {calculating ? 'Processing...' : `Initialize Preview`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Preview Table
                        <div>
                            <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                padding: '20px 24px',
                                borderRadius: '20px',
                                marginBottom: '24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', margin: 0 }}>
                                        Payroll Preview: {formatMonthYear(parseInt(selectedMonth), selectedYear)}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                                        Finalize LOP adjustments and additional deductions before batch generation
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        backgroundColor: 'white',
                                        border: '1.5px solid #e2e8f0',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                    ← Modify Selection
                                </button>
                            </div>

                            <div style={{
                                overflowX: 'auto',
                                marginBottom: '24px',
                                borderRadius: '20px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '0.875rem',
                                    backgroundColor: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '16px', textAlign: 'left', fontWeight: 800, color: '#475569' }}>Employee</th>
                                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>Earnings</th>
                                            <th style={{ padding: '16px', textAlign: 'center', fontWeight: 800, color: '#475569' }}>Days (W/P/L)</th>
                                            <th style={{ padding: '16px', textAlign: 'center', fontWeight: 800, color: '#475569' }}>LOP Adjustment</th>
                                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>Deductions</th>
                                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#111827' }}>Net Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payrollPreview.map((row, index) => (
                                            <tr key={row.employee_id} style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                backgroundColor: index % 2 === 0 ? 'white' : '#fcfcfd',
                                                transition: 'background-color 0.2s'
                                            }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fcfcfd'}>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{row.employee_name}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Standard Pay Cycle</div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>₹{(row.basic_salary + row.hra + row.allowances).toLocaleString()}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>B: ₹{row.basic_salary.toLocaleString()}</div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="31"
                                                            value={row.total_working_days}
                                                            onChange={(e) => handleWorkingDaysChange(row.employee_id, e.target.value)}
                                                            title="Working Days"
                                                            style={{
                                                                width: '50px',
                                                                padding: '8px 6px',
                                                                border: '1.5px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                textAlign: 'center',
                                                                fontSize: '1rem',
                                                                fontWeight: 600,
                                                                color: '#1e293b',
                                                                backgroundColor: 'white'
                                                            }}
                                                        />
                                                        <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '1rem' }}>/</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={row.total_working_days}
                                                            value={row.present_days}
                                                            onChange={(e) => handlePresentDaysChange(row.employee_id, e.target.value)}
                                                            title="Present Days"
                                                            style={{
                                                                width: '50px',
                                                                padding: '8px 6px',
                                                                border: '1.5px solid #d1fae5',
                                                                borderRadius: '6px',
                                                                textAlign: 'center',
                                                                fontSize: '1rem',
                                                                fontWeight: 700,
                                                                color: '#059669',
                                                                backgroundColor: '#f0fdf4'
                                                            }}
                                                        />
                                                        <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '1rem' }}>/</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={row.total_working_days}
                                                            value={row.leave_days}
                                                            onChange={(e) => handleLeaveDaysChange(row.employee_id, e.target.value)}
                                                            title="Leave Days"
                                                            style={{
                                                                width: '50px',
                                                                padding: '8px 6px',
                                                                border: '1.5px solid #dbeafe',
                                                                borderRadius: '6px',
                                                                textAlign: 'center',
                                                                fontSize: '1rem',
                                                                fontWeight: 600,
                                                                color: '#2563eb',
                                                                backgroundColor: '#eff6ff'
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={row.lop_days}
                                                            onChange={(e) => handleLopDaysChange(row.employee_id, e.target.value)}
                                                            style={{
                                                                width: '70px',
                                                                padding: '8px',
                                                                border: '1.5px solid #e2e8f0',
                                                                borderRadius: '8px',
                                                                textAlign: 'center',
                                                                fontSize: '1rem',
                                                                color: row.lop_days > 0 ? '#e11d48' : '#1e293b',
                                                                fontWeight: 700,
                                                                backgroundColor: row.lop_days > 0 ? '#fff1f2' : 'white'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.85rem', color: '#e11d48', fontWeight: 600 }}>₹{row.lop_amount.toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={row.additional_deductions}
                                                        onChange={(e) => handleDeductionChange(row.employee_id, e.target.value)}
                                                        style={{
                                                            width: '110px',
                                                            padding: '10px 12px',
                                                            border: '1.5px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            textAlign: 'right',
                                                            fontSize: '1rem',
                                                            fontWeight: 600
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#059669' }}>
                                                        ₹{row.net_salary?.toLocaleString()}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Verified Calculation</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Batch Generation Footer */}
                            <div style={{
                                padding: '24px 32px',
                                background: '#f8fafc',
                                borderRadius: '24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        backgroundColor: '#dcfce7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#059669'
                                    }}>
                                        <Calculator size={24} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Confirm Generation</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{payrollPreview.length} records will be processed</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowPreview(false)}
                                        style={{
                                            padding: '14px 24px',
                                            borderRadius: '16px',
                                            fontWeight: 700,
                                            border: '2px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            color: '#64748b',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Edit Parameters
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGeneratePayroll}
                                        disabled={loading}
                                        style={{
                                            padding: '14px 28px',
                                            borderRadius: '16px',
                                            fontWeight: 800,
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(5, 150, 105, 0.5)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(5, 150, 105, 0.4)'; }}
                                    >
                                        <FileText size={20} />
                                        {loading ? `Generating ${progress.current}/${progress.total}...` : `Generate Final Payroll`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayrollFormModal;
