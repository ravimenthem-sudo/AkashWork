/**
 * Centralized Employee Service - Single Source of Truth for Employee Data
 * Handles data fetching, real-time updates, and status management
 * Used by both Manager and Executive modules
 */

import { supabase } from '../../../lib/supabaseClient';
import type {
    Employee,
    EmployeeStatus,
    AttendanceRecord,
    ProfileData,
    ProjectAssignment,
    Department,
    EmployeeTransformOptions
} from '../types/employee';

class EmployeeService {
    private static instance: EmployeeService;
    private employeeCache: Map<string, Employee[]> = new Map();
    private statusCache: Map<string, EmployeeStatus> = new Map();
    private subscriptions: Map<string, any> = new Map();

    private constructor() { }

    static getInstance(): EmployeeService {
        if (!EmployeeService.instance) {
            EmployeeService.instance = new EmployeeService();
        }
        return EmployeeService.instance;
    }

    /**
     * Fetch all employees with their current status
     * Consolidates the duplicated logic from Manager and Executive ModulePage
     */
    async fetchEmployees(orgId: string): Promise<Employee[]> {
        try {
            // 1. Fetch profiles
            const { data: profilesData, error: profileError } = await supabase
                .from('profiles')
                .select(`
                    id, 
                    full_name, 
                    email, 
                    role, 
                    job_title, 
                    department,
                    created_at,
                    join_date,
                    avatar_url,
                    team_id
                `)
                .eq('org_id', orgId);

            if (profileError) throw profileError;

            // 2. Fetch departments for mapping
            const { data: deptData } = await supabase
                .from('departments')
                .select('id, department_name')
                .eq('org_id', orgId);

            const departmentMap: Record<string, string> = {};
            if (deptData) {
                deptData.forEach((d: Department) => {
                    departmentMap[d.id] = d.department_name;
                });
            }

            // 3. Fetch project assignments
            const { data: assignments } = await supabase
                .from('project_members')
                .select('user_id, project_id, role, projects:project_id(name)')
                .eq('org_id', orgId);

            const projectMap: Record<string, Array<{ name: string; role: string }>> = {};
            if (assignments) {
                (assignments as any[]).forEach((a) => {
                    if (!projectMap[a.user_id]) {
                        projectMap[a.user_id] = [];
                    }
                    if (a.projects?.name) {
                        let roleDisplay = a.role || 'Member';
                        if (roleDisplay === 'team_lead') roleDisplay = 'Team Lead';
                        else if (roleDisplay === 'employee') roleDisplay = 'Employee';
                        else roleDisplay = roleDisplay.charAt(0).toUpperCase() + roleDisplay.slice(1);

                        projectMap[a.user_id].push({
                            name: a.projects.name,
                            role: roleDisplay
                        });
                    }
                });
            }

            // 4. Fetch TODAY's attendance and yesterday's for context
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('employee_id, clock_in, clock_out, date, current_task')
                .in('date', [yesterday, today])
                .eq('org_id', orgId);

            // 5. Fetch TODAY's approved leaves
            const { data: leavesData } = await supabase
                .from('leaves')
                .select('employee_id')
                .eq('status', 'approved')
                .eq('org_id', orgId)
                .lte('from_date', today)
                .gte('to_date', today);

            const leaveSet = new Set(leavesData?.map(l => l.employee_id) || []);

            // Build attendance map (most recent record per employee)
            const attendanceMap: Record<string, AttendanceRecord> = {};
            if (attendanceData) {
                const sortedAtt = [...attendanceData].sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return (a.clock_in || '').localeCompare(b.clock_in || '');
                });
                sortedAtt.forEach(record => {
                    attendanceMap[record.employee_id] = {
                        ...record,
                        total_hours: null // Not fetched in this query, will be calculated if needed
                    };
                });
            }

            // 6. Transform profiles to Employee objects
            const employees = this.transformProfilesToEmployees(
                profilesData || [],
                { attendanceMap, leaveSet, projectMap, departmentMap }
            );

            // Cache results
            this.employeeCache.set(orgId, employees);

