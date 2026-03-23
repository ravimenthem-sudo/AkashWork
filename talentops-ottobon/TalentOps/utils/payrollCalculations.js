// Payroll Calculation Utilities
import { supabase } from '../lib/supabaseClient';

/**
 * Get total calendar days in a month
 */
export const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Get total working days in a month (excluding Saturdays and Sundays)
 */
export const getWorkingDaysInMonth = (month, year) => {
    const totalDays = getDaysInMonth(month, year);
    let workingDays = 0;

    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month - 1, day); // month is 1-indexed
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

        // Count only Monday (1) to Friday (5)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
    }

    return workingDays;
};


/**
 * Calculate present days from attendance records for a given month
 */
export const calculatePresentDays = async (employeeId, month, year, orgId) => {
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${getDaysInMonth(month, year)}`;

        const { data, error } = await supabase
            .from('attendance')
            .select('date')
            .eq('employee_id', employeeId)
            .eq('org_id', orgId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching attendance:', error);
            return 0;
        }

        // Count unique dates (in case there are duplicates)
        const uniqueDates = new Set(data.map(record => record.date));
        return uniqueDates.size;
    } catch (error) {
        console.error('Error calculating present days:', error);
        return 0;
    }
};

/**
 * Calculate approved leave days for a given month (Paid Leaves only, capped at quota)
 */
export const calculateApprovedLeaveDays = async (employeeId, month, year, orgId) => {
    try {
        const startDate = new Date(year, month - 1, 1); // month is 1-indexed
        const endDate = new Date(year, month - 1, getDaysInMonth(month, year));

        // 1. Fetch Approved Leaves
        const { data: leavesData, error: leavesError } = await supabase
            .from('leaves')
            .select('from_date, to_date, reason')
            .eq('employee_id', employeeId)
            .eq('status', 'approved')
            .eq('org_id', orgId);

        if (leavesError) {
            console.error('Error fetching leaves:', leavesError);
            return 0;
        }

        // 2. Fetch Employee Quota
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('monthly_leave_quota')
            .eq('id', employeeId)
            .eq('org_id', orgId)
            .single();

        const monthlyQuota = (profileData && profileData.monthly_leave_quota) ? profileData.monthly_leave_quota : 3; // Default to 3 if not set

        if (!leavesData || leavesData.length === 0) return 0;

        let regularLeaveDays = 0;

        leavesData.forEach(leave => {
            // Skip "Loss of Pay" leaves entirely - they are not "Paid Leaves"
            if (leave.reason && leave.reason.toLowerCase().startsWith('loss of pay')) {
                return;
            }
            // "Casual", "Sick", "Vacation" count towards paid leave balance

            const leaveStart = new Date(leave.from_date);
            const leaveEnd = new Date(leave.to_date);

            // Find overlap between leave period and the month
            const overlapStart = leaveStart > startDate ? leaveStart : startDate;
            const overlapEnd = leaveEnd < endDate ? leaveEnd : endDate;

            // Only count if there's an overlap
            if (overlapStart <= overlapEnd) {
                const diffTime = Math.abs(overlapEnd - overlapStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
                regularLeaveDays += diffDays;
            }
        });

        // 3. Cap at Quota
        // The number of "Paid Leave Days" cannot exceed the monthly quota.
        // Any leaves taken beyond this will simply not be returned here, 
        // causing them to fall into the "LOP = Total - Present - Paid" gap.
        return Math.min(regularLeaveDays, monthlyQuota);

    } catch (error) {
        console.error('Error calculating leave days:', error);
        return 0;
    }
};

/**
 * Fetch active employee finance data
 */
export const fetchEmployeeFinance = async (employeeId, orgId) => {
    try {
        const { data, error } = await supabase
            .from('employee_finance')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('is_active', true)
            .eq('org_id', orgId)
            .single();

        if (error) {
            console.error('Error fetching employee finance:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in fetchEmployeeFinance:', error);
        return null;
    }
};

/**
 * Calculate LOP days
 */
export const calculateLOPDays = (totalWorkingDays, presentDays, leaveDays) => {
    const calculatedLOP = totalWorkingDays - (presentDays + leaveDays);
    return Math.max(0, calculatedLOP); // LOP can't be negative
};

/**
 * Calculate LOP amount based on Gross Salary
 */
export const calculateLOPAmount = (basicSalary, hra, allowances, totalDays, lopDays) => {
    if (lopDays === 0 || totalDays === 0) return 0;
    const grossSalary = Number(basicSalary) + Number(hra) + Number(allowances);
    const perDaySalary = grossSalary / totalDays;
    return Math.round(perDaySalary * lopDays);
};

/**
 * Calculate net salary
 */
export const calculateNetSalary = (basicSalary, hra, allowances, professionalTax, additionalDeductions, lopAmount) => {
    const grossSalary = Number(basicSalary) + Number(hra) + Number(allowances);
    const totalDeductions = Number(professionalTax) + Number(additionalDeductions) + Number(lopAmount);
    return Math.round(grossSalary - totalDeductions);
};


/**
 * Check if payroll already exists for employee and month
 */
export const checkPayrollExists = async (employeeId, monthYear, orgId) => {
    try {
        const { data, error } = await supabase
            .from('payroll')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('month', monthYear)
            .eq('org_id', orgId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
            console.error('Error checking payroll existence:', error);
            return false;
        }

        return !!data; // Returns true if data exists
    } catch (error) {
        console.error('Error in checkPayrollExists:', error);
        return false;
    }
};

/**
 * Format month and year to string
 */
export const formatMonthYear = (month, year) => {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
};

/**
 * Generate payroll record for a single employee
 */
export const generatePayrollRecord = async (employeeId, month, year, additionalDeductions, generatedBy, orgId) => {
    try {
        const monthYear = formatMonthYear(month, year);

        // Check if payroll already exists
        const exists = await checkPayrollExists(employeeId, monthYear, orgId);
        if (exists) {
            throw new Error('Payroll already exists for this employee and month');
        }

        // Get employee finance data
        const financeData = await fetchEmployeeFinance(employeeId, orgId);
        if (!financeData) {
            throw new Error('No active salary data found for employee');
        }

        // Calculate working days (M-F) for LOP days calculation
        // but use total calendar days for the per-day salary divisor
        const totalWorkingDays = getWorkingDaysInMonth(month, year);
        const totalCalendarDays = getDaysInMonth(month, year);
        const presentDays = await calculatePresentDays(employeeId, month, year, orgId);
        const leaveDays = await calculateApprovedLeaveDays(employeeId, month, year, orgId);

        // Calculate LOP using working days pool
        const lopDays = calculateLOPDays(totalWorkingDays, presentDays, leaveDays);
        // Use total calendar days as divisor for dynamic per-day rate
        const lopAmount = calculateLOPAmount(financeData.basic_salary, financeData.hra, financeData.allowances, totalCalendarDays, lopDays);

        // Calculate net salary
        const netSalary = calculateNetSalary(
            financeData.basic_salary,
            financeData.hra,
            financeData.allowances,
            financeData.professional_tax || 0,
            additionalDeductions,
            lopAmount
        );

        // Insert payroll record
        const { data, error } = await supabase
            .from('payroll')
            .insert({
                employee_id: employeeId,
                month: monthYear,
                basic_salary: financeData.basic_salary,
                hra: financeData.hra,
                allowances: financeData.allowances,
                professional_tax: financeData.professional_tax || 0,
                deductions: additionalDeductions,
                lop_days: lopDays,
                net_salary: netSalary,
                generated_by: generatedBy,
                status: 'generated',
                org_id: orgId
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data,
            calculations: {
                totalWorkingDays,
                presentDays,
                leaveDays,
                lopDays,
                lopAmount,
                netSalary
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};
