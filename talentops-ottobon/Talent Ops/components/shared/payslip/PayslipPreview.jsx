import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import './PayslipPreview.css';

// Helper function to convert number to words (Indian numbering system)
const numberToWords = (num) => {
    if (num === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertHundreds = (n) => {
        let str = '';
        if (n > 99) {
            str += ones[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n > 19) {
            str += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        } else if (n >= 10) {
            str += teens[n - 10] + ' ';
            return str;
        }
        if (n > 0) {
            str += ones[n] + ' ';
        }
        return str;
    };

    let word = '';
    const crore = Math.floor(num / 10000000);
    if (crore > 0) {
        word += convertHundreds(crore) + 'Crore ';
        num %= 10000000;
    }

    const lakh = Math.floor(num / 100000);
    if (lakh > 0) {
        word += convertHundreds(lakh) + 'Lakh ';
        num %= 100000;
    }

    const thousand = Math.floor(num / 1000);
    if (thousand > 0) {
        word += convertHundreds(thousand) + 'Thousand ';
        num %= 1000;
    }

    if (num > 0) {
        word += convertHundreds(num);
    }

    return word.trim() + ' Rupees only';
};

const PayslipPreview = ({ payslipData, companySettings, onBack, onSave, loading }) => {
    const totalEarnings = payslipData.basicSalary + payslipData.hra + payslipData.allowances;
    const totalDeductions = (payslipData.professionalTax || 0) + payslipData.deductions + (payslipData.lopAmount || 0);
    const netSalary = payslipData.netSalary;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                maxWidth: '1000px',
                width: '100%',
                maxHeight: '95vh',
                backgroundColor: '#f1f5f9',
                borderRadius: '32px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{
                    padding: '24px 40px',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white'
                }}>
                    <button
                        onClick={onBack}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1.5px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            color: 'white',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                        <ArrowLeft size={18} />
                        Modify Details
                    </button>

                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Document Finalization</h2>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Reviewing {payslipData.payslipNumber}</p>
                    </div>

                    <button
                        onClick={onSave}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            border: 'none',
                            borderRadius: '14px',
                            color: 'white',
                            fontWeight: 800,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.3)',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                        <Save size={20} />
                        {loading ? 'Committing...' : 'Commit & Finalize'}
                    </button>
                </div>

                <div style={{
                    padding: '60px 40px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    {/* Company Header - Logo on left, info on right */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '20px',
                        marginBottom: '25px'
                    }}>
                        {companySettings?.logo_url && (
                            <div style={{ flexShrink: 0 }}>
                                <img
                                    src={companySettings.logo_url}
                                    alt="Company Logo"
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                        )}
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                                {companySettings?.company_name || 'Talent Ops'}
                            </h1>
                            {companySettings?.company_address && (
                                <p style={{ fontSize: '11px', margin: '6px 0', color: '#333', lineHeight: '1.5' }}>
                                    {companySettings.company_address}
                                </p>
                            )}
                            {(companySettings?.company_email || companySettings?.company_phone) && (
                                <p style={{ fontSize: '11px', margin: '6px 0', color: '#333' }}>
                                    {[companySettings.company_email, companySettings.company_phone]
                                        .filter(Boolean)
                                        .join('    ')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                            Pay slip for the month of {payslipData.month}
                        </h2>
                    </div>

                    {/* Employee Details Table */}
                    <table style={{
                        width: '100%',
                        border: '1px solid #000',
                        borderCollapse: 'collapse',
                        marginBottom: '20px',
                        fontSize: '11px'
                    }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>Employee Code</td>
                                <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>: {payslipData.employeeId}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>Company:</td>
                                <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>{companySettings?.company_name || 'Talent Ops'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Base Location</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>: {payslipData.employeeLocation || 'N/A'}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Email:</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>{payslipData.employeeEmail}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Date of Joining</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>: {payslipData.dateOfJoining && payslipData.dateOfJoining !== 'N/A' ? new Date(payslipData.dateOfJoining).toLocaleDateString('en-IN') : 'N/A'}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Employee Name:</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>{payslipData.employeeName}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Working Days</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>: {payslipData.totalWorkingDays || 0}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Designation:</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>{payslipData.employeeRole}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Present Days</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>: {payslipData.presentDays || 0}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Leave Days:</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>{payslipData.leaveDays || 0}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>LOP Days</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>: {payslipData.lopDays || 0}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Payslip Number:</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>{payslipData.payslipNumber}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Earnings/Deductions Table */}
                    <table style={{
                        width: '100%',
                        border: '1px solid #000',
                        borderCollapse: 'collapse',
                        marginBottom: '20px',
                        fontSize: '11px'
                    }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }} colSpan="2">Earnings</th>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }} colSpan="2">Deductions</th>
                            </tr>
                            <tr>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Particulars</th>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Rate / Month (₹)</th>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Particulars</th>
                                <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Basic Salary</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{payslipData.basicSalary.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Professional Tax</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{(payslipData.professionalTax || 0).toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>House Rent Allowance (HRA)</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{payslipData.hra.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>LOP ({payslipData.lopDays || 0} days)</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{(payslipData.lopAmount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Allowances</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{payslipData.allowances.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}></td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}></td>
                            </tr>
                            <tr style={{ fontWeight: 'bold' }}>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Total Earnings</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{totalEarnings.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Total Deductions</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>{totalDeductions.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr style={{ fontWeight: 'bold', fontSize: '12px' }}>
                                <td style={{ padding: '8px', border: '1px solid #000' }}>Net Salary:</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }}>₹ {netSalary.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', textAlign: 'right' }} colSpan="2">₹ {netSalary.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* In Words */}
                    <div style={{
                        marginBottom: '15px',
                        marginTop: '15px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #000',
                        fontSize: '11px'
                    }}>
                        In words: {numberToWords(Math.floor(netSalary))}
                    </div>

                    {/* Footer */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: '30px',
                        fontSize: '10px',
                        fontStyle: 'italic',
                        color: '#666'
                    }}>
                        <p style={{ margin: '8px 0' }}>This is a computer-generated payslip and does not require a signature.</p>
                        <p style={{ margin: '8px 0' }}>Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayslipPreview;