            return employees;
        } catch (error) {
            console.error('EmployeeService: Error fetching employees:', error);
            throw error;
        }
    }

    /**
     * Transform profile data to Employee objects
     */
    private transformProfilesToEmployees(
        profiles: ProfileData[],
        options: EmployeeTransformOptions
    ): Employee[] {
        const { attendanceMap, leaveSet, projectMap, departmentMap } = options;

        return profiles.map(emp => {
            // Determine availability from attendance
            const attendance = attendanceMap[emp.id];
            let availability: Employee['availability'] = 'Offline';
            let lastActive = 'N/A';

            if (attendance) {
                if (attendance.clock_in && !attendance.clock_out) {
                    availability = 'Online';
                    lastActive = `Clocked in at ${attendance.clock_in.slice(0, 5)}`;
                } else if (attendance.clock_out) {
                    availability = 'Offline';
                    lastActive = `Left at ${attendance.clock_out.slice(0, 5)}`;
                }
            }

            // Override with leave status
            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                availability = 'On Leave';
            }

            // Determine current task
            const currentTask = (availability === 'Online' && attendance?.current_task)
                ? attendance.current_task
                : (availability === 'Online') ? 'No active task' : '-';

            // Build department display
            const departmentDisplay = emp.department
                ? (departmentMap[emp.department] || emp.department)
                : 'Main Office';

            // Build project/team display
            let deptDisplay: string = 'Unassigned';
            if (projectMap[emp.id] && projectMap[emp.id].length > 0) {
                deptDisplay = projectMap[emp.id].map(p => p.name).join(', ');
            }

            // Update status cache
            this.statusCache.set(emp.id, {
                employeeId: emp.id,
                availability,
                currentTask,
                lastActive,
                clockIn: attendance?.clock_in || undefined,
                clockOut: attendance?.clock_out || undefined
            });

            return {
                id: emp.id,
                name: emp.full_name || 'N/A',
                email: emp.email || 'N/A',
                role: emp.role || 'N/A',
                job_title: emp.job_title || 'N/A',
                department_display: departmentDisplay,
                dept: deptDisplay,
                projects: projectMap[emp.id]?.length || 0,
                status: 'Active',
                availability,
                task: currentTask,
                lastActive,
                joinDate: emp.join_date
                    ? new Date(emp.join_date).toLocaleDateString()
                    : emp.created_at
                        ? new Date(emp.created_at).toLocaleDateString()
                        : 'N/A',
                avatar_url: emp.avatar_url || undefined,
                team_id: emp.team_id || undefined,
                employment_type: emp.employment_type || 'Full-Time'
            };
        });
    }

    /**
     * Subscribe to real-time employee status updates
     */
    subscribeToUpdates(
        orgId: string,
        callback: (employees: Employee[]) => void
    ): () => void {
        const channelName = `employee-status-${orgId}`;

        // Clean up existing subscription if any
        if (this.subscriptions.has(channelName)) {
            supabase.removeChannel(this.subscriptions.get(channelName));
        }

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'attendance', filter: `org_id=eq.${orgId}` },
                async () => {
                    const employees = await this.fetchEmployees(orgId);
                    callback(employees);
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'leaves', filter: `org_id=eq.${orgId}` },
                async () => {
                    const employees = await this.fetchEmployees(orgId);
                    callback(employees);
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'profiles', filter: `org_id=eq.${orgId}` },
                async () => {
                    const employees = await this.fetchEmployees(orgId);
                    callback(employees);
                }
            )
            .subscribe();

        this.subscriptions.set(channelName, channel);

        // Return cleanup function
        return () => {
            supabase.removeChannel(channel);
            this.subscriptions.delete(channelName);
        };
    }

    /**
     * Get cached employee status
     */
    getEmployeeStatus(employeeId: string): EmployeeStatus | undefined {
        return this.statusCache.get(employeeId);
    }

    /**
     * Get cached employees for an org
     */
    getCachedEmployees(orgId: string): Employee[] {
        return this.employeeCache.get(orgId) || [];
    }

    /**
     * Clear cache for an org
     */
    clearCache(orgId: string): void {
        this.employeeCache.delete(orgId);
    }
}

// Export singleton instance
export const employeeService = EmployeeService.getInstance();
export default employeeService;
