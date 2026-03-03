import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Edit, Users, Clock, Activity, Target, TrendingUp, ChevronRight, LayoutGrid, List, Search, Map as MapIcon, CheckCircle } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { EditEmployeeModal } from '../../shared/EditEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import InvoiceGenerator from '../components/Invoice/InvoiceGenerator';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { EditPolicyModal } from '../../shared/EditPolicyModal';
import { useUser } from '../context/UserContext';
import ProjectAnalytics from '../../shared/ProjectAnalytics/ProjectAnalytics';



const APPLIER_RESPONSIBILITIES = [
    "Complete high-priority current tasks",
    "Handover pending tasks to a teammate",
    "Update status/progress on all active tasks",
    "Ensure relevant documentation is accessible"
];

const APPROVER_RESPONSIBILITIES = [
    "Review applier's workload during leave period",
    "Check own pending tasks for bottlenecks",
    "Coordinate task reallocation with team",
    "Ensure project deadlines are not compromised"
];


const ModulePage = ({ title, type }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { userId, orgId, userRole } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState('grid'); // 'grid' or 'list'
    const [availabilityFilter, setAvailabilityFilter] = useState('all');

    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [remainingLeaves, setRemainingLeaves] = useState(0);

    const [evalBalance, setEvalBalance] = useState(0);
    const [evalPendingPaid, setEvalPendingPaid] = useState(0);

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
    const [employeeSalary, setEmployeeSalary] = useState(null);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // State for Candidates
    const [candidates, setCandidates] = useState([]);

    const [showCandidateFormModal, setShowCandidateFormModal] = useState(false);
    const [isEditingCandidate, setIsEditingCandidate] = useState(false);
    const [candidateFormData, setCandidateFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        stage: 'Screening',
        score: 0,
        source: '',
        appliedDate: new Date().toISOString().split('T')[0],
        experience: '',
        education: '',
        location: '',
        expectedSalary: '',
        availability: '',
        skills: '',
        notes: ''
    });

    // State for Employees
    const [employees, setEmployees] = useState([]);
    const [teamOptions, setTeamOptions] = useState([]); // Store fetched teams
    const [projects, setProjects] = useState([]); // Store fetched projects
    const [departments, setDepartments] = useState([]); // Store fetched departments
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
    const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);

    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [selectedProjectsForAdd, setSelectedProjectsForAdd] = useState([]); // For multi-project selection
    const [addEmployeeFormData, setAddEmployeeFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        department_id: '',
        phone: '',
        location: '',
        joinDate: new Date().toISOString().split('T')[0],
        basic_salary: '',
        hra: '',
        allowances: '',
    });

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
    const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
    const [policyError, setPolicyError] = useState(null);



    // Fetch projects and departments from Supabase
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                // Fetch Projects
                const { data: projData } = await supabase.from('projects').select('id, name').eq('org_id', orgId).order('name');
                setProjects(projData || []);

                // Fetch Departments
                const { data: deptData } = await supabase.from('departments').select('id, department_name').eq('org_id', orgId);
                setDepartments(deptData || []);
            } catch (err) {
                console.error('Error fetching metadata:', err);
            }
        };

        fetchMetadata();
    }, []);

    // Fetch employees from Supabase
    useEffect(() => {
        const fetchEmployees = async () => {
            if (orgId && (type === 'workforce' || type === 'status')) {
                try {
                    console.log(`Fetching employees for ${type} from Supabase...`);

                    // 1. Fetch employees with team details
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select(`
                            id, 
                            full_name, 
                            email, 
                            role, 
                            department,
                            job_title,
                            join_date,
                            avatar_url
                        `)
                        .eq('org_id', orgId);

                    if (profilesError) {
                        console.error('Error fetching employees:', profilesError);
                        addToast('Failed to load employees', 'error');
                        return;
                    }

                    // 2. Fetch project assignments from project_members table
                    const { data: teamMembersData, error: teamMembersError } = await supabase
                        .from('project_members')
                        .select(`
                            user_id,
                            project_id,
                            role,
                            projects:project_id (
                                name
                            )
                        `)
                        .eq('org_id', orgId);

                    if (teamMembersError) {
                        console.error('Error fetching team members:', teamMembersError);
                    }

                    const projectMap = {};
                    if (teamMembersData) {
                        teamMembersData.forEach(member => {
                            if (!projectMap[member.user_id]) projectMap[member.user_id] = [];
                            if (member.projects?.name) {
                                // Format role for display
                                let roleDisplay = member.role || 'Member';
                                if (roleDisplay === 'team_lead') roleDisplay = 'Team Lead';
                                else if (roleDisplay === 'employee') roleDisplay = 'Employee';
                                else roleDisplay = roleDisplay.charAt(0).toUpperCase() + roleDisplay.slice(1);

                                projectMap[member.user_id].push({
                                    name: member.projects.name,
                                    role: roleDisplay
                                });
                            }
                        });
                    }

                    // 3. Fetch TODAY'S attendance records
                    const today = new Date().toISOString().split('T')[0];
                    const { data: attendanceData, error: attendanceError } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .eq('date', today)
                        .eq('org_id', orgId);

                    // Fetch TODAY'S leaves for "On Leave" status
                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .eq('org_id', orgId)
                        .lte('from_date', today)
                        .gte('to_date', today);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));

                    if (attendanceError) {
                        console.error('Error fetching attendance:', attendanceError);
                        // We continue even if attendance fails, considering everyone offline as fallback
                    }

                    // Create a map of employee_id -> attendance record for quick lookup
                    const attendanceMap = {};
                    if (attendanceData) {
                        attendanceData.forEach(record => {
                            attendanceMap[record.employee_id] = record;
                        });
                    }

                    // 4. Fetch Teams for Dropdown
                    const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, team_name').eq('org_id', orgId);
                    if (teamsData) {
                        setTeamOptions(teamsData);
                    } else if (teamsError) {
                        console.error("Error fetching teams:", teamsError);
                    }

                    if (profilesData) {
                        console.log('Fetched profiles:', profilesData);
                        console.log('Fetched attendance for today:', attendanceData);
                        console.log('Project assignments:', projectMap);

                        // Transform data to match the expected format
                        const transformedEmployees = profilesData.map(emp => {
                            // Determine real status from attendance
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

                            // Check Leave Status (Override Offline if on leave)
                            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                                availability = 'On Leave';
                            }

                            // Determine Current Task from Attendance (from user input)
                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'Available' : '-';

                            let teamName;
                            if (Array.isArray(projectMap[emp.id]) && projectMap[emp.id].length > 0) {
                                // Multiple projects - render each on a new line with role
                                teamName = (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {projectMap[emp.id].map((proj, index) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{proj.name}</span>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {proj.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            } else {
                                teamName = 'Unassigned';
                            }

                            // Determine Department Display (Name matched by ID or the ID itself/legacy name)
                            const matchedDept = departments.find(d => d.id === emp.department);
                            const departmentNameDisplay = matchedDept ? matchedDept.department_name : (emp.department || 'N/A');

                            return {
                                id: emp.id,
                                name: emp.full_name || 'N/A',
                                email: emp.email || 'N/A',
                                role: emp.role || 'N/A',
                                job_title: emp.job_title,
                                employment_type: emp.employment_type || 'Full-Time',
                                team_id: emp.team_id,
                                dept: teamName, // Shows Project/Team
                                department_display: departmentNameDisplay,
                                status: 'Active',
                                availability: availability, // Real status from DB
                                task: currentTask, // Real task from DB

                                lastActive: lastActive, // Real clock time
                                joinDate: emp.join_date ? new Date(emp.join_date).toLocaleDateString() : (emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'),
                                performance: 'N/A',
                                projects: projectMap[emp.id]?.length || 0,
                                tasksCompleted: 0,
                                avatar_url: emp.avatar_url
                            };
                        });

                        console.log('Transformed employees with real attendance:', transformedEmployees);
                        setEmployees(transformedEmployees);

                        if (transformedEmployees.length === 0) {
                            addToast('No employees found in database', 'info');
                        }
                    }
                } catch (err) {
                    console.error('Unexpected error fetching employees:', err);
                    addToast('An unexpected error occurred while loading employees', 'error');
                }
            } else if (type === 'leaves') {
                if (!orgId) return;
                try {
                    console.log('Fetching leave requests for Executive...');

                    // Get current user ID to filter out their own requests
                    const { data: { user } } = await supabase.auth.getUser();
                    const currentUserId = user?.id;

                    // Fetch all leaves
                    const { data: leavesData, error: leavesError } = await supabase
                        .from('leaves')
                        .select('*')
                        .eq('org_id', orgId);

                    if (leavesError) {
                        console.error('Error fetching leaves:', leavesError);
                        return;
                    }

                    console.log('Executive Leaves Data RAW:', leavesData);

                    // Fetch profiles for name mapping
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .eq('org_id', orgId);

                    if (profilesError) console.error('Error fetching profiles:', profilesError);

                    if (leavesData) {
                        // Create a map of id -> name for quick lookup
                        const profileMap = {};
                        if (profilesData) {
                            profilesData.forEach(p => {
                                profileMap[p.id] = p.full_name;
                            });
                        }

                        // Filter out executive's own leaves and map the rest
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
                                    employee_id: leave.employee_id,
                                    name: name,
                                    type: type,
                                    reason: leave.reason || 'No reason provided', // Include full reason from DB
                                    startDate: leave.from_date,
                                    endDate: leave.to_date,
                                    duration: `${diffDays} Days`,
                                    duration_weekdays: leave.duration_weekdays, // Critical for approval calculation
                                    lop_days: leave.lop_days, // Critical for approval calculation
                                    dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                    status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                                };
                            });

                        // Sort by status (Pending first) then by ID
                        filteredLeaves.sort((a, b) => {
                            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                            return b.id - a.id; // Then by ID descending
                        });

                        setLeaveRequests(filteredLeaves);
                    }
                } catch (err) {
                    console.error('Error fetching leave requests:', err);
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
                        setLeaveRequests(stats);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };

        fetchEmployees();
    }, [type, refreshTrigger, departments, orgId]);

    // Fetch Policies from Supabase
    useEffect(() => {
        const fetchPolicies = async () => {
            if (type === 'policies' && orgId) {
                try {
                    console.log('Fetching policies from Supabase...');
                    setIsLoadingPolicies(true);
                    setPolicyError(null);

                    const { data, error } = await supabase
                        .from('policies')
                        .select('*')
                        .eq('org_id', orgId)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error('Error fetching policies:', error);
                        setPolicyError(error.message);
                        // Only toast if it's a persistent error or not the first attempt
                        // For now, let's keep it to console only as requested to remove popups
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


    // Real-time Subscription for Live Status
    React.useEffect(() => {
        if (type !== 'status' && type !== 'workforce') return;

        const sub = supabase
            .channel('executive_attendance_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `org_id=eq.${orgId}` }, (payload) => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [type]);

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
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .lte('start_date', endDate)
                .gte('due_date', startDate);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    };

    const fetchEmployeeSalary = async (employeeId) => {
        try {
            const { data, error } = await supabase
                .from('employee_finance')
                .select('*')
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .eq('org_id', orgId)
                .single();

            if (error) {
                console.log('No active salary record found:', error);
                setEmployeeSalary(null);
                return;
            }

            setEmployeeSalary(data);
        } catch (error) {
            console.error('Error fetching employee salary:', error);
            setEmployeeSalary(null);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();

        try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                addToast('You must be logged in to add employees', 'error');
                return;
            }

            console.log('Adding employee with data:', addEmployeeFormData);

            // Call the Supabase Edge Function to add employee
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-employee`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        full_name: addEmployeeFormData.name,
                        email: addEmployeeFormData.email,
                        password: addEmployeeFormData.password,
                        role: addEmployeeFormData.role.toLowerCase(),
                        project_id: selectedProjectsForAdd[0] || null,
                        department_id: addEmployeeFormData.department_id || null,
                        monthly_leave_quota: 3,
                        basic_salary: parseFloat(addEmployeeFormData.basic_salary),
                        hra: parseFloat(addEmployeeFormData.hra),
                        allowances: parseFloat(addEmployeeFormData.allowances) || 0,
                        org_id: orgId
                    }),
                }
            );

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            console.log('Edge Function response:', result);

            if (!response.ok) {
                console.error('Edge Function error:', result);
                throw new Error(result.error || result.message || `Server error: ${response.status}`);
            }

            // Get the user_id - either from the response or by querying
            let userId = result.user_id;

            if (!userId) {
                // Query for the newly created user by email
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', addEmployeeFormData.email)
                    .eq('org_id', orgId)
                    .single();

                if (profileError) {
                    console.error('Error fetching user profile:', profileError);
                } else {
                    userId = profileData?.id;
                }
            }

            if (userId) {
                // Update profile with department if selected
                if (addEmployeeFormData.department_id) {
                    console.log('Updating profile with department ID:', addEmployeeFormData.department_id);
                    await supabase
                        .from('profiles')
                        .update({ department: addEmployeeFormData.department_id })
                        .eq('id', userId)
                        .eq('org_id', orgId);
                }

                // If a project was selected, add the user to project_members
                if (selectedProjectsForAdd && selectedProjectsForAdd.length > 0) {
                    console.log('Adding to project:', selectedProjectsForAdd[0]);
                    // Insert into project_members table
                    const { error: projectMemberError } = await supabase
                        .from('project_members')
                        .insert({
                            project_id: selectedProjectsForAdd[0],
                            user_id: userId,
                            org_id: orgId,
                            role: addEmployeeFormData.role.toLowerCase()
                        });

                    if (projectMemberError) {
                        console.error('Error adding to project_members:', projectMemberError);
                    } else {
                        console.log('Successfully added to project_members');
                    }

                    // Insert into team_members table (using project_id as team_id)
                    const { error: teamMemberError } = await supabase
                        .from('team_members')
                        .insert({
                            team_id: selectedProjectsForAdd[0],
                            profile_id: userId,
                            org_id: orgId,
                            role_in_project: addEmployeeFormData.role.toLowerCase()
                        });

                    if (teamMemberError) {
                        console.error('Error adding to team_members:', teamMemberError);
                    } else {
                        console.log('Successfully added to team_members');
                    }

                    // Update profiles.team_id for dashboard compatibility
                    const { error: profileTeamIdError } = await supabase
                        .from('profiles')
                        .update({ team_id: selectedProjectsForAdd[0] })
                        .eq('id', userId)
                        .eq('org_id', orgId);

                    if (profileTeamIdError) {
                        console.error('Error updating team_id in profiles:', profileTeamIdError);
                    } else {
                        console.log('Successfully updated team_id in profiles');
                    }
                }
            } else {
                console.error('Could not determine user_id for project mapping');
            }

            // Reset form
            setAddEmployeeFormData({
                name: '',
                email: '',
                password: '',
                role: '',
                project_id: '',
                department_id: '',
                phone: '',
                location: '',
                joinDate: new Date().toISOString().split('T')[0],
                basic_salary: '',
                hra: '',
                allowances: '',
            });

            setShowAddEmployeeModal(false);
            addToast('Employee added successfully!', 'success');
            setRefreshTrigger(prev => prev + 1); // Refresh the employee list
        } catch (err) {
            console.error('Error adding employee:', err);
            addToast(err.message || 'Failed to add employee', 'error');
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

        // Fetch pending tasks (Backlog) for the EMPLOYEE
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
            .neq('id', leaveRequest.id);

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
            // URL format: https://...supabase.co/storage/v1/object/public/policies/filename.pdf
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                // Fallback: use just the filename
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

            // Download from policies bucket using Supabase storage.download()
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

            // Ensure the blob is typed as PDF
            const pdfBlob = new Blob([data], { type: 'application/pdf' });

            // Create blob URL and force download
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

    const handleEditPolicy = (policy) => {
        setSelectedPolicy(policy);
        setShowEditPolicyModal(true);
    };

    const handleAction = async (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setSelectedDates([]);
            setDateToAdd('');
            setShowApplyLeaveModal(true);
        } else if (type === 'workforce' && action === 'Add Employee') {
            setShowAddEmployeeModal(true);
        } else if (type === 'recruitment' && action === 'Add Candidate') {
            setIsEditingCandidate(false);
            setCandidateFormData({
                name: '',
                email: '',
                phone: '',
                role: '',
                stage: 'Screening',
                score: 0,
                source: '',
                appliedDate: new Date().toISOString().split('T')[0],
                experience: '',
                education: '',
                location: '',
                expectedSalary: '',
                availability: '',
                skills: '',
                notes: ''
            });
            setShowCandidateFormModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else if (type === 'recruitment' && action === 'Edit Candidate') {
            setIsEditingCandidate(true);
            setCandidateFormData({
                ...item,
                skills: item.skills ? item.skills.join(', ') : ''
            });
            setShowCandidateFormModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';

            // Optimistic update
            setLeaveRequests(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: newStatus }
                        : request
                )
            );

            try {
                // Database update (lowercase for DB)
                const dbStatus = action === 'Approve' ? 'approved' : 'rejected';
                let finalPaid = item.duration_weekdays || 0;
                let finalLop = item.lop_days || 0;

                if (action === 'Approve') {
                    // Fetch latest balance for re-evaluation
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('total_leaves_balance')
                        .eq('id', item.employee_id)
                        .single();

                    if (profileData) {
                        const currentBalance = profileData.total_leaves_balance || 0;
                        const totalRequested = (item.duration_weekdays || 0) + (item.lop_days || 0);

                        // Dynamic Re-evaluation: Use all available balance
                        finalPaid = Math.min(totalRequested, currentBalance);
                        finalLop = totalRequested - finalPaid;

                        if (finalPaid > 0) {
                            const { error: profileError } = await supabase
                                .from('profiles')
                                .update({
                                    total_leaves_balance: currentBalance - finalPaid
                                })
                                .eq('id', item.employee_id);

                            if (profileError) throw profileError;
                        }
                    }
                }

                const { error } = await supabase
                    .from('leaves')
                    .update({
                        status: dbStatus,
                        duration_weekdays: finalPaid,
                        lop_days: finalLop
                    })
                    .eq('id', item.id)
                    .eq('org_id', orgId);

                if (error) throw error;

                // Send Notification to the Employee
                const { data: { user } } = await supabase.auth.getUser();
                if (user && item.employee_id) {
                    let notificationMessage = `Your leave request for ${item.dates} has been ${action === 'Approve' ? 'Approved' : 'Rejected'}.`;
                    if (action === 'Approve' && finalLop > 0) {
                        notificationMessage += ` Note: ${finalLop} days were processed as Loss of Pay due to insufficient balance.`;
                    }

                    await supabase.from('notifications').insert({
                        receiver_id: item.employee_id,
                        sender_id: user.id,
                        org_id: orgId,
                        sender_name: 'Management',
                        message: notificationMessage,
                        type: 'leave_status', // specific type
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                }

                addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
                setRefreshTrigger(prev => prev + 1); // Refresh list
            } catch (error) {
                console.error('Error updating leave request:', error);
                addToast(`Failed to ${action.toLowerCase()} leave request`, 'error');
            }
        } else if (action === 'View Employee' || action === 'View Status') {
            // Fetch additional details for the employee
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
                    professional_tax: financeData?.professional_tax || 0,
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

                // Also set employeeSalary for the compensation section
                if (financeData) {
                    setEmployeeSalary(financeData);
                }
            } catch (error) {
                console.error('Error fetching employee details:', error);
                // Still show modal with basic data if fetch fails
                setSelectedEmployee({
                    ...item,
                    basic_salary: 0,
                    hra: 0,
                    allowances: 0,
                    gross_salary: 0,
                    professional_tax: 0,
                    tasksCompleted: 0,
                    totalTasks: 0,
                    performance: item.performance || 'N/A'
                });
                setShowEmployeeModal(true);
                setEmployeeSalary(null);
            }
        } else if (action === 'Edit Employee') {
            setSelectedEmployeeForEdit(item);
            setShowEditEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const openApplyLeaveModal = async () => {
        try {
            // Fetch pending tasks for the applier (Current Executive)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tasks = await fetchPendingTasks(user.id);
                setPendingTasks(tasks);
            }

            setShowApplyLeaveModal(true);
        } catch (error) {
            console.error('Error opening apply leave modal:', error);
            setShowApplyLeaveModal(true);
        }
    };

    const handleApplyLeave = (e) => {
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

        // Calculate duration
        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const requestedDays = useSpecificDates ? datesToApply.length : diffDays;
        const duration = requestedDays === 1 ? '1 Day' : `${requestedDays} Days`;

        // Format dates
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        };
        const dates = useSpecificDates
            ? datesToApply.map(formatDate).join(', ')
            : (leaveFormData.startDate === leaveFormData.endDate
                ? formatDate(leaveFormData.startDate)
                : `${formatDate(leaveFormData.startDate)} - ${formatDate(leaveFormData.endDate)}`);

        // Insert leave request(s)
        const submitToDb = async () => {
            try {
                // Calculate initial Paid/LOP split for application record
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('total_leaves_balance')
                    .eq('id', userId)
                    .single();

                const { data: pendingLeaves } = await supabase
                    .from('leaves')
                    .select('duration_weekdays')
                    .eq('employee_id', userId)
                    .eq('status', 'pending');

                const pendingPaid = pendingLeaves?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0;
                const effectiveBalance = Math.max(0, (profile?.total_leaves_balance || 0) - pendingPaid);

                const leaveReason = `${leaveFormData.leaveType}: ${leaveFormData.reason}` +
                    (useSpecificDates ? ` (Dates: ${datesToApply.join(', ')})` : '');

                const leaveRows = useSpecificDates
                    ? datesToApply.map((date, idx) => {
                        const isPaid = idx < effectiveBalance;
                        return {
                            employee_id: userId,
                            org_id: orgId,
                            from_date: date,
                            to_date: date,
                            reason: leaveReason,
                            status: 'pending',
                            duration_weekdays: isPaid ? 1 : 0,
                            lop_days: isPaid ? 0 : 1
                        };
                    })
                    : (() => {
                        const paidDays = Math.min(requestedDays, effectiveBalance);
                        const lopDays = requestedDays - paidDays;
                        return [{
                            employee_id: userId,
                            org_id: orgId,
                            from_date: leaveFormData.startDate,
                            to_date: leaveFormData.endDate,
                            reason: leaveReason,
                            status: 'pending',
                            duration_weekdays: paidDays,
                            lop_days: lopDays
                        }];
                    })();

                const { error: insertError } = await supabase
                    .from('leaves')
                    .insert(leaveRows);

                if (insertError) throw insertError;

                addToast('Leave application submitted successfully', 'success');
                setShowApplyLeaveModal(false);
                setLeaveFormData({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
                setSelectedDates([]);
                setDateToAdd('');
                setRefreshTrigger(prev => prev + 1); // Refresh list
            } catch (error) {
                console.error('Error applying leave:', error);
                addToast('Failed to submit leave request', 'error');
            }
        };

        submitToDb();
    };

    const handleSaveCandidate = (e) => {
        e.preventDefault();
        const skillsArray = candidateFormData.skills.split(',').map(skill => skill.trim()).filter(skill => skill !== '');

        if (isEditingCandidate) {
            setCandidates(prevCandidates => prevCandidates.map(cand =>
                cand.id === candidateFormData.id
                    ? { ...candidateFormData, skills: skillsArray }
                    : cand
            ));
            addToast('Candidate updated successfully', 'success');
        } else {
            const newCandidate = {
                id: candidates.length + 1,
                ...candidateFormData,
                skills: skillsArray
            };
            setCandidates([...candidates, newCandidate]);
            addToast('Candidate added successfully', 'success');
        }
        setShowCandidateFormModal(false);
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <AllTasksView userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo isEditingEnabled={true} />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'invoice') return <InvoiceGenerator orgId={orgId} />;
    if (type === 'project-analytics') return <ProjectAnalytics userRole="executive" dashboardPrefix="/executive-dashboard" orgId={orgId} />;

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

                { header: 'Job Title', accessor: 'job_title' },
                { header: 'Department', accessor: 'department_display' },
                { header: 'Project', accessor: 'dept' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Employee', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: employees
        },
        status: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Department', accessor: 'department_display' },
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
            data: employees
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
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Candidate', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: candidates
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
            data: leaveRequests
        },
        'employee-leave-info': {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Total Leaves Taken', accessor: 'total_taken' },
                { header: 'Paid Leaves', accessor: 'paid_leaves' },
                { header: 'Loss of Pay Days', accessor: 'lop_days' },
                { header: 'Leaves Left', accessor: 'leaves_left' }
            ],
            data: leaveRequests
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
                },
                {
                    header: 'Edit',
                    accessor: 'edit',
                    render: (row) => (
                        <button
                            onClick={() => handleEditPolicy(row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fde68a';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef3c7';
                            }}
                        >
                            <Edit size={14} />
                            Edit
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

    const config = configs[type] || configs.default;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '40px' }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 24px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
                marginBottom: '4px'
            }}>
                {/* Mesh Grid Background */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                    backgroundSize: '40px 40px',
                    opacity: 0.4
                }}></div>

                {/* Animated Glow Orbs */}
                <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: '-150px', left: '-50px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(129, 140, 248, 0.08) 0%, transparent 70%)', borderRadius: '50%' }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Executive Control</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: '700' }}>{title} Hub</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {title.split(' ').map((word, i) => i === title.split(' ').length - 1 ? <span key={i} style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{word}</span> : word + ' ')}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.4 }}>
                            {type === 'workforce' ? `Managing and scaling your talent network. ${employees.length} active profiles monitored.` :
                                type === 'status' ? `Real-time visibility into peak performance and workforce engagement.` :
                                    `Systematic overview of organizational ${title.toLowerCase()} and operational assets.`}
                        </p>
                    </div>

                    {(type === 'leaves' || type === 'employee-leave-info') && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {type === 'leaves' && (
                                <button
                                    onClick={() => navigate('/executive-dashboard/leaves/employee-info')}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        padding: '18px 24px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    <Users size={24} strokeWidth={3} />
                                    Leave Info
                                </button>
                            )}

                            {type === 'employee-leave-info' && (
                                <button
                                    onClick={() => navigate('/executive-dashboard/leaves')}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        padding: '18px 24px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    <ChevronRight size={24} strokeWidth={3} style={{ transform: 'rotate(180deg)' }} />
                                    Back to Requests
                                </button>
                            )}

                            {type === 'leaves' && (
                                <button
                                    onClick={() => openApplyLeaveModal()}
                                    style={{
                                        background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                                        color: 'white',
                                        padding: '18px 36px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1.1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(56, 189, 248, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(56, 189, 248, 0.4)';
                                    }}
                                >
                                    <Plus size={24} strokeWidth={3} />
                                    Apply Leave
                                </button>
                            )}
                        </div>
                    )}
                    {(type === 'workforce' || type === 'recruitment' || type === 'policies') && (
                        <button
                            onClick={() => {
                                handleAction(type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy');
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                                color: 'white',
                                padding: '18px 36px',
                                borderRadius: '24px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '1.1rem',
                                letterSpacing: '-0.02em'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(56, 189, 248, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(56, 189, 248, 0.4)';
                            }}
                        >
                            <Plus size={24} strokeWidth={3} />
                            {type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy'}
                        </button>
                    )}

                    {/* Employee Lifecycle Button on Workforce Page */}
                    {type === 'workforce' && (
                        <button
                            onClick={() => navigate('/executive-dashboard/lifecycle')}
                            style={{
                                background: 'white',
                                color: 'var(--primary)',
                                padding: '18px 36px',
                                borderRadius: '24px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '1.1rem',
                                letterSpacing: '-0.02em'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)';
                            }}
                        >
                            <TrendingUp size={24} strokeWidth={3} />
                            Manage Lifecycle
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats Summary */}
            {(type === 'workforce' || type === 'status') && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px',
                    marginBottom: '8px'
                }}>
                    {[
                        { label: 'Total Workforce', value: employees.length, icon: <Users size={20} />, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
                        { label: 'Active Now', value: employees.filter(e => e.availability === 'Online').length, icon: <CheckCircle size={20} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
                        { label: 'On Leave', value: employees.filter(e => e.availability === 'On Leave').length, icon: <Clock size={20} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
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

            {/* Search and Filters Bar */}
            {(type === 'workforce' || type === 'status') && (
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
                            placeholder={`Search ${title.toLowerCase()}...`}
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

            {/* Premium Representation for Workforce/Status */}
            {(type === 'workforce' || type === 'status') ? (
                viewType === 'grid' ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: type === 'status' ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '16px',
                        marginTop: '8px'
                    }}>
                        {employees.filter(emp => {
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
                                    border: (type === 'status' && emp.availability === 'Online') ? '2px solid #22c55e' : '1px solid #f1f5f9',
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
                                    e.currentTarget.style.borderColor = (type === 'status' && emp.availability === 'Online') ? '#22c55e' : '#e2e8f0';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.06)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = (type === 'status' && emp.availability === 'Online') ? '#22c55e' : '#f1f5f9';
                                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.02)';
                                }}
                                onClick={() => type === 'workforce' ? handleAction('View Employee', emp) : handleAction('View Status', emp)}
                            >


                                {/* Profile Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                            {emp.avatar_url ? (
                                                <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#64748b' }}>{emp.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.department_display}</span>
                                                <span style={{ color: '#cbd5e1', flexShrink: 0 }}>•</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : emp.availability === 'On Leave' ? '#ef4444' : '#94a3b8' }}></span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: emp.availability === 'Online' ? '#16a34a' : emp.availability === 'On Leave' ? '#dc2626' : '#64748b' }}>{emp.availability}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 10, flexShrink: 0, marginLeft: 'auto' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction(type === 'workforce' ? 'View Employee' : 'View Status', emp); }}
                                            style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('Edit Employee', emp); }}
                                            style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </div>
                                </div>

                                {type === 'status' ? (
                                    <>
                                        {/* Activity Pulse Section */}
                                        <div style={{
                                            backgroundColor: '#f8fafc',
                                            borderRadius: '16px',
                                            padding: '16px',
                                            border: '1px solid #f1f5f9'
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

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: '700' }}>
                                                    {emp.role}
                                                </span>
                                                <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#6d28d9', fontSize: '0.7rem', fontWeight: '700' }}>
                                                    {emp.job_title}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAction('View Status', emp); }}
                                                style={{ color: '#3182ce', fontSize: '0.8rem', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                Live Intel <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Info Grid for Workforce */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div style={{ padding: '16px', borderRadius: '20px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', minWidth: 0 }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Briefcase size={12} /> Job Title
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.job_title || 'N/A'}</div>
                                            </div>
                                            <div style={{ padding: '16px', borderRadius: '20px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', minWidth: 0 }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Users size={12} /> Department
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.department_display || 'N/A'}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {emp.projects > 0 ? (
                                                <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #d1fae5' }}>
                                                    Active on {emp.projects} Projects
                                                </span>
                                            ) : (
                                                <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#d97706', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #ffedd5' }}>
                                                    Awaiting Project
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Premium List View Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: type === 'status' ? 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px' : 'minmax(300px, 1.5fr) 1fr 1fr 1fr 120px',
                            padding: '12px 32px',
                            color: '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <div>{type === 'status' ? 'Live Operator' : 'Employee Details'}</div>
                            <div>{type === 'status' ? 'Department' : 'Designation'}</div>
                            <div>{type === 'status' ? 'Live Activity / Presence' : 'Organization / Team'}</div>
                            <div>{type === 'status' ? 'Last Signal' : 'Employment Status'}</div>
                            <div style={{ textAlign: 'right' }}>Actions</div>
                        </div>

                        {/* Premium List Rows */}
                        {employees.filter(emp => {
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
                                    gridTemplateColumns: type === 'status' ? 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px' : 'minmax(300px, 1.5fr) 1fr 1fr 1fr 120px',
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
                                onClick={() => type === 'workforce' ? handleAction('View Employee', emp) : handleAction('View Status', emp)}
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
                                        {type === 'status' && (
                                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : '#cbd5e1', border: '2px solid white' }}></div>
                                        )}
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</h4>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{emp.job_title}</p>
                                    </div>
                                </div>

                                <div style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem' }}>
                                    {emp.department_display || 'Main Office'}
                                </div>

                                {type === 'status' ? (
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
                                ) : (
                                    <div style={{ color: '#64748b', fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></div>
                                        {emp.role}
                                    </div>
                                )}

                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>{type === 'status' ? emp.lastActive : emp.availability}</div>
                                    {type === 'status' && (
                                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Session Lock</div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAction(type === 'status' ? 'View Status' : 'View Employee', emp); }}
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
                    data={config.data.filter(item => {
                        const searchStr = searchTerm.toLowerCase();
                        return (
                            (item.name && typeof item.name === 'string' && item.name.toLowerCase().includes(searchStr)) ||
                            (item.job_title && typeof item.job_title === 'string' && item.job_title.toLowerCase().includes(searchStr)) ||
                            (item.department_display && typeof item.department_display === 'string' && item.department_display.toLowerCase().includes(searchStr)) ||
                            (item.role && typeof item.role === 'string' && item.role.toLowerCase().includes(searchStr))
                        );
                    })}
                    onAction={handleAction}
                />
            )}

            {
                showApplyLeaveModal && (
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
                                            >
                                                <option value="Casual Leave">Casual Leave</option>
                                                <option value="Sick Leave">Sick Leave</option>
                                                <option value="Vacation">Vacation</option>
                                                <option value="Personal Leave">Personal Leave</option>
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
                )
            }

            {/* Employee Details Modal */}
            {
                showEmployeeModal && selectedEmployee && (
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
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>
                                            {selectedEmployee.job_title ? `${selectedEmployee.job_title} (${selectedEmployee.role})` : selectedEmployee.role}
                                        </p>
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
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Job Title</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.job_title || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Employment Type</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                                {selectedEmployee.employment_type ? selectedEmployee.employment_type.replace('_', ' ') : 'N/A'}
                                            </p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Department</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.department_display || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Project</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Compensation Details - Role-based visibility */}
                                {(userRole === 'executive' || userRole === 'manager') && employeeSalary && (
                                    <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border)' }}>
                                        <h5 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Compensation Details</h5>

                                        {/* Salary Breakdown */}
                                        <div style={{ backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                                                <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>Basic Salary</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.basic_salary?.toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                                                <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>House Rent Allowance</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.hra?.toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                                                <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>Other Allowances</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.allowances?.toLocaleString() || '0'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }}>
                                                <span style={{ fontSize: '1.05rem', color: '#111827', fontWeight: 700 }}>Gross Salary</span>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366f1' }}>
                                                    ₹{((employeeSalary.basic_salary || 0) + (employeeSalary.hra || 0) + (employeeSalary.allowances || 0)).toLocaleString()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '2px solid #e5e7eb', backgroundColor: '#fef2f2' }}>
                                                <span style={{ fontSize: '0.95rem', color: '#991b1b', fontWeight: 500 }}>Professional Tax (Deduction)</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991b1b' }}>-₹{employeeSalary.professional_tax?.toLocaleString() || '0'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', backgroundColor: '#ecfdf5' }}>
                                                <span style={{ fontSize: '1.05rem', color: '#065f46', fontWeight: 700 }}>Net Salary</span>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>
                                                    ₹{(((employeeSalary.basic_salary || 0) + (employeeSalary.hra || 0) + (employeeSalary.allowances || 0)) - (employeeSalary.professional_tax || 0)).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Effective Dates */}
                                        <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Effective From</p>
                                                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
                                                        {employeeSalary.effective_from ? new Date(employeeSalary.effective_from).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Effective To</p>
                                                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
                                                        {employeeSalary.effective_to ? new Date(employeeSalary.effective_to).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Present'}
                                                    </p>
                                                </div>
                                            </div>
                                            {employeeSalary.change_reason && (
                                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Reason for Change</p>
                                                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#111827' }}>{employeeSalary.change_reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Performance Metrics */}
                                <div style={{ marginTop: '48px' }}>
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
                )
            }

            {/* Candidate Details Modal */}
            {
                showCandidateModal && selectedCandidate && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '650px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
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
                )
            }
            {/* Add Employee Modal */}
            <AddEmployeeModal
                isOpen={showAddEmployeeModal}
                onClose={() => setShowAddEmployeeModal(false)}
                orgId={orgId}
                onSuccess={async () => {
                    addToast('Employee added successfully', 'success');
                    setShowAddEmployeeModal(false);
                    // Refresh employees list
                    if (type === 'workforce' || type === 'status') {
                        window.location.reload();
                    }
                }}
            />

            {/* Add/Edit Candidate Modal */}
            {
                showCandidateFormModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '16px', width: '700px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{isEditingCandidate ? 'Edit Candidate' : 'Add New Candidate'}</h3>
                                <button onClick={() => setShowCandidateFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Full Name</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.name}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, name: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Email</label>
                                        <input
                                            type="email"
                                            value={candidateFormData.email}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Role Applied For</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.role}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, role: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Phone</label>
                                        <input
                                            type="tel"
                                            value={candidateFormData.phone}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Stage</label>
                                        <select
                                            value={candidateFormData.stage}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, stage: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="Screening">Screening</option>
                                            <option value="Interview">Interview</option>
                                            <option value="Offer">Offer</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="Hired">Hired</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Score (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={candidateFormData.score}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, score: parseInt(e.target.value) || 0 })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Source</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.source}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, source: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Applied Date</label>
                                        <input
                                            type="date"
                                            value={candidateFormData.appliedDate}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, appliedDate: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Experience</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.experience}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, experience: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Education</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.education}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, education: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Location</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.location}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, location: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Expected Salary</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.expectedSalary}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, expectedSalary: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Skills (comma separated)</label>
                                    <input
                                        type="text"
                                        value={candidateFormData.skills}
                                        onChange={(e) => setCandidateFormData({ ...candidateFormData, skills: e.target.value })}
                                        placeholder="React, Node.js, Python..."
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Notes</label>
                                    <textarea
                                        value={candidateFormData.notes}
                                        onChange={(e) => setCandidateFormData({ ...candidateFormData, notes: e.target.value })}
                                        rows="3"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCandidateFormModal(false)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                                    >
                                        {isEditingCandidate ? 'Update Candidate' : 'Add Candidate'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }



            {/* Edit Employee Modal */}
            <EditEmployeeModal
                isOpen={showEditEmployeeModal}
                onClose={() => {
                    setShowEditEmployeeModal(false);
                    setSelectedEmployeeForEdit(null);
                }}
                employee={selectedEmployeeForEdit}
                orgId={orgId}
                onSuccess={async () => {
                    addToast('Employee updated successfully', 'success');
                    // Refresh employees list
                    if (type === 'workforce' || type === 'status') {
                        try {
                            const { data, error } = await supabase
                                .from('profiles')
                                .select(`
                                    id, 
                                    full_name, 
                                    email, 
                                    role, 
                                    job_title,
                                    employment_type,
                                    team_id, 
                                    department,
                                    created_at,
                                    teams!team_id (
                                        team_name
                                    )
                                `);

                            if (error) {
                                console.error('Error refreshing employees:', error);
                                return;
                            }

                            // Also fetch project assignments
                            const { data: teamMembersData } = await supabase
                                .from('project_members')
                                .select(`
                                    user_id,
                                    project_id,
                                    projects:project_id (
                                        name
                                    )
                                `);

                            const projectMap = {};
                            if (teamMembersData) {
                                teamMembersData.forEach(member => {
                                    if (!projectMap[member.user_id]) projectMap[member.user_id] = []; if (member.projects?.name) projectMap[member.user_id].push(member.projects.name);
                                });
                            }

                            if (data) {
                                const transformedEmployees = data.map(emp => {
                                    // Match department name from ID
                                    const matchedDept = departments.find(d => d.id === emp.department);
                                    const departmentNameDisplay = matchedDept ? matchedDept.department_name : (emp.department || 'N/A');

                                    return {
                                        id: emp.id,
                                        name: emp.full_name || 'N/A',
                                        email: emp.email || 'N/A',
                                        role: emp.role || 'N/A',
                                        job_title: emp.job_title,
                                        employment_type: emp.employment_type || 'Full-Time',
                                        team_id: emp.team_id,
                                        dept: (Array.isArray(projectMap[emp.id]) && projectMap[emp.id].length > 0) ? (<>{projectMap[emp.id].map((pn, i) => <div key={i}>{pn}</div>)}</>) : (emp.teams?.team_name || 'Unassigned'),
                                        department_display: departmentNameDisplay,
                                        status: 'Active',
                                        joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A',
                                        performance: 'N/A',
                                        projects: 0,
                                        tasksCompleted: 0
                                    };
                                });
                                setEmployees(transformedEmployees);
                            }
                        } catch (err) {
                            console.error('Error refreshing after edit:', err);
                        }
                    }
                }}
            />
            {
                showLeaveDetailsModal && selectedLeaveRequest && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                        <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', borderRadius: '32px', padding: '40px', width: '1000px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', position: 'relative' }}>
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

                            {/* Employee Info Card */}
                            <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: 'var(--background)', borderRadius: '24px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Employee</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedLeaveRequest.name}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Leave Type</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedLeaveRequest.type}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Breakdown</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
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
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
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
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            backgroundColor: '#fee2e2',
                                            color: '#b91c1c',
                                            border: '1px solid #fca5a5'
                                        }}>
                                            LOP: {selectedLeaveRequest.lop_days || 0} days
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Status</p>
                                    <span style={{ padding: '6px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', backgroundColor: selectedLeaveRequest.status === 'Approved' ? '#dcfce7' : selectedLeaveRequest.status === 'Pending' ? '#fef3c7' : '#fee2e2', color: selectedLeaveRequest.status === 'Approved' ? '#166534' : selectedLeaveRequest.status === 'Pending' ? '#b45309' : '#991b1b' }}>
                                        {selectedLeaveRequest.status}
                                    </span>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Reason</p>
                                    <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.5' }}>{selectedLeaveRequest.reason}</p>
                                </div>
                            </div>

                            {/* Day-wise Breakdown */}
                            <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)' }}>
                                    Day-wise Breakdown
                                </h4>
                                <div style={{
                                    display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: (() => {
                                        const start = new Date(selectedLeaveRequest.startDate);
                                        const end = new Date(selectedLeaveRequest.endDate);
                                        let dayCount = 0;
                                        let current = new Date(start);
                                        while (current <= end) {
                                            dayCount++;
                                            current.setDate(current.getDate() + 1);
                                        }
                                        // Each day item is ~46px (36px height + 10px gap), show up to 7 days without scroll
                                        return dayCount <= 7 ? 'none' : '322px';
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
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: day.bgColor, borderRadius: '12px', border: `1px solid ${day.borderColor}`, alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{day.date}</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: day.color }}>
                                                    {day.status}
                                                </span>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Live Re-evaluation Preview */}
                            {selectedLeaveRequest.employee_id !== userId && selectedLeaveRequest.status === 'Pending' && (
                                <div style={{
                                    marginTop: '24px',
                                    padding: '24px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                    border: '1px solid #bae6fd',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#0369a1' }}>
                                        <Activity size={20} />
                                        <h4 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Live Approval Preview</h4>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                                        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e0f2fe' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Current Balance</p>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalBalance} Days</div>
                                        </div>
                                        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e0f2fe' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Other Pending (Paid)</p>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalPendingPaid} Days</div>
                                        </div>
                                        <div style={{
                                            backgroundColor: '#0369a1',
                                            padding: '16px',
                                            borderRadius: '16px',
                                            color: 'white',
                                            gridColumn: 'span 1'
                                        }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '8px' }}>Effective Balance</p>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{Math.max(0, evalBalance - evalPendingPaid)} Days</div>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        backgroundColor: 'rgba(255,255,255,0.5)',
                                        borderRadius: '16px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        color: '#0c4a6e',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></div>
                                        {(() => {
                                            const totalReq = (selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0);
                                            const effective = Math.max(0, evalBalance - evalPendingPaid);
                                            const willBePaid = Math.max(0, Math.min(totalReq, effective));
                                            const willBeLop = totalReq - willBePaid;

                                            if (willBeLop > 0) {
                                                return `If approved: ${willBePaid} days will be Paid, ${willBeLop} days will be Loss of Pay.`;
                                            }
                                            return `If approved: All ${willBePaid} days will be Paid.`;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Tasks During Leave */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
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
                                                                }}>{task.priority || 'Medium'}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                            No tasks scheduled during this leave period.
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={20} color="var(--primary)" /> Your Pending Tasks
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

                            {/* Approver Responsibilities */}
                            <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                                <h4 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={22} /> Approver Responsibilities
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {APPROVER_RESPONSIBILITIES.map((resp, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>{resp}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
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
                )
            }

            {/* Add Policy Modal */}
            <AddPolicyModal
                isOpen={showAddPolicyModal}
                onClose={() => setShowAddPolicyModal(false)}
                onSuccess={handlePolicySuccess}
                orgId={orgId}
            />

            {/* Edit Policy Modal */}
            <EditPolicyModal
                isOpen={showEditPolicyModal}
                onClose={() => setShowEditPolicyModal(false)}
                onSuccess={handlePolicySuccess}
                policy={selectedPolicy}
                orgId={orgId}
            />
        </div >
    );
};

export default ModulePage;
