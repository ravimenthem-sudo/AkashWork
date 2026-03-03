/**
 * Centralized Employee Types - Single Source of Truth
 * Used across Manager, Executive, and other modules for consistent data structures
 */

// Employee interface - core data structure for workforce management
export interface Employee {
    id: string;
    name: string;
    email: string;
    role: string;
    job_title?: string;
    department_display: string;
    dept: string | React.ReactNode; // Project/Team assignment - can be string or JSX for multi-project display
    projects: number;
    status: 'Active' | 'Inactive';
    availability: EmployeeAvailability;
    task: string;
    lastActive: string;
    joinDate: string;
    avatar_url?: string;
    performance?: string;
    tasksCompleted?: number;
    employment_type?: string;
    team_id?: string;
}

// Employee availability status
export type EmployeeAvailability = 'Online' | 'Offline' | 'On Leave';

// Employee status for real-time tracking
export interface EmployeeStatus {
    employeeId: string;
    availability: EmployeeAvailability;
    currentTask: string;
    lastActive: string;
    clockIn?: string;
    clockOut?: string;
}

// Attendance record from database
export interface AttendanceRecord {
    id?: string;
    employee_id: string;
    org_id?: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: string | null;
    current_task?: string;
}

// Leave record
export interface LeaveRecord {
    id: string;
    employee_id: string;
    org_id?: string;
    from_date: string;
    to_date: string;
    status: 'pending' | 'approved' | 'rejected' | 'Pending' | 'Approved' | 'Rejected';
    reason?: string;
    leave_type?: string;
}

// Profile from Supabase
export interface ProfileData {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    job_title?: string | null;
    department?: string | null;
    created_at?: string;
    join_date?: string;
    avatar_url?: string | null;
    team_id?: string;
    employment_type?: string;
    org_id?: string;
}

// Project assignment
export interface ProjectAssignment {
    user_id: string;
    project_id: string;
    role: string;
    projects?: {
        name: string;
    };
}

// Department mapping
export interface Department {
    id: string;
    department_name: string;
    org_id?: string;
}

// Transform options for employee data
export interface EmployeeTransformOptions {
    attendanceMap: Record<string, AttendanceRecord>;
    leaveSet: Set<string>;
    projectMap: Record<string, Array<{ name: string; role: string }>>;
    departmentMap: Record<string, string>;
}
