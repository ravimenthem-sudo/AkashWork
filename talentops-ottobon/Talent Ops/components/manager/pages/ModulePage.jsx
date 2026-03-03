import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Edit, Users, Clock, Activity, Target, TrendingUp, ChevronRight, LayoutGrid, List, Search, CheckCircle, MoreVertical, AlertTriangle } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { EditEmployeeModal } from '../../shared/EditEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { useUser } from '../context/UserContext';
import { useProject } from '../../employee/context/ProjectContext';
import ProjectDocuments from '../../employee/pages/ProjectDocuments';


const APPLIER_RESPONSIBILITIES = [
    "Complete high-priority current tasks",
    "Handover pending tasks to a teammate",
    "Update status/progress on all active tasks",
    "Ensure relevant documentation is accessible"
];



const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { userId, userRole, orgId } = useUser();
    const { currentProject, projectRole } = useProject();
    const navigate = useNavigate();

    // State for view controls
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState('grid');
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [availabilityFilter, setAvailabilityFilter] = useState('all');

    // State for leave requests
    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);

    // ... (rest of states remain same)

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [evalBalance, setEvalBalance] = useState(0);
    const [evalPendingPaid, setEvalPendingPaid] = useState(0);

    // ... (rest of states)

    const [remainingLeaves, setRemainingLeaves] = useState(0);
    const [pendingTasks, setPendingTasks] = useState([]);

    // AI Leave Analysis state


    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({
        leaveType: 'Casual Leave',
        startDate: '',
        endDate: '',
        reason: ''
    });
    const [selectedDates, setSelectedDates] = useState([]);
    const [dateToAdd, setDateToAdd] = useState('');

    const addSelectedDate = (date) => {
        if (!date) return;
        setSelectedDates(prev => {
            const set = new Set(prev);
            if (set.has(date)) return prev;
            set.add(date);
            return Array.from(set).sort();
        });
    };

    const removeSelectedDate = (date) => {
        setSelectedDates(prev => prev.filter(d => d !== date));
    };

    // State for Employee Details modal
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // State for Handover Modal
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedMemberForHandover, setSelectedMemberForHandover] = useState(null);

    // State for Edit Employee modal
    const [employeeToEdit, setEmployeeToEdit] = useState(null);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // Data State
    const [employees, setEmployees] = useState([]);
    const [employeeStatus, setEmployeeStatus] = useState([]);
    const [dbLeaves, setDbLeaves] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
    const [policyError, setPolicyError] = useState(null);
    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);


    React.useEffect(() => {
        const fetchData = async () => {
            try {
                if (type === 'workforce') {
                    let userIdsToFetch = null;

                    // Filter by Project REMOVED to show ALL employees in Organization
                    // if (currentProject?.id) { ... }

                    // 1. Fetch profiles with full details
                    let query = supabase
                        .from('profiles')
                        .select(`
                            id, 
                            full_name, 
                            email, 
                            role, 
                            job_title, 
                            department,
                            created_at,
                            avatar_url
                        `)
                        .eq('org_id', orgId);

                    if (userIdsToFetch) {
                        query = query.in('id', userIdsToFetch);
                    }

                    const { data: profilesData, error: profileError } = await query;

                    if (profileError) throw profileError;

                    // 2. Fetch departments for mapping
                    const { data: deptData } = await supabase
                        .from('departments')
                        .select('id, department_name')
                        .eq('org_id', orgId);

                    const deptMap = {};
                    if (deptData) {
                        deptData.forEach(d => deptMap[d.id] = d.department_name);
                    }

                    // 3. Fetch project assignments
                    const { data: assignments } = await supabase
                        .from('project_members')
                        .select('user_id, projects:project_id(name)')
                        .eq('org_id', orgId);

                    const projectMap = {};
                    if (assignments) {
                        assignments.forEach(a => {
                            if (!projectMap[a.user_id]) {
                                projectMap[a.user_id] = [];
                            }
                            if (a.projects?.name) {
                                projectMap[a.user_id].push(a.projects.name);
                            }
                        });
                    }

                    // 3. Fetch Attendance & Leaves for Status
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    const { data: attendanceData } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .in('date', [yesterday, today])
                        .eq('org_id', orgId);

                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .eq('org_id', orgId)
                        .lte('from_date', today)
                        .gte('to_date', today);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));
                    const attendanceMap = {};
                    if (attendanceData) {
                        // Sort so most recent record is stored in map
                        const sortedAtt = [...attendanceData].sort((a, b) => {
                            if (a.date !== b.date) return a.date.localeCompare(b.date);
                            return a.clock_in.localeCompare(b.clock_in);
                        });
                        sortedAtt.forEach(record => attendanceMap[record.employee_id] = record);
                    }

                    if (profilesData) {
                        // Populate BOTH employees (legacy) and employeeStatus (rich view)
                        const richData = profilesData.map(emp => {
                            const attendance = attendanceMap[emp.id];
                            let availability = 'Offline';
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

                            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                                availability = 'On Leave';
                            }

                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'No active task' : '-';

                            return {
                                id: emp.id,
                                name: emp.full_name || 'N/A',
                                email: emp.email || 'N/A',
                                role: emp.role || 'N/A',
                                job_title: emp.job_title || 'N/A',
                                department_display: deptMap[emp.department] || emp.department || 'Main Office',
                                dept: (projectMap[emp.id] && projectMap[emp.id].length > 0) ? projectMap[emp.id].join(', ') : 'Unassigned',
                                projects: projectMap[emp.id]?.length || 0,
                                status: 'Active',
                                joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A',
                                avatar_url: emp.avatar_url,
                                availability: availability,
                                task: currentTask,
                                lastActive: lastActive
                            };
                        });

                        setEmployees(richData);
                        setEmployeeStatus(richData);
                    }
                } else if (type === 'project-members') {
                    // Fetch employees who are members of the CURRENT PROJECT only
                    if (!currentProject?.id) {
                        setEmployees([]);
                        setEmployeeStatus([]);
                        return;
                    }

                    // 1. Fetch project members for current project
                    const { data: projectMembersData, error: projectMembersError } = await supabase
                        .from('project_members')
                        .select('user_id, role')
                        .eq('project_id', currentProject.id)
                        .eq('org_id', orgId);

                    if (projectMembersError) throw projectMembersError;

                    const userIdsInProject = projectMembersData?.map(pm => pm.user_id) || [];
                    const memberRoleMap = {};
                    projectMembersData?.forEach(pm => {
                        memberRoleMap[pm.user_id] = pm.role;
                    });

                    if (userIdsInProject.length === 0) {
                        setEmployees([]);
                        setEmployeeStatus([]);
                        return;
                    }

                    // 2. Fetch profiles for project members only
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
                            avatar_url
                        `)
                        .eq('org_id', orgId)
                        .in('id', userIdsInProject);

                    if (profileError) throw profileError;

                    // 3. Fetch departments for mapping
                    const { data: deptData } = await supabase
                        .from('departments')
                        .select('id, department_name')
                        .eq('org_id', orgId);

                    const deptMap = {};
                    if (deptData) {
                        deptData.forEach(d => deptMap[d.id] = d.department_name);
                    }

                    // 4. Fetch Attendance & Leaves for Status
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    const { data: attendanceData } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .in('date', [yesterday, today])
                        .eq('org_id', orgId)
                        .in('employee_id', userIdsInProject);

                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .eq('org_id', orgId)
                        .lte('from_date', today)
                        .gte('to_date', today)
                        .in('employee_id', userIdsInProject);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));
                    const attendanceMap = {};
                    if (attendanceData) {
                        const sortedAtt = [...attendanceData].sort((a, b) => {
                            if (a.date !== b.date) return a.date.localeCompare(b.date);
                            return (a.clock_in || '').localeCompare(b.clock_in || '');
                        });
                        sortedAtt.forEach(record => attendanceMap[record.employee_id] = record);
                    }

                    if (profilesData) {
                        const richData = profilesData.map(emp => {
                            const attendance = attendanceMap[emp.id];
                            let availability = 'Offline';
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

                            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                                availability = 'On Leave';
                            }

                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'No active task' : '-';

                            // Get project role for this member
                            let projectRoleDisplay = memberRoleMap[emp.id] || 'Member';
                            if (projectRoleDisplay === 'team_lead') projectRoleDisplay = 'Team Lead';
                            else if (projectRoleDisplay === 'employee') projectRoleDisplay = 'Member';
                            else if (projectRoleDisplay === 'manager') projectRoleDisplay = 'Manager';

                            return {
                                id: emp.id,
                                name: emp.full_name || 'N/A',
                                email: emp.email || 'N/A',
                                role: emp.role || 'N/A',
                                job_title: emp.job_title || 'N/A',
                                department_display: deptMap[emp.department] || emp.department || 'Main Office',
                                dept: currentProject.name, // Show project name as department
                                projects: 1,
                                project_role: projectRoleDisplay, // Role in this project
                                status: 'Active',
                                joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A',
                                avatar_url: emp.avatar_url,
                                availability: availability,
                                task: currentTask,
                                lastActive: lastActive
                            };
                        });

                        setEmployees(richData);
                        setEmployeeStatus(richData);
                    }
                } else if (type === 'status') {
                    // Fetch profiles
                    const { data: profiles, error: profileError } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, job_title, avatar_url, department')
                        .eq('org_id', orgId);

                    if (profileError) throw profileError;

                    // Fetch departments for mapping
                    const { data: deptData } = await supabase
                        .from('departments')
                        .select('id, department_name')
                        .eq('org_id', orgId);

                    const deptMap = {};
                    if (deptData) {
                        deptData.forEach(d => deptMap[d.id] = d.department_name);
                    }

                    // Fetch project assignments from project_members
                    const { data: assignments } = await supabase
                        .from('project_members')
                        .select('user_id, projects:project_id(name)')
                        .eq('org_id', orgId);

                    const projectMap = {};
                    if (assignments) {
                        assignments.forEach(a => {
                            if (!projectMap[a.user_id]) {
                                projectMap[a.user_id] = [];
                            }
                            if (a.projects?.name) {
                                projectMap[a.user_id].push(a.projects.name);
                            }
                        });
                    }

                    // Fetch TODAY'S attendance for "Availability", "Last Active", and "Current Task"
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    console.log('🔍 Team Status - Fetching attendance for range:', [yesterday, today]);

                    const { data: attendanceData, error: attendanceError } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .in('date', [yesterday, today])
                        .eq('org_id', orgId);

                    console.log('📊 Team Status - Attendance Data:', attendanceData);
                    console.log('📊 Team Status - Profiles Count:', profiles?.length);

                    // Fetch TODAY'S leaves for "On Leave" status
                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .eq('org_id', orgId)
                        .lte('from_date', today)
                        .gte('to_date', today);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));

                    if (profiles) {
                        const attendanceMap = {};
                        if (attendanceData) {
                            attendanceData.forEach(record => {
                                attendanceMap[record.employee_id] = record;
                            });
                        }

                        console.log('🗺️ Team Status - Attendance Map:', attendanceMap);

                        setEmployeeStatus(profiles.map(emp => {
                            // Determine Availability from Attendance
                            const attendance = attendanceMap[emp.id];
                            let availability = 'Offline';
                            let lastActive = 'N/A';

                            console.log(`👤 Processing ${emp.full_name}:`, {
                                id: emp.id,
                                hasAttendance: !!attendance,
                                attendance: attendance
                            });

                            if (attendance) {
                                if (attendance.clock_in && !attendance.clock_out) {
                                    availability = 'Online';
                                    lastActive = `Clocked in at ${attendance.clock_in.slice(0, 5)}`;
                                } else if (attendance.clock_out) {
                                    availability = 'Offline';
                                    lastActive = `Left at ${attendance.clock_out.slice(0, 5)}`;
                                }
                            }

                            // Check Leave Status (Override Offline if on leave)
                            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                                availability = 'On Leave';
                            }

                            // Determine Current Task from Attendance (User Input)
                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'No active task' : '-';

                            console.log(`✅ Final status for ${emp.full_name}:`, availability);

                            return {
                                id: emp.id,
                                name: emp.full_name || 'Unknown',
                                dept: (projectMap[emp.id] && projectMap[emp.id].length > 0) ? projectMap[emp.id].join(', ') : 'Talent Ops',
                                department_display: deptMap[emp.department] || emp.department || 'Main Office',
                                availability: availability,
                                task: currentTask,
                                lastActive: lastActive,
                                avatar_url: emp.avatar_url,
                                role: emp.role || 'Employee',
                                job_title: emp.job_title || 'N/A',
                                projects: projectMap[emp.id]?.length || 0
                            };
                        }));
                    }
                } else if (type === 'leaves') {
                    if (!orgId) return;
                    console.log('Fetching leaves for Manager...');

                    // Get current user ID to filter out their own requests
                    const { data: { user } } = await supabase.auth.getUser();
                    const currentUserId = user?.id;

                    // Fetch leaves and profiles separately to avoid join issues
                    const { data: leavesData, error: leavesError } = await supabase
                        .from('leaves')
                        .select('*')
                        .eq('org_id', orgId);

                    if (leavesError) console.error('Error fetching leaves:', leavesError);
                    console.log('Manager Leaves Data RAW:', leavesData);

                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .eq('org_id', orgId);

                    if (profilesError) console.error('Error fetching profiles:', profilesError);
                    console.log('Manager Profiles Data RAW:', profilesData);

                    if (leavesData) {
                        // Create a map of id -> name for quick lookup
                        const profileMap = {};
                        if (profilesData) {
                            profilesData.forEach(p => {
                                profileMap[p.id] = p.full_name;
                            });
                        }

                        // Filter out manager's own leaves and map the rest
                        const filteredLeaves = leavesData
                            .filter(leave => leave.employee_id !== currentUserId)
                            .map(leave => {
                                const start = new Date(leave.from_date);
                                const end = new Date(leave.to_date);
                                const diffTime = Math.abs(end - start);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                                let type = 'Leave';
                                let reason = leave.reason || '';
                                if (reason.includes(':')) {
                                    type = reason.split(':')[0];
                                } else if (leave.leave_type) {
                                    type = leave.leave_type;
                                }

                                // Use map to find name, or fallback
                                const name = profileMap[leave.employee_id] || 'Unknown';

                                return {
                                    id: leave.id,
                                    employee_id: leave.employee_id, // Added for refund logic
                                    name: name,
                                    type: type,
                                    reason: leave.reason || 'No reason provided', // Include full reason from DB
                                    startDate: leave.from_date, // Added for calculation
                                    endDate: leave.to_date, // Added for calculation
                                    duration: `${diffDays} Days`,
                                    duration_weekdays: leave.duration_weekdays, // Critical for approval calculation
                                    lop_days: leave.lop_days, // Critical for approval calculation
                                    dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                    status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                                };
                            });

                        setDbLeaves(filteredLeaves);
                    }
                } else if (type === 'employee-leave-info') {
                    if (!orgId) return;
                    try {
                        console.log('Fetching aggregated leave info...');
                        // Fetch all profiles
                        const { data: profiles, error: pError } = await supabase
                            .from('profiles')
                            .select('id, full_name, total_leaves_balance')
                            .eq('org_id', orgId);

                        if (pError) throw pError;

                        // Fetch all approved leaves
                        const { data: leaves, error: lError } = await supabase
                            .from('leaves')
                            .select('employee_id, duration_weekdays, lop_days')
                            .eq('org_id', orgId)
                            .eq('status', 'approved');

                        if (lError) throw lError;

                        if (profiles) {
                            const stats = profiles.map(profile => {
                                const empLeaves = leaves?.filter(l => l.employee_id === profile.id) || [];
                                const paidDays = empLeaves.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0);
                                const lopDays = empLeaves.reduce((sum, l) => sum + (l.lop_days || 0), 0);
                                const totalTaken = paidDays + lopDays;

                                return {
                                    id: profile.id,
                                    name: profile.full_name,
                                    total_taken: `${totalTaken} Days`,
                                    paid_leaves: `${paidDays} Days`,
                                    lop_days: `${lopDays} Days`,
                                    leaves_left: `${profile.total_leaves_balance || 0} Days`
                                };
                            });
                            setDbLeaves(stats);
                        }
                    } catch (error) {
                        console.error('Error fetching aggregated leave info:', error);
                    }
                } else if (type === 'my-leaves') {
                    console.log('Fetching my leaves...');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        console.log('No user found');
                        return;
                    }

                    const { data, error } = await supabase
                        .from('leaves')
                        .select('*')
                        .eq('employee_id', user.id)
                        .eq('org_id', orgId);

                    if (error) {
                        console.error('Error fetching my leaves:', error);
                        return;
                    }

                    console.log('My leaves data:', data);

                    if (data) {
                        setDbLeaves(data.map(leave => {
                            const start = new Date(leave.from_date);
                            const end = new Date(leave.to_date);
                            const diffTime = Math.abs(end - start);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                            let type = 'Leave';
                            let reason = leave.reason || '';
                            if (reason.includes(':')) {
                                type = reason.split(':')[0];
                            } else if (leave.leave_type) {
                                type = leave.leave_type;
                            }

                            return {
                                id: leave.id,
                                name: 'You',
                                type: type,
                                duration: `${diffDays} Days`,
                                dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                            };
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        const fetchRemainingLeaves = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('total_leaves_balance')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();

            if (data) {
                setRemainingLeaves(data.total_leaves_balance || 0);
            }
        };

        fetchData();
        if (type === 'leaves' || type === 'my-leaves') {
            fetchRemainingLeaves();
        }
    }, [type, refreshTrigger, currentProject?.id, orgId]);

    // Fetch Policies from Supabase
    React.useEffect(() => {
        const fetchPolicies = async () => {
            if (type === 'policies' && orgId) {
                try {
                    console.log('Fetching policies from Supabase...');
                    setIsLoadingPolicies(true);
                    setPolicyError(null);

                    const { data, error } = await supabase
                        .from('policies')
                        .select('*')
                        .eq('status', 'Active')
                        .eq('org_id', orgId)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error('Error fetching policies:', error);
                        setPolicyError(error.message);
                        return;
                    }

                    if (data) {
                        const transformedPolicies = data.map(policy => ({
                            id: policy.id,
                            name: policy.title || 'Untitled Policy',
                            category: policy.category || 'General',
                            effectiveDate: policy.effective_date ? new Date(policy.effective_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                            status: policy.status || 'Active',
                            file_url: policy.file_url
                        }));
                        setPolicies(transformedPolicies);
                    }
                } catch (err) {
                    console.error('Unexpected error fetching policies:', err);
                    setPolicyError(err.message);
                } finally {
                    setIsLoadingPolicies(false);
                }
            }
        };

        fetchPolicies();
    }, [type, refreshTrigger, orgId]);


    // Real-time Subscription for Live Status & Data
    React.useEffect(() => {
        const sub = supabase
            .channel('manager-module-complete-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

    const fetchPendingTasks = async (employeeId, beforeDate) => {
        try {
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .not('status', 'in', '("completed","closed")');

            if (beforeDate) {
                query = query.lt('due_date', beforeDate);
            }

            const { data, error } = await query
                .order('due_date', { ascending: true })
                .limit(5);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
            return [];
        }
    };

    const fetchEmployeeTasks = async (employeeId, startDate, endDate) => {
        try {
            // Overlap logic: Task Start <= Leave End AND Task End >= Leave Start
            // We assume table has 'start_date' and 'due_date'
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .lte('start_date', endDate)  // Task starts before or on leave end
                .gte('due_date', startDate); // Task ends after or on leave start

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            // Fallback to simpler check if start_date doesn't exist or errors
            return [];
        }
    };

    const handleViewLeave = async (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);


        // Fetch tasks for the employee during leave dates
        const tasks = await fetchEmployeeTasks(
            leaveRequest.employee_id,
            leaveRequest.startDate, // Use standardized camelCase keys from transformation
            leaveRequest.endDate
        );
        setEmployeeTasks(tasks);

        // Fetch pending tasks (Backlog) for the EMPLOYEE (not the approver)
        // These are tasks due BEFORE the leave starts
        const pTasks = await fetchPendingTasks(leaveRequest.employee_id, leaveRequest.startDate);
        setPendingTasks(pTasks);

        // Fetch live balance and other pending requests for re-evaluation preview
        const { data: profile } = await supabase
            .from('profiles')
            .select('total_leaves_balance')
            .eq('id', leaveRequest.employee_id)
            .single();

        const { data: pending } = await supabase
            .from('leaves')
            .select('duration_weekdays')
            .eq('employee_id', leaveRequest.employee_id)
            .eq('status', 'pending')
            .neq('id', leaveRequest.id); // Exclude the current one

        setEvalBalance(profile?.total_leaves_balance || 0);
        setEvalPendingPaid(pending?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0);



        setShowLeaveDetailsModal(true);
    };

    const handlePolicyView = async (policy) => {
        try {
            console.log('Attempting to view policy:', policy);

            if (!policy.file_url) {
                console.error('No file_url found in policy object');
                addToast('No document available to view', 'error');
                return;
            }

            addToast('Opening document...', 'info');

            // Extract file path from the storage URL
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Viewing path:', filePath);

            // Create a signed URL valid for 60 seconds
            const { data, error } = await supabase.storage
                .from('policies')
                .createSignedUrl(filePath, 60);

            if (error) {
                console.error('Error creating signed URL:', error);
                throw error;
            }

            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            } else {
                throw new Error('No signed URL returned');
            }

        } catch (error) {
            console.error('View error:', error);
            addToast(`Could not view document: ${error.message}`, 'error');
        }
    };

    const handlePolicyDownload = async (policy) => {
        try {
            console.log('Attempting to download policy:', policy);
            console.log('File URL:', policy.file_url);

            if (!policy.file_url) {
                console.error('No file_url found in policy object');
                addToast('No document available for this policy', 'error');
                return;
            }

            addToast('Downloading policy...', 'info');

            // Extract file path from the storage URL
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

            // Download from policies bucket
            const { data, error } = await supabase.storage
                .from('policies')
                .download(filePath);

            if (error) {
                console.error('Download error:', error);
                throw error;
            }

            if (!data) {
                throw new Error('No data returned from download');
            }

            console.log('Download successful, creating blob URL...');

            const pdfBlob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${policy.name}.pdf`;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            addToast(`${policy.name} downloaded successfully`, 'success');

        } catch (error) {
            console.error('Download error:', error);
            addToast(`Could not download: ${error.message || 'File missing'}`, 'error');
        }
    };

    const handlePolicySuccess = (newPolicy) => {
        // Refresh the policies list
        setRefreshTrigger(prev => prev + 1);
        addToast(`Policy "${newPolicy.title}" created successfully!`, 'success');
    };

    const handleAction = async (action, item) => {
        if ((type === 'leaves' || type === 'my-leaves') && action === 'Apply for Leave') {
            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setSelectedDates([]);
            setDateToAdd('');

            // Fetch pending tasks for the applier (Current Manager)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tasks = await fetchPendingTasks(user.id);
                setPendingTasks(tasks);
            }

            setShowApplyLeaveModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';

            // Optimistic update (Uppercase for UI)
            setDbLeaves(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: newStatus }
                        : request
                )
            );

            try {
                // Database update (Lowercase for DB)
                const dbStatus = action === 'Approve' ? 'approved' : 'rejected';

                // Fetch latest profile status for the employee
                const { data: profileData, error: profileFetchError } = await supabase
                    .from('profiles')
                    .select('leaves_taken_this_month, total_leaves_balance')
                    .eq('id', item.employee_id)
                    .eq('org_id', orgId)
                    .single();

                if (profileFetchError) throw profileFetchError;

                let finalPaid = item.duration_weekdays || 0;
                let finalLop = item.lop_days || 0;

                if (action === 'Approve') {
                    // Re-calculate the split based on the CURRENT live balance
                    // This allows "converting" LOP to Paid if other leaves were rejected in the meantime
                    const totalRequestedWeekdays = (item.duration_weekdays || 0) + (item.lop_days || 0);
                    const currentBalance = profileData.total_leaves_balance || 0;

                    finalPaid = Math.max(0, Math.min(totalRequestedWeekdays, currentBalance));
                    finalLop = totalRequestedWeekdays - finalPaid;

                    // Update leave record with final split and status
                    const { error: leaveUpdateError } = await supabase
                        .from('leaves')
                        .update({
                            status: dbStatus,
                            duration_weekdays: finalPaid,
                            lop_days: finalLop
                        })
                        .eq('id', item.id)
                        .eq('org_id', orgId);

                    if (leaveUpdateError) throw leaveUpdateError;

                    // Update profile for deduction
                    const newTaken = (profileData.leaves_taken_this_month || 0) + finalPaid;
                    const newBalance = currentBalance - finalPaid;

                    const { error: profileUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            leaves_taken_this_month: newTaken,
                            total_leaves_balance: newBalance
                        })
                        .eq('id', item.employee_id)
                        .eq('org_id', orgId);

                    if (profileUpdateError) throw profileUpdateError;
                    console.log(`Approved: Deducted ${finalPaid} paid days. New balance: ${newBalance}`);

                } else {
                    // For Rejection, we just update status. 
                    // No refund logic needed because balance was never deducted upfront.
                    const { error: rejectError } = await supabase
                        .from('leaves')
                        .update({ status: dbStatus })
                        .eq('id', item.id)
                        .eq('org_id', orgId);

                    if (rejectError) throw rejectError;
                }

                // Send Notification to the Employee
                const { data: { user } } = await supabase.auth.getUser();
                if (user && item.employee_id) {
                    const actionWord = action === 'Approve' ? 'Approved' : 'Rejected';
                    let notificationMessage = `Your leave request for ${item.dates} has been ${actionWord}.`;

                    if (action === 'Approve' && finalLop > 0) {
                        notificationMessage += ` (Partial LOP: ${finalLop} days)`;
                    }

                    await supabase.from('notifications').insert({
                        receiver_id: item.employee_id,
                        sender_id: user.id,
                        org_id: orgId,
                        sender_name: 'Management',
                        message: notificationMessage,
                        type: 'leave_status',
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                }

                addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
            } catch (error) {
                console.error('Error updating leave request:', error);
                addToast(`Failed to ${action.toLowerCase()} leave request`, 'error');
                // Revert optimistic update if needed
            }
        } else if (action === 'View Employee' || action === 'View Status') {
            // Fetch additional financial details for the employee
            try {
                const { data: financeData, error: financeError } = await supabase
                    .from('employee_finance')
                    .select('*')
                    .eq('employee_id', item.id)
                    .eq('org_id', orgId)
                    .eq('is_active', true)
                    .order('effective_from', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Fetch task completion count
                const { data: tasksData } = await supabase
                    .from('tasks')
                    .select('id, status')
                    .eq('assigned_to', item.id)
                    .eq('org_id', orgId);

                const completedTasks = tasksData?.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length || 0;
                const totalTasks = tasksData?.length || 0;

                // Calculate gross salary (basic + hra + allowances)
                const basicSalary = financeData?.basic_salary || 0;
                const hra = financeData?.hra || 0;
                const allowances = financeData?.allowances || 0;
                const grossSalary = basicSalary + hra + allowances;

                // Merge finance data with employee data
                const enrichedEmployee = {
                    ...item,
                    // Financial details from employee_finance
                    basic_salary: basicSalary,
                    hra: hra,
                    allowances: allowances,
                    gross_salary: grossSalary,
                    effective_from: financeData?.effective_from || null,
                    effective_to: financeData?.effective_to || null,
                    // Task metrics
                    tasksCompleted: completedTasks,
                    totalTasks: totalTasks,
                    // Calculate performance if not already present
                    performance: item.performance || (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 'N/A')
                };

                setSelectedEmployee(enrichedEmployee);
                setShowEmployeeModal(true);
            } catch (error) {
                console.error('Error fetching employee details:', error);
                // Still show modal with basic data if fetch fails
                setSelectedEmployee({
                    ...item,
                    basic_salary: 0,
                    hra: 0,
                    allowances: 0,
                    gross_salary: 0,
                    tasksCompleted: 0,
                    totalTasks: 0,
                    performance: item.performance || 'N/A'
                });
                setShowEmployeeModal(true);
            }
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else if (action === 'Edit Employee') {
            setEmployeeToEdit(item);
            setShowEditEmployeeModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const initiatHandover = (member) => {
        setSelectedMemberForHandover(member);
        setShowHandoverModal(true);
    };

    const confirmHandover = async () => {
        if (!currentProject || !selectedMemberForHandover) return;

        try {
            const { error } = await supabase.rpc('handover_project_role', {
                project_id_input: currentProject.id,
                target_user_id_input: selectedMemberForHandover.id // Use .id from employees row
            });

            if (error) throw error;

            addToast('Role handover successful! You are now an employee.', 'success');
            setShowHandoverModal(false);
            setSelectedMemberForHandover(null);

            // Refresh
            setRefreshTrigger(prev => prev + 1);
            // Ideally navigate away or refresh full app context if privileges are lost
        } catch (error) {
            console.error('Handover failed:', error);
            addToast(error.message || 'Handover failed', 'error');
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        const useSpecificDates = selectedDates.length > 0;
        const datesToApply = useSpecificDates
            ? Array.from(new Set(selectedDates)).sort()
            : [];

        if (useSpecificDates && datesToApply.length === 0) {
            addToast('Please select at least one leave date.', 'error');
            return;
        }

        if (!useSpecificDates && (!leaveFormData.startDate || !leaveFormData.endDate || leaveFormData.endDate < leaveFormData.startDate)) {
            addToast('End date must be the same or after the start date.', 'error');
            return;
        }

        // Calculate duration (days)
        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const requestedDays = useSpecificDates ? datesToApply.length : diffDays;
        const duration = requestedDays === 1 ? '1 Day' : `${requestedDays} Days`;

        // Format dates for display
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        };
        const datesDisplay = useSpecificDates
            ? datesToApply.map(formatDate).join(', ')
            : (leaveFormData.startDate === leaveFormData.endDate
                ? formatDate(leaveFormData.startDate)
                : `${formatDate(leaveFormData.startDate)} - ${formatDate(leaveFormData.endDate)}`);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const leaveReason = `${leaveFormData.leaveType}: ${leaveFormData.reason}` +
                (useSpecificDates ? ` (Dates: ${datesToApply.join(', ')})` : '');

            const leaveRows = useSpecificDates
                ? datesToApply.map(date => ({
                    employee_id: user.id,
                    org_id: orgId,
                    from_date: date,
                    to_date: date,
                    reason: leaveReason,
                    status: 'pending'
                }))
                : [{
                    employee_id: user.id,
                    org_id: orgId,
                    from_date: leaveFormData.startDate,
                    to_date: leaveFormData.endDate,
                    reason: leaveReason,
                    status: 'pending'
                }];

            // Insert into DB
            const { data, error } = await supabase
                .from('leaves')
                .insert(leaveRows)
                .select();

            if (error) throw error;

            // Balance update REMOVED. Deduction now occurs only on Approval to prevent balance jumps.

            // Update local state
            if (data && data.length > 0) {
                const newRequests = data.map(row => {
                    const rowStart = new Date(row.from_date);
                    const rowEnd = new Date(row.to_date);
                    const rowDiff = Math.ceil(Math.abs(rowEnd - rowStart) / (1000 * 60 * 60 * 24)) + 1;
                    const rowDates = rowStart.toDateString() === rowEnd.toDateString()
                        ? rowStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                        : `${rowStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${rowEnd.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`;
                    return {
                        id: row.id,
                        name: 'Manager (You)',
                        type: leaveFormData.leaveType,
                        duration: rowDiff === 1 ? '1 Day' : `${rowDiff} Days`,
                        dates: rowDates,
                        status: 'Pending'
                    };
                });
                setDbLeaves([...newRequests, ...dbLeaves]);
            }

            setShowApplyLeaveModal(false);
            setLeaveFormData({
                leaveType: 'Casual Leave',
                startDate: '',
                endDate: '',
                reason: ''
            });
            setSelectedDates([]);
            setDateToAdd('');
            addToast('Leave application submitted successfully', 'success');
        } catch (error) {
            console.error('Error applying for leave:', error);
            addToast('Failed to submit leave request: ' + error.message, 'error');
        }
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo currentProject={currentProject} projectRole={projectRole} userId={userId} />;
    if (type === 'tasks') return <AllTasksView key="team-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="team_tasks" orgId={orgId} />;
    if (type === 'global-tasks') return <AllTasksView key="global-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="global_tasks" orgId={orgId} />;
    if (type === 'personal-tasks') return <AllTasksView key="personal-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="my_tasks" orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') {
        return (
            <div style={{ height: 'calc(100vh - 200px)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <HierarchyDemo />
            </div>
        );
    }
    if (title === 'Project Hierarchy') {
        return (
            <div style={{ height: 'calc(100vh - 200px)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <ProjectHierarchyDemo />
            </div>
        );
    }
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'documents') return <ProjectDocuments />;

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Employee Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {row.name.charAt(0)}
                            </div>
                            <div>
                                <p style={{ fontWeight: 500 }}>{row.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Project', accessor: 'dept' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => handleAction('View Employee', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#e0f2fe',
                                    color: '#075985',
                                    border: '1px solid #7dd3fc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                            >
                                <Eye size={14} />
                                View
                            </button>

                            {/* More Actions Menu (Kebab) - Only for PM/TL and not for self */}
                            {((projectRole === 'project_manager' || projectRole === 'team_lead') && row.id !== userId) && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}
                                        style={{
                                            padding: '6px',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {activeMenuId === row.id && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '4px',
                                            backgroundColor: 'white',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                            border: '1px solid #f3f4f6',
                                            width: '160px',
                                            zIndex: 50,
                                            overflow: 'hidden',
                                            padding: '4px'
                                        }}>
                                            <button
                                                onClick={() => { initiatHandover(row); setActiveMenuId(null); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px 12px',
                                                    fontSize: '0.8rem',
                                                    color: '#d97706',
                                                    backgroundColor: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    borderRadius: '6px'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                            >
                                                <Users size={14} /> Handover Role
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                },
            ],
            data: employees
        },
        status: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Project', accessor: 'dept' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],
            data: employeeStatus
        },
        recruitment: {
            columns: [
                { header: 'Candidate', accessor: 'name' },
                { header: 'Applied For', accessor: 'role' },
                {
                    header: 'Stage', accessor: 'stage', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#e0f2fe',
                            color: '#075985'
                        }}>
                            {row.stage}
                        </span>
                    )
                },
                {
                    header: 'Score', accessor: 'score', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', width: '60px' }}>
                                <div style={{ width: `${row.score}%`, height: '100%', backgroundColor: row.score > 80 ? 'var(--success)' : 'var(--warning)', borderRadius: '3px' }}></div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.score}%</span>
                        </div>
                    )
                },
                { header: 'Source', accessor: 'source' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Candidate', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],
            data: []
        },
        leaves: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Type', accessor: 'type' },
                { header: 'Duration', accessor: 'duration' },
                { header: 'Dates', accessor: 'dates' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                            color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                        }}>
                            {row.status}
                        </span>
                    )
                },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        row.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleViewLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#e0f2fe',
                                        color: '#075985',
                                        border: '1px solid #7dd3fc',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                >
                                    <Eye size={14} />
                                    View
                                </button>
                                <button
                                    onClick={() => handleViewLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        border: '1px solid #86efac',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleViewLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fca5a5',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                >
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleViewLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#e0f2fe',
                                        color: '#075985',
                                        border: '1px solid #7dd3fc',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                >
                                    <Eye size={14} />
                                    View
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>-</span>
                            </div>
                        )
                    )
                },
            ],
            data: dbLeaves.length > 0 ? dbLeaves : leaveRequests
        },
        'employee-leave-info': {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Total Leaves Taken', accessor: 'total_taken' },
                { header: 'Paid Leaves', accessor: 'paid_leaves' },
                { header: 'Loss of Pay Days', accessor: 'lop_days' },
                { header: 'Leaves Left', accessor: 'leaves_left' }
            ],
            data: dbLeaves
        },
        'my-leaves': {
            columns: [
                { header: 'Type', accessor: 'type' },
                { header: 'Duration', accessor: 'duration' },
                { header: 'Dates', accessor: 'dates' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                            color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                        }}>
                            {row.status}
                        </span>
                    )
                }
            ],
            data: dbLeaves
        },
        payroll: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Month', accessor: 'month' },
                { header: 'Net Salary', accessor: 'salary' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                { header: 'Payslip', accessor: 'action', render: () => <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Download</span> }
            ],
            data: []
        },
        policies: {
            columns: [
                { header: 'Policy Name', accessor: 'name' },
                { header: 'Category', accessor: 'category' },
                { header: 'Effective Date', accessor: 'effectiveDate' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: row.status === 'Active' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                {
                    header: 'View',
                    accessor: 'view',
                    render: (row) => (
                        <button
                            onClick={() => handlePolicyView(row)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#bae6fd';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#e0f2fe';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            <Eye size={16} />
                            View
                        </button>
                    )
                },
                {
                    header: 'Download',
                    accessor: 'download',
                    render: (row) => (
                        <button
                            onClick={() => handlePolicyDownload(row)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#6d28d9';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#7c3aed';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            <Download size={16} />
                            Download
                        </button>
                    )
                }
            ],
            data: policies
        },
        // Default fallback for other modules
        default: {
            columns: [
                { header: 'Item Name', accessor: 'name' },
                { header: 'Description', accessor: 'desc' },
                { header: 'Date', accessor: 'date' },
                { header: 'Status', accessor: 'status' },
            ],
            data: []
        }
    };

    console.log('Current type:', type);
    console.log('Available configs:', Object.keys(configs));
    const config = configs[type] || configs.default;
    console.log('Selected config:', config);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                marginBottom: '16px'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-module" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-module)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Management</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: '600' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                            {title}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                            {type === 'leaves' ? 'Review and manage team leave requests and attendance balance.' :
                                type === 'my-leaves' ? 'Track your personal leave history and available balance.' :
                                    type === 'employee-leave-info' ? 'Detailed breakdown of employee leave balance and history.' :
                                        `Management portal for organizational ${title ? title.toLowerCase() : 'modules'}`}
                        </p>
                    </div>

                    {(type === 'leaves' || type === 'my-leaves' || type === 'employee-leave-info') && (
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
                            {type === 'leaves' && (
                                <button
                                    onClick={() => navigate('/manager-dashboard/leaves/employee-info')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        backdropFilter: 'blur(4px)',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                >
                                    <Users size={20} strokeWidth={3} /> Leave Info
                                </button>
                            )}

                            {type === 'employee-leave-info' && (
                                <button
                                    onClick={() => navigate('/manager-dashboard/leaves')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        backdropFilter: 'blur(4px)',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                >
                                    <ChevronRight size={20} strokeWidth={3} style={{ transform: 'rotate(180deg)' }} /> Back to Requests
                                </button>
                            )}

                            {(type === 'my-leaves') && (
                                <button
                                    onClick={() => handleAction('Apply for Leave')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(56, 189, 248, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.3)';
                                    }}
                                >
                                    <Plus size={20} strokeWidth={3} /> Apply for Leave
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats Summary for Status & Workforce */}
            {(type === 'status' || type === 'workforce' || type === 'project-members') && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px',
                    marginBottom: '8px'
                }}>
                    {[
                        { label: 'Total Workforce', value: employeeStatus.length, icon: <Users size={20} />, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
                        { label: 'Active Now', value: employeeStatus.filter(e => e.availability === 'Online').length, icon: <CheckCircle size={20} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
                        { label: 'On Leave', value: employeeStatus.filter(e => e.availability === 'On Leave').length, icon: <Clock size={20} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                        { label: 'Peak Engagement', value: '92%', icon: <Activity size={20} />, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.1)' }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            backgroundColor: 'var(--card-bg)',
                            borderRadius: '24px',
                            padding: '24px',
                            border: '1px solid var(--card-border)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                backgroundColor: stat.bg,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--card-subtext)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.02em' }}>{stat.label}</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--card-text)' }}>{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search and Filters Bar for Status, Workforce & Project Members */}
            {(type === 'status' || type === 'workforce' || type === 'project-members') && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '24px',
                    marginBottom: '8px'
                }}>
                    <div style={{
                        position: 'relative',
                        flex: 1,
                        maxWidth: '500px'
                    }}>
                        <Search style={{
                            position: 'absolute',
                            left: '20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#94a3b8'
                        }} size={20} />
                        <input
                            type="text"
                            placeholder={`Search employees status...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 50px',
                                borderRadius: '16px',
                                border: '1px solid #f1f5f9',
                                backgroundColor: '#ffffff',
                                fontSize: '0.9rem',
                                color: '#0f172a',
                                outline: 'none',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#38bdf8';
                                e.target.style.boxShadow = '0 10px 20px rgba(56, 189, 248, 0.05)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#f1f5f9';
                                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Availability Filter */}
                        <select
                            value={availabilityFilter}
                            onChange={(e) => setAvailabilityFilter(e.target.value)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '12px',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <option value="all">All Employees</option>
                            <option value="online">Online Only</option>
                            <option value="offline">Offline Only</option>
                            <option value="on-leave">On Leave</option>
                        </select>

                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setViewType('grid')}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: viewType === 'grid' ? '#ffffff' : 'transparent',
                                    color: viewType === 'grid' ? '#0f172a' : '#64748b',
                                    fontWeight: viewType === 'grid' ? '700' : '600',
                                    fontSize: '0.8rem',
                                    border: 'none',
                                    boxShadow: viewType === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <LayoutGrid size={16} /> Grid
                            </button>
                            <button
                                onClick={() => setViewType('list')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    backgroundColor: viewType === 'list' ? '#ffffff' : 'transparent',
                                    color: viewType === 'list' ? '#0f172a' : '#64748b',
                                    fontWeight: viewType === 'list' ? '700' : '600',
                                    fontSize: '0.85rem',
                                    border: 'none',
                                    boxShadow: viewType === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <List size={16} /> List
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Requests Card (For Approval View) */}
            {type === 'leaves' && (
                <div style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b45309',
                        border: '1px solid #fde68a'
                    }}>
                        <Briefcase size={32} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Approval Queue
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
                                {dbLeaves.filter(leave => leave.status && leave.status.toLowerCase() === 'pending').length}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Pending Requests</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Remaining Leaves Card (For Personal View) */}
            {type === 'my-leaves' && (
                <div style={{
                    background: 'white',
                    padding: '32px',
                    borderRadius: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        border: '1px solid #bae6fd'
                    }}>
                        <Briefcase size={32} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Your Balance
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{remainingLeaves}</span>
                            <span style={{ fontSize: '1rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Rich Grid/List View for Status, Workforce & Project Members */}
            {(type === 'status' || type === 'workforce' || type === 'project-members') ? (
                viewType === 'grid' ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '16px',
                        marginTop: '8px'
                    }}>
                        {employeeStatus.filter(emp => {
                            // Search filter
                            const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                emp.department_display?.toLowerCase().includes(searchTerm.toLowerCase());

                            // Availability filter
                            const matchesAvailability =
                                availabilityFilter === 'all' ||
                                (availabilityFilter === 'online' && emp.availability === 'Online') ||
                                (availabilityFilter === 'offline' && emp.availability === 'Offline') ||
                                (availabilityFilter === 'on-leave' && emp.availability === 'On Leave');

                            return matchesSearch && matchesAvailability;
                        }).map((emp) => (
                            <div
                                key={emp.id}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    border: (emp.availability === 'Online') ? '2px solid #22c55e' : '1px solid #f1f5f9',
                                    boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-8px)';
                                    e.currentTarget.style.borderColor = (emp.availability === 'Online') ? '#22c55e' : '#e2e8f0';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.06)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = (emp.availability === 'Online') ? '#22c55e' : '#f1f5f9';
                                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.02)';
                                }}
                                onClick={() => handleAction('View Status', emp)}
                            >
                                {/* Profile Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                            {emp.avatar_url ? (
                                                <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#64748b' }}>{emp.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em' }}>{emp.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>{emp.department_display}</span>
                                                <span style={{ color: '#cbd5e1' }}>•</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : emp.availability === 'On Leave' ? '#ef4444' : '#94a3b8' }}></span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: emp.availability === 'Online' ? '#16a34a' : emp.availability === 'On Leave' ? '#dc2626' : '#64748b' }}>{emp.availability}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('View Status', emp); }}
                                            style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('Edit Employee', emp); }}
                                            style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Workforce: Project Active Badge (instead of Activity Pulse) */}
                                {type === 'workforce' ? (
                                    <div style={{ marginTop: '12px', marginBottom: '4px' }}>
                                        <span style={{
                                            backgroundColor: '#f0fdf4',
                                            color: '#15803d',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: '700',
                                            display: 'inline-block'
                                        }}>
                                            Active on {emp.projects} Projects
                                        </span>
                                    </div>
                                ) : (
                                    /* Status: Activity Pulse */
                                    <div style={{
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        border: '1px solid #f1f5f9',
                                        marginTop: '12px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Activity size={14} style={{ color: '#38bdf8' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Active Intent</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>{emp.lastActive}</span>
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                            {emp.task !== '-' ? emp.task : 'System Idle / Standby'}
                                        </div>
                                        <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: emp.availability === 'Online' ? '100%' : '0%',
                                                height: '100%',
                                                backgroundColor: '#38bdf8',
                                                borderRadius: '2px',
                                                boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)'
                                            }}></div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: type === 'workforce' ? '12px' : '0' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: '700' }}>
                                            {emp.role}
                                        </span>
                                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#6d28d9', fontSize: '0.7rem', fontWeight: '700' }}>
                                            {emp.job_title}
                                        </span>
                                    </div>
                                    {type !== 'workforce' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('View Status', emp); }}
                                            style={{ color: '#3182ce', fontSize: '0.8rem', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            Live Intel <ChevronRight size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Premium List View Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px',
                            padding: '12px 32px',
                            color: '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <div>Live Operator</div>
                            <div>Department</div>
                            <div>Live Activity / Presence</div>
                            <div>Last Signal</div>
                            <div style={{ textAlign: 'right' }}>Actions</div>
                        </div>

                        {/* Premium List Rows */}
                        {employeeStatus.filter(emp => {
                            // Search filter
                            const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                emp.department_display?.toLowerCase().includes(searchTerm.toLowerCase());

                            // Availability filter
                            const matchesAvailability =
                                availabilityFilter === 'all' ||
                                (availabilityFilter === 'online' && emp.availability === 'Online') ||
                                (availabilityFilter === 'offline' && emp.availability === 'Offline') ||
                                (availabilityFilter === 'on-leave' && emp.availability === 'On Leave');

                            return matchesSearch && matchesAvailability;
                        }).map((emp) => (
                            <div
                                key={emp.id}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '20px',
                                    padding: '16px 32px',
                                    border: '1px solid #f1f5f9',
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px',
                                    alignItems: 'center',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.04)';
                                    e.currentTarget.style.transform = 'scale(1.005)';
                                    e.currentTarget.style.zIndex = 10;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#f1f5f9';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.zIndex = 1;
                                }}
                                onClick={() => handleAction('View Status', emp)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        border: '1px solid #e2e8f0',
                                        position: 'relative'
                                    }}>
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '1rem', fontWeight: '800', color: '#64748b' }}>{emp.name.charAt(0)}</span>
                                        )}
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : '#cbd5e1', border: '2px solid white' }}></div>
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</h4>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{emp.job_title}</p>
                                    </div>
                                </div>

                                <div style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem' }}>
                                    {emp.department_display}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>{emp.task !== '-' ? emp.task : 'Active Standby'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            <div style={{ width: '60px', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: emp.availability === 'Online' ? '80%' : '0%', height: '100%', backgroundColor: '#22c55e' }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8' }}>LIVE</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>{emp.lastActive}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Session Lock</div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAction('View Status', emp); }}
                                        style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAction('Edit Employee', emp); }}
                                        style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                    >
                                        <Edit size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <DataTable
                    title={`${title} List`}
                    columns={config.columns}
                    data={config.data}
                    onAction={handleAction}
                />
            )}

            {showApplyLeaveModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', padding: '40px', borderRadius: '32px', width: '1000px', maxWidth: '95%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                        {/* Modal Close Button */}
                        <button
                            onClick={() => setShowApplyLeaveModal(false)}
                            style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Request Leave</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Submit your leave details for approval</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px' }}>
                            <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Type</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={leaveFormData.leaveType}
                                            onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', transition: 'all 0.2s', outline: 'none', appearance: 'none' }}
                                            required
                                            disabled={remainingLeaves <= 0}
                                        >
                                            <option value="Casual Leave">Casual Leave</option>
                                            <option value="Sick Leave">Sick Leave</option>
                                            <option value="Vacation">Vacation</option>
                                            <option value="Personal Leave">Personal Leave</option>
                                            <option value="Loss of Pay">Loss of Pay</option>
                                        </select>
                                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                                            <Briefcase size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
                                        <input
                                            type="date"
                                            value={leaveFormData.startDate}
                                            onChange={(e) => {
                                                const nextStart = e.target.value;
                                                setLeaveFormData(prev => ({
                                                    ...prev,
                                                    startDate: nextStart,
                                                    endDate: prev.endDate && prev.endDate >= nextStart ? prev.endDate : nextStart
                                                }));
                                            }}
                                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                            required={selectedDates.length === 0}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                                        <input
                                            type="date"
                                            value={leaveFormData.endDate}
                                            onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                                            min={leaveFormData.startDate}
                                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                            required={selectedDates.length === 0}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Specific Dates (Optional)</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            type="date"
                                            value={dateToAdd}
                                            onChange={(e) => setDateToAdd(e.target.value)}
                                            style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { addSelectedDate(dateToAdd); setDateToAdd(''); }}
                                            style={{ padding: '0 24px', borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {selectedDates.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                            {selectedDates.map(date => (
                                                <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: '700' }}>
                                                    {date}
                                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeSelectedDate(date)} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</label>
                                    <textarea
                                        value={leaveFormData.reason}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                        placeholder="Please provide a valid reason for your leave request..."
                                        rows="4"
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', resize: 'none', outline: 'none', lineHeight: '1.5' }}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowApplyLeaveModal(false)}
                                        style={{ flex: 1, padding: '16px', borderRadius: '12px', fontWeight: '700', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ flex: 1, padding: '16px', borderRadius: '12px', fontWeight: '700', backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(56, 189, 248, 0.4)' }}
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </form>

                            {/* Right Side - Tasks & Responsibilities */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <div>
                                    <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Briefcase size={22} color="var(--primary)" /> Your Pending Tasks
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {pendingTasks.length > 0 ? pendingTasks.map(task => (
                                            <div key={task.id} style={{ padding: '16px', borderRadius: '16px', background: 'var(--background)', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                                                <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-primary)' }}>{task.title}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: task.priority === 'High' ? '#ef4444' : 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{task.priority || 'Medium'}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div style={{ padding: '32px', textAlign: 'center', borderRadius: '16px', background: 'var(--background)', border: '1px dashed var(--border)', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                                No pending tasks!
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Calendar size={22} color="var(--primary)" /> Pre-Leave Responsibilities
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {APPLIER_RESPONSIBILITIES.map((resp, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <div style={{ marginTop: '2px', minWidth: '20px', height: '20px', borderRadius: '6px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'white' }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{resp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Details Modal */}
            {showEmployeeModal && selectedEmployee && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        {/* Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Employee Details</h3>
                            <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Employee Info */}
                        <div style={{ padding: '32px' }}>
                            {/* Profile Section */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#075985', overflow: 'hidden' }}>
                                    {selectedEmployee.avatar_url ? (
                                        <img src={selectedEmployee.avatar_url} alt={selectedEmployee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        selectedEmployee.name.charAt(0)
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedEmployee.name}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>{selectedEmployee.role}</p>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: selectedEmployee.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                        color: selectedEmployee.status === 'Active' ? '#166534' : '#991b1b'
                                    }}>
                                        {selectedEmployee.status}
                                    </span>
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div style={{ marginBottom: '32px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Contact Information</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Mail size={18} color="#075985" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.email}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Phone size={18} color="#075985" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.phone || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MapPin size={18} color="#075985" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Location</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.location || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Calendar size={18} color="#075985" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Join Date</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.joinDate}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Work Information */}
                            <div style={{ marginBottom: '32px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Work Information</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Department</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Manager</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.manager || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Details */}
                            <div style={{ marginBottom: '32px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Financial Details</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>Basic Salary</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#075985' }}>
                                            ₹{selectedEmployee.basic_salary ? selectedEmployee.basic_salary.toLocaleString('en-IN') : '0'}
                                        </p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>HRA</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>
                                            ₹{selectedEmployee.hra ? selectedEmployee.hra.toLocaleString('en-IN') : '0'}
                                        </p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', border: '1px solid #fef08a' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '4px', fontWeight: 600 }}>Allowances</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>
                                            ₹{selectedEmployee.allowances ? selectedEmployee.allowances.toLocaleString('en-IN') : '0'}
                                        </p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#ede9fe', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#6d28d9', marginBottom: '4px', fontWeight: 600 }}>Gross Salary</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6d28d9' }}>
                                            ₹{selectedEmployee.gross_salary ? selectedEmployee.gross_salary.toLocaleString('en-IN') : '0'}
                                        </p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#fee2e2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#991b1b', marginBottom: '4px', fontWeight: 600 }}>Professional Tax (Deduction)</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b' }}>
                                            -₹{selectedEmployee.professional_tax ? selectedEmployee.professional_tax.toLocaleString('en-IN') : '0'}
                                        </p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#d1fae5', borderRadius: '12px', border: '2px solid #10b981' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#065f46', marginBottom: '4px', fontWeight: 600 }}>Net Salary</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#065f46' }}>
                                            ₹{((selectedEmployee.gross_salary || 0) - (selectedEmployee.professional_tax || 0)).toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Metrics */}
                            <div>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Performance Metrics</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '12px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>PERFORMANCE</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>{selectedEmployee.performance || 'N/A'}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '12px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>PROJECTS</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#075985' }}>{selectedEmployee.projects || 0}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '4px', fontWeight: 600 }}>TASKS DONE</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b45309' }}>{selectedEmployee.tasksCompleted || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowEmployeeModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Details Modal */}
            {showCandidateModal && selectedCandidate && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '650px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        {/* Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Candidate Details</h3>
                            <button onClick={() => setShowCandidateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Candidate Info */}
                        <div style={{ padding: '32px' }}>
                            {/* Profile Section */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#b45309' }}>
                                    {selectedCandidate.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedCandidate.name}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>Applied for: {selectedCandidate.role}</p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: '#e0f2fe',
                                            color: '#075985'
                                        }}>
                                            {selectedCandidate.stage}
                                        </span>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            Score: <strong style={{ color: selectedCandidate.score > 80 ? 'var(--success)' : 'var(--warning)' }}>{selectedCandidate.score}%</strong>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div style={{ marginBottom: '32px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Contact Information</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Mail size={18} color="#b45309" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.email}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Phone size={18} color="#b45309" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.phone}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MapPin size={18} color="#b45309" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Location</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.location}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Calendar size={18} color="#b45309" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Applied Date</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.appliedDate}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Qualifications */}
                            <div style={{ marginBottom: '32px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Qualifications</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Experience</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.experience}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Education</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.education}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Salary</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.expectedSalary}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Availability</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.availability}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Skills */}
                            {selectedCandidate.skills && (
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Skills</h5>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {selectedCandidate.skills.map((skill, index) => (
                                            <span key={index} style={{ padding: '6px 16px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.875rem', fontWeight: 500 }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Application Details */}
                            <div style={{ marginBottom: '24px' }}>
                                <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Application Details</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    <div style={{ padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '12px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>SOURCE</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#075985' }}>{selectedCandidate.source}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '12px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>INTERVIEW SCORE</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#166534' }}>{selectedCandidate.score}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedCandidate.notes && (
                                <div>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Interview Notes</h5>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{selectedCandidate.notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setShowCandidateModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    addToast(`Action for ${selectedCandidate.name}`, 'info');
                                    setShowCandidateModal(false);
                                }}
                                style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                            >
                                Schedule Interview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Details Modal */}
            {showLeaveDetailsModal && selectedLeaveRequest && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div className="no-scrollbar" style={{ backgroundColor: 'white', borderRadius: '32px', padding: '40px', width: '1000px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', position: 'relative' }}>
                        {/* Modal Close Button */}
                        <button
                            onClick={() => setShowLeaveDetailsModal(false)}
                            style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }}
                        >
                            <X size={20} />
                        </button>

                        {/* Header */}
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Leave Request Details</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Review the details and status of this leave request</p>
                        </div>

                        {/* Employee Info */}
                        <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                                Employee Information
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.name}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Leave Type</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.type}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duration</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.duration}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Breakdown</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            backgroundColor: '#dcfce7',
                                            color: '#15803d',
                                            border: '1px solid #bbf7d0'
                                        }}>
                                            Paid: {(selectedLeaveRequest.duration_weekdays !== null && selectedLeaveRequest.duration_weekdays !== undefined) ? selectedLeaveRequest.duration_weekdays : (() => {
                                                const start = new Date(selectedLeaveRequest.startDate);
                                                const end = new Date(selectedLeaveRequest.endDate);
                                                let count = 0;
                                                let current = new Date(start);
                                                while (current <= end) {
                                                    const dayOfWeek = current.getDay();
                                                    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
                                                    current.setDate(current.getDate() + 1);
                                                }
                                                return count;
                                            })()} days
                                        </span>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            backgroundColor: '#f1f5f9',
                                            color: '#64748b',
                                            border: '1px solid #cbd5e1'
                                        }}>
                                            Weekends: {(() => {
                                                const start = new Date(selectedLeaveRequest.startDate);
                                                const end = new Date(selectedLeaveRequest.endDate);
                                                let weekendCount = 0;
                                                let current = new Date(start);
                                                while (current <= end) {
                                                    const dayOfWeek = current.getDay();
                                                    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
                                                    current.setDate(current.getDate() + 1);
                                                }
                                                return weekendCount;
                                            })()} days
                                        </span>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            backgroundColor: '#fee2e2',
                                            color: '#b91c1c',
                                            border: '1px solid #fca5a5'
                                        }}>
                                            LOP: {selectedLeaveRequest.lop_days || 0} days
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</p>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        backgroundColor: selectedLeaveRequest.status === 'Approved' ? '#dcfce7' :
                                            selectedLeaveRequest.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                                        color: selectedLeaveRequest.status === 'Approved' ? '#166534' :
                                            selectedLeaveRequest.status === 'Pending' ? '#b45309' : '#991b1b'
                                    }}>
                                        {selectedLeaveRequest.status}
                                    </span>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600, lineHeight: '1.5' }}>{selectedLeaveRequest.reason}</p>
                                </div>
                            </div>
                        </div>

                        {/* Day-wise Breakdown */}
                        <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                                Day-wise Breakdown
                            </h4>
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: (() => {
                                    const start = new Date(selectedLeaveRequest.startDate);
                                    const end = new Date(selectedLeaveRequest.endDate);
                                    let dayCount = 0;
                                    let current = new Date(start);
                                    while (current <= end) {
                                        dayCount++;
                                        current.setDate(current.getDate() + 1);
                                    }
                                    // Each day item is ~42px (34px height + 8px gap), show up to 7 days without scroll
                                    return dayCount <= 7 ? 'none' : '294px';
                                })(), overflowY: 'auto'
                            }} className="no-scrollbar">
                                {(() => {
                                    const start = new Date(selectedLeaveRequest.startDate);
                                    const end = new Date(selectedLeaveRequest.endDate);
                                    const days = [];
                                    let current = new Date(start);
                                    let paidDaysLeft = (selectedLeaveRequest.duration_weekdays !== null && selectedLeaveRequest.duration_weekdays !== undefined)
                                        ? selectedLeaveRequest.duration_weekdays
                                        : (() => {
                                            const s = new Date(selectedLeaveRequest.startDate);
                                            const e = new Date(selectedLeaveRequest.endDate);
                                            let c = 0;
                                            let curr = new Date(s);
                                            while (curr <= e) {
                                                if (curr.getDay() !== 0 && curr.getDay() !== 6) c++;
                                                curr.setDate(curr.getDate() + 1);
                                            }
                                            return c;
                                        })();

                                    while (current <= end) {
                                        const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: '2-digit', weekday: 'short' });
                                        const dayOfWeek = current.getDay();
                                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                                        let status = 'Leave';
                                        let color = 'var(--text-primary)';
                                        let bgColor = 'white';
                                        let borderColor = '#e2e8f0';

                                        if (isWeekend) {
                                            status = 'Weekend';
                                            color = '#64748b';
                                            bgColor = '#f1f5f9';
                                            borderColor = '#cbd5e1';
                                        } else {
                                            if (paidDaysLeft > 0) {
                                                status = 'Paid Leave';
                                                color = '#15803d';
                                                bgColor = '#dcfce7';
                                                borderColor = '#bbf7d0';
                                                paidDaysLeft--;
                                            } else {
                                                status = 'Loss of Pay';
                                                color = '#b91c1c';
                                                bgColor = '#fee2e2';
                                                borderColor = '#fca5a5';
                                            }
                                        }
                                        days.push({ date: dateStr, status, color, bgColor, borderColor });
                                        current.setDate(current.getDate() + 1);
                                    }

                                    return days.map((day, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: day.bgColor, borderRadius: '8px', border: `1px solid ${day.borderColor}`, alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{day.date}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: day.color }}>
                                                {day.status}
                                            </span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>



                        {/* Live Re-evaluation Preview */}
                        {selectedLeaveRequest.status === 'Pending' && (
                            <div style={{
                                marginTop: '24px',
                                padding: '24px',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                border: '1px solid #bae6fd',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#0369a1' }}>
                                    <Activity size={20} />
                                    <h4 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>Live Approval Preview</h4>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                    {/* Card 1: Current Total Leaves (Profile Balance) */}
                                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Current Total Leaves</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalBalance} Days</div>
                                    </div>

                                    {/* Card 2: Leave Applied For (Total Requested) */}
                                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Leave Applied For</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                                            {(selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0)} Days
                                        </div>
                                    </div>

                                    {/* Card 3: Effective Balance IF Accepted */}
                                    <div style={{
                                        backgroundColor: '#0369a1',
                                        padding: '16px',
                                        borderRadius: '14px',
                                        color: 'white',
                                        gridColumn: 'span 1'
                                    }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '8px' }}>Effective Balance if Accepted</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                                            {(() => {
                                                // 1. Effective BEFORE this request (Profile - Other Pending Paid)
                                                // Note: evalPendingPaid includes ALL pending. We want to exclude specific logic if needed, but per previous logic evalPendingPaid was sum of ALL pending.
                                                // However, `handleViewLeave` excludes CURRENT request from `pending` list query.
                                                // So `evalPendingPaid` = "Other Pending (Paid)".
                                                const effectiveCurrent = Math.max(0, evalBalance - evalPendingPaid);

                                                // 2. How much of THIS request will be paid?
                                                const totalRequested = (selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0);
                                                const paidAmountForCurrent = Math.min(totalRequested, effectiveCurrent);

                                                // 3. Final Balance = Effective Current - Paid Amount Used
                                                return Math.max(0, effectiveCurrent - paidAmountForCurrent);
                                            })()} Days
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Info Footer: Total Days, LOP Days */}
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.5)',
                                    borderRadius: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: '#0c4a6e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></div>
                                    {(() => {
                                        const effectiveCurrent = Math.max(0, evalBalance - evalPendingPaid);
                                        const totalReq = (selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0);
                                        const willBePaid = Math.min(totalReq, effectiveCurrent);
                                        const willBeLop = totalReq - willBePaid;

                                        return `Total Leave Days: ${totalReq}, Loss of Pay Days: ${willBeLop}`;
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Tasks During Leave */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '24px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Briefcase size={20} color="var(--primary)" /> Tasks During Leave Period
                                </h4>
                                {employeeTasks.length > 0 ? (
                                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Task Title</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Due Date</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Priority</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employeeTasks.map(task => (
                                                    <tr key={task.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '12px', fontWeight: 600 }}>{task.title}</td>
                                                        <td style={{ padding: '12px' }}>{new Date(task.due_date).toLocaleDateString()}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                backgroundColor: task.priority === 'High' ? '#fee2e2' : '#f0f9ff',
                                                                color: task.priority === 'High' ? '#ef4444' : '#0ea5e9'
                                                            }}>
                                                                {task.priority || 'Medium'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                        No tasks scheduled during this leave period
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={20} color="var(--primary)" /> Pending Tasks
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {pendingTasks.length > 0 ? pendingTasks.map(task => (
                                        <div key={task.id} style={{ padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{task.title}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: task.priority === 'High' ? '#ef4444' : 'var(--primary)', textTransform: 'uppercase' }}>{task.priority}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ padding: '20px', textAlign: 'center', borderRadius: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No pending tasks!</div>
                                    )}
                                </div>
                            </div>
                        </div>



                        {/* Footer */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowLeaveDetailsModal(false)}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                            >
                                Close Details
                            </button>
                            {selectedLeaveRequest.status === 'Pending' && (
                                <>
                                    <button
                                        onClick={() => { handleAction('Reject', selectedLeaveRequest); setShowLeaveDetailsModal(false); }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', cursor: 'pointer' }}
                                    >
                                        Reject Request
                                    </button>
                                    <button
                                        onClick={() => { handleAction('Approve', selectedLeaveRequest); setShowLeaveDetailsModal(false); }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                        Approve Request
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Handover Confirmation Modal */}
            {showHandoverModal && selectedMemberForHandover && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '32px',
                        borderRadius: '24px',
                        width: '480px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#b91c1c' }}>
                            <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#fef2f2' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Role Handover</h3>
                        </div>

                        <p style={{ color: '#4b5563', lineHeight: 1.6, marginTop: '8px' }}>
                            You are about to transfer your <strong>{projectRole === 'project_manager' ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.name}</strong>.
                        </p>

                        <div style={{ backgroundColor: '#fffba0', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fde047', fontSize: '0.9rem', color: '#854d0e', display: 'flex', gap: '10px' }}>
                            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Warning:</strong> You will lose your current administrative privileges for this project immediately after this action.
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={() => { setShowHandoverModal(false); setSelectedMemberForHandover(null); }}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmHandover}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                                }}
                            >
                                Confirm Handover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Policy Modal */}
            <AddPolicyModal
                isOpen={showAddPolicyModal}
                onClose={() => setShowAddPolicyModal(false)}
                onSuccess={handlePolicySuccess}
                orgId={orgId}
            />

            {showEditEmployeeModal && (
                <EditEmployeeModal
                    isOpen={showEditEmployeeModal}
                    onClose={() => setShowEditEmployeeModal(false)}
                    onSuccess={() => {
                        setRefreshTrigger(prev => prev + 1);
                        setShowEditEmployeeModal(false);
                        addToast('Employee updated successfully', 'success');
                    }}
                    employee={employeeToEdit}
                    orgId={orgId}
                />
            )}
        </div>
    );
};

export default ModulePage;
