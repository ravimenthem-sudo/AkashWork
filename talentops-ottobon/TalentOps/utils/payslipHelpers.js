import { supabase } from '../lib/supabaseClient';

/**
 * Generate a unique payslip number
 * Format: PAY-YYYY-NNN (e.g., PAY-2025-001)
 * Ensures uniqueness by checking all existing payslips for the year
 */
export const generatePayslipNumber = async (orgId) => {
    const year = new Date().getFullYear();

    try {
        // Get ALL payslips for this year to find the maximum number
        const { data, error } = await supabase
            .from('payslips')
            .select('payslip_number')
            .eq('org_id', orgId)
            .like('payslip_number', `PAY-${year}-%`)
            .order('payslip_number', { ascending: false });

        if (error) {
            console.error('Error fetching payslip numbers:', error);
            // If error, use timestamp-based fallback to ensure uniqueness
            const timestamp = Date.now().toString().slice(-3);
            return `PAY-${year}-${timestamp}`;
        }

        if (!data || data.length === 0) {
            return `PAY-${year}-001`;
        }

        // Extract all numbers and find the maximum
        const numbers = data
            .map(p => {
                const parts = p.payslip_number.split('-');
                return parseInt(parts[2]) || 0;
            })
            .filter(n => !isNaN(n));

        const maxNumber = Math.max(...numbers, 0);
        const newNumber = (maxNumber + 1).toString().padStart(3, '0');

        console.log(`Generated payslip number: PAY-${year}-${newNumber} (previous max: ${maxNumber})`);
        return `PAY-${year}-${newNumber}`;
    } catch (err) {
        console.error('Unexpected error generating payslip number:', err);
        // Fallback to timestamp-based number
        const timestamp = Date.now().toString().slice(-3);
        return `PAY-${year}-${timestamp}`;
    }
};

/**
 * Calculate present days for an employee in a given month
 */
export const calculatePresentDays = async (employeeId, month, year, orgId) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('org_id', orgId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .not('clock_in', 'is', null)
        .not('clock_out', 'is', null);

    if (error) {
        console.error('Error calculating present days:', error);
        return 0;
    }

    return data ? data.length : 0;
};

/**
 * Calculate leave days for an employee in a given month
 */
export const calculateLeaveDays = async (employeeId, month, year, orgId) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data, error } = await supabase
        .from('leaves')
        .select('from_date, to_date')
        .eq('employee_id', employeeId)
        .eq('org_id', orgId)
        .eq('status', 'approved')
        .or(`from_date.lte.${endDate.toISOString().split('T')[0]},to_date.gte.${startDate.toISOString().split('T')[0]}`);

    if (error) {
        console.error('Error calculating leave days:', error);
        return 0;
    }

    if (!data || data.length === 0) return 0;

    // Calculate total leave days within the month
    let totalLeaveDays = 0;
    data.forEach(leave => {
        const leaveFromDate = new Date(leave.from_date);
        const leaveToDate = new Date(leave.to_date);

        // Get the overlap between leave period and the month
        const overlapStart = leaveFromDate > startDate ? leaveFromDate : startDate;
        const overlapEnd = leaveToDate < endDate ? leaveToDate : endDate;

        // Calculate days only if there's a valid overlap
        if (overlapStart <= overlapEnd) {
            const days = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
            if (days > 0) {
                totalLeaveDays += days;
            }
        }
    });

    return totalLeaveDays;
};

/**
 * Format month for database (e.g., "2026-06" for June 2026)
 * Returns format: YYYY-MM to match payroll table storage
 */
export const formatMonth = (month, year) => {
    const monthStr = month.toString().padStart(2, '0');
    return `${year}-${monthStr}`;
};

/**
 * Parse month string back to month and year (from "2025-01" format)
 */
export const parseMonth = (monthString) => {
    const [yearStr, monthStr] = monthString.split('-');
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);
    return { month, year };
};

/**
 * Format month for display (e.g., "January 2025")
 */
export const formatMonthDisplay = (monthString) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const [yearStr, monthStr] = monthString.split('-');
    const monthIndex = parseInt(monthStr) - 1;
    return `${monthNames[monthIndex]} ${yearStr}`;
};
