import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Trash2, Activity, CheckCircle, MoreVertical, AlertTriangle, Users } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useProject } from '../context/ProjectContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import StatusDemo from '../components/Demo/StatusDemo';
import PayslipsPage from '../../shared/PayslipsPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import ProjectDocuments from './ProjectDocuments';




const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { currentTeam, userName, userId, teamId, orgId, userRole } = useUser();
    const { projectRole, currentProject, refreshProjects } = useProject(); // Destructure refreshProjects

    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [remainingLeaves, setRemainingLeaves] = useState(0);



    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]); // New state for applier/approver pending tasks

    // State for team members
    const [teamMembers, setTeamMembers] = useState([]);
    const [activeMenuId, setActiveMenuId] = useState(null);

    // State for Handover Modal
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedMemberForHandover, setSelectedMemberForHandover] = useState(null);

    // State for Realtime Updates
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
    const [policyError, setPolicyError] = useState(null);


    // Fetch leaves from Supabase
    useEffect(() => {
        if (!userId) return;

        const fetchLeaves = async () => {
            if (!orgId) return;
            console.log('fetchLeaves called. User ID from context:', userId);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('No user found in supabase.auth.getUser()');
                return;
            }

            console.log('Fetching leaves for user:', user.id);

            // Attempt fetch without ordering first to be safe
            const { data, error } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', user.id)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching leaves:', error);
                addToast('Error fetching leaves: ' + error.message, 'error');
            } else {
                console.log('Leaves fetched from DB:', data);
                // Map Supabase data to table format
                const mappedLeaves = data.map(leave => {
                    const start = new Date(leave.from_date);
                    const end = new Date(leave.to_date);

                    // Use duration_weekdays if available in DB, else calculate on the fly
                    const diffDays = leave.duration_weekdays || calculateWeekdayDuration(leave.from_date, leave.to_date);

                    let type = 'Leave';
                    let reason = leave.reason || '';
                    if (reason.includes(':')) {
                        const parts = reason.split(':');
                        type = parts[0];
                    }

                    // If lop_days > 0, we can mention it in the type or duration
                    const displayDuration = diffDays === 1 ? '1 Day' : `${diffDays} Days`;
                    const lopSuffix = leave.lop_days > 0 ? ` (+${leave.lop_days} LOP)` : '';

                    // Normalize status for display (capitalized)
                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        employee_id: leave.employee_id,
                        name: userName, // Use context userName or fallback
                        type: type,
                        reason: leave.reason || 'No reason provided', // Include full reason from DB
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: displayDuration + lopSuffix,
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        appliedOn: leave.created_at ? new Date(leave.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                        created_at: leave.created_at, // For sorting
                        lop_days: leave.lop_days || 0,
                        duration_weekdays: diffDays
                    };
                });
                // Sort by status (Pending first) then by created_at descending
                mappedLeaves.sort((a, b) => {
                    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                setLeaveRequests(mappedLeaves);
            }
        };

        const fetchRemainingLeaves = async () => {
            // Fetch directly using auth user to ensure latest data
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('total_leaves_balance, monthly_leave_quota, leaves_taken_this_month')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();

            if (data) {
                // Return total accumulated balance
                setRemainingLeaves(data.total_leaves_balance || 0);
            }
        };

        fetchLeaves();
        fetchRemainingLeaves();
    }, [userId, userName, addToast, refreshTrigger, orgId]);

    // Helper to check if a date is a weekday (Mon-Fri)
    const isWeekday = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDay();
        return day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
    };

    // Helper to calculate duration excluding weekends
    const calculateWeekdayDuration = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let count = 0;
        const cur = new Date(start);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    };

    // Fetch team members based on Current Project
    useEffect(() => {
        if (!currentProject?.id) {
            setTeamMembers([]);
            return;
        }

        const fetchTeamMembers = async () => {
            try {
                // 1. Fetch project members IDs AND Roles
                const { data: projectMembersData, error: memberError } = await supabase
                    .from('project_members')
                    .select('user_id, role')
                    .eq('project_id', currentProject.id)
                    .eq('org_id', orgId);

                if (memberError) throw memberError;

                if (!projectMembersData || projectMembersData.length === 0) {
                    setTeamMembers([]);
                    return;
                }

                const userIds = projectMembersData.map(m => m.user_id);
                const projectRoleMap = {};
                projectMembersData.forEach(pm => {
                    projectRoleMap[pm.user_id] = pm.role;
                });

                // 2. Fetch profiles for these users
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', userIds)
                    .eq('org_id', orgId);

                if (profileError) throw profileError;

                // 2.1 Fetch Departments for mapping
                const { data: deptData } = await supabase.from('departments').select('id, department_name').eq('org_id', orgId);
                const deptMap = {};
                if (deptData) {
                    deptData.forEach(d => deptMap[d.id] = d.department_name);
                }

                // 3. Use Current Project Name
                const teamName = currentProject.name || 'Unassigned';

                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                console.log('🔍 Fetching attendance for date range:', [yesterday, today]);

                // 4. Fetch today's attendance for status (Check both yesterday and today for late shifts/timezones)
                const { data: attendance, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('employee_id, clock_in, clock_out, date')
                    .in('employee_id', userIds)
                    .eq('org_id', orgId)
                    .in('date', [yesterday, today]);

                if (attendanceError) {
                    console.error('❌ Attendance Fetch Error:', attendanceError);
                }

                const activeSet = new Set();
                const lastActiveMap = {};

                if (attendance) {
                    // Sort by date/time to get most recent if multiple records exist
                    const sortedAttendance = [...attendance].sort((a, b) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.clock_in.localeCompare(b.clock_in);
                    });

                    sortedAttendance.forEach(a => {
                        // A user is active if they have a clock_in and NO clock_out in their MOST RECENT record
                        if (a.clock_in && !a.clock_out) {
                            activeSet.add(a.employee_id);
                        } else if (a.clock_out) {
                            activeSet.delete(a.employee_id); // Ensure they are removed if they have a later checkout
                        }
                    });
                }

                console.log('✅ Active Team Members:', Array.from(activeSet));

                // 5. Fetch today's leaves for status
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('employee_id')
                    .eq('status', 'approved')
                    .eq('org_id', orgId)
                    .in('employee_id', userIds)
                    .lte('from_date', today)
                    .gte('to_date', today);

                const leaveSet = new Set(leaves?.map(l => l.employee_id));

                const mappedMembers = profiles.map(member => {
                    let status = 'Offline';
                    if (activeSet.has(member.id)) {
                        status = 'Active';
                    } else if (leaveSet.has(member.id)) {
                        status = 'On Leave';
                    }

                    const projectRole = projectRoleMap[member.id];
                    const isProjectManager = projectRole === 'manager';

                    return {
                        id: member.id,
                        name: member.full_name || 'Unknown',
                        email: member.email || 'N/A',
                        role: member.role || 'N/A',
                        projectRole: projectRole,
                        isProjectManager: isProjectManager,
                        dept: teamName,
                        department: member.department, // Keep original department ID for internal logic
                        departmentName: deptMap[member.department] || 'Unassigned',
                        phone: member.phone || 'N/A',
                        location: member.location || 'N/A',
                        status: status,
                        joinDate: member.join_date ? new Date(member.join_date).toLocaleDateString() : (member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'),
                        avatar_url: member.avatar_url
                    };
                });
                setTeamMembers(mappedMembers);

            } catch (err) {
                console.error('Error fetching team members:', err);
                setTeamMembers([]);
            }
        };

        fetchTeamMembers();
    }, [currentProject?.id, refreshTrigger, orgId]);

    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('employee-module-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1); // For team status updates
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
                console.log('Project members updated, refreshing...');
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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


    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false); // New confirmation state
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

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    const fetchEmployeeTasks = async (employeeId, startDate, endDate) => {
        // Log parameters for debugging
        console.log('fetchEmployeeTasks params:', { employeeId, startDate, endDate });

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
            console.log('fetchEmployeeTasks result:', data);
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    };

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

    const handleViewLeave = async (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);

        // Fetch tasks for the employee during leave dates
        // Note: For employees, they are viewing their own leaves, so we use their ID (userId)
        // unless the leaveRequest object has employee_id (which it should from fetch)
        const employeeId = leaveRequest.employee_id || userId;

        const tasks = await fetchEmployeeTasks(
            employeeId,
            leaveRequest.startDate, // Use standardized camelCase keys from transformation
            leaveRequest.endDate
        );
        setEmployeeTasks(tasks);

        // Fetch pending tasks (Backlog) for the employee (current user, usually)
        // Tasks due BEFORE the leave starts
        const approverTasks = await fetchPendingTasks(employeeId, leaveRequest.startDate);
        setPendingTasks(approverTasks);

        setShowLeaveDetailsModal(true);
    };

    // Helper to check if leave was created within the last 12 hours
    const isWithin12Hours = (createdAt) => {
        console.log('isWithin12Hours check:', { createdAt, type: typeof createdAt });
        if (!createdAt) {
            console.log('createdAt is null/undefined, returning false');
            return false;
        }
        const createdTime = new Date(createdAt).getTime();
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        const diff = now - createdTime;
        const result = diff < twelveHoursMs;
        console.log('isWithin12Hours result:', { createdTime, now, diff, twelveHoursMs, result });
        return result;
    };

    // Delete leave handler with balance refund
    const handleDeleteLeave = async (leaveRequest) => {
        if (!window.confirm('Are you sure you want to delete this leave request?')) {
            return;
        }

        try {
            // Calculate duration for refund (Paid days only)
            // If the record has duration_weekdays saved, use that MINUS lop_days
            const paidDaysToRefund = (leaveRequest.duration_weekdays || 0);

            // Delete the leave request
            const { error: deleteError } = await supabase
                .from('leaves')
                .delete()
                .eq('id', leaveRequest.id)
                .eq('org_id', orgId);

            if (deleteError) throw deleteError;

            // Refund logic REMOVED. Since leaves are no longer deducted on application, 
            // no refund is needed when deleting a pending request.

            // Update local state
            setLeaveRequests(prev => prev.filter(l => l.id !== leaveRequest.id));
            addToast('Leave request deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting leave:', error);
            addToast('Failed to delete leave request: ' + error.message, 'error');
        }
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

            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

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

    const initiatHandover = (member) => {
        setSelectedMemberForHandover(member);
        setShowHandoverModal(true);
    };

    const confirmHandover = async () => {
        if (!currentProject || !selectedMemberForHandover) return;

        try {
            const { error } = await supabase.rpc('handover_project_role', {
                project_id_input: currentProject.id,
                target_user_id_input: selectedMemberForHandover.id
            });

            if (error) throw error;

            addToast('Role handover successful! You are now an employee.', 'success');
            setShowHandoverModal(false);
            setSelectedMemberForHandover(null);

            // Refresh permissions and project data
            if (refreshProjects) await refreshProjects();

            // Refresh table
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Handover failed:', error);
            addToast(error.message || 'Handover failed', 'error');
        }
    };

    const handleAction = async (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setSelectedDates([]);
            setDateToAdd('');

            // Fetch pending tasks for the applier
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tasks = await fetchPendingTasks(user.id);
                setPendingTasks(tasks);
            }

            setShowApplyLeaveModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            // Update local state first for immediate UI feedback
            setLeaveRequests(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: action === 'Approve' ? 'Approved' : 'Rejected' }
                        : request
                )
            );

            // Notify the employee about the status update
            const notifyEmployee = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const notification = {
                    receiver_id: item.employee_id, // The employee who requested leave
                    sender_id: user.id,            // The manager (current user)
                    sender_name: userName || 'Manager',
                    message: `Your leave request has been ${action} by ${userName || 'Manager'}`,
                    type: 'leave_status_update',
                    is_read: false,
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase.from('notifications').insert([{ ...notification, org_id: orgId }]);
                if (error) console.error('Error sending approval notification:', error);
            };
            notifyEmployee();

            addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
        } else if (action === 'View Team Member') {
            setSelectedEmployee(item);
            setShowEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const submitLeaveRequest = async () => {
        // Renamed from handleApplyLeave to submitLeaveRequest
        // e.preventDefault(); // Moved to handleApplyLeave wrapper

        if (!userId) {
            addToast('User ID not found. Please log in again.', 'error');
            return;
        }

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

        try {
            // Fetch the latest team_id from profile to ensure validity
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', userId)
                .eq('org_id', orgId)
                .single();

            if (profileError) {
                console.warn('Could not fetch latest team_id, using context fallback', profileError);
            }

            const currentTeamId = profileData?.team_id || null;
            console.log('Submitting leave with team_id:', currentTeamId);

            // Calculate total weekdays requested
            const weekdaysRequested = useSpecificDates
                ? datesToApply.filter(date => isWeekday(date)).length
                : calculateWeekdayDuration(leaveFormData.startDate, leaveFormData.endDate);

            // Fetch latest balance AND pending leaves to calculate effective balance
            // This prevents over-drawing before a manager reviews pending requests
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('total_leaves_balance, leaves_taken_this_month')
                .eq('id', userId)
                .eq('org_id', orgId)
                .single();

            if (userError) throw userError;

            const { data: pendingLeaves, error: pendingError } = await supabase
                .from('leaves')
                .select('duration_weekdays')
                .eq('employee_id', userId)
                .eq('status', 'pending');

            if (pendingError) throw pendingError;

            const sumPendingPaid = pendingLeaves?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0;
            const currentBalance = userData.total_leaves_balance || 0;
            const effectiveBalance = Math.max(0, currentBalance - sumPendingPaid);

            const paidDays = Math.max(0, Math.min(weekdaysRequested, effectiveBalance));
            const lopDays = weekdaysRequested - paidDays;

            const leaveReason = `${leaveFormData.leaveType}: ${leaveFormData.reason}` +
                (useSpecificDates ? ` (Dates: ${datesToApply.join(', ')})` : '') +
                (lopDays > 0 ? ` [Loss of Pay: ${lopDays} days]` : '');

            const leaveRows = useSpecificDates
                ? datesToApply.map(date => ({
                    employee_id: userId,
                    org_id: orgId,
                    team_id: currentTeamId,
                    from_date: date,
                    to_date: date,
                    reason: leaveReason,
                    status: 'pending',
                    duration_weekdays: isWeekday(date) ? 1 : 0,
                    lop_days: 0 // We'll handle LOP specifically for ranges, for specific dates it's harder to split per row unless we iterate
                }))
                : [{
                    employee_id: userId,
                    org_id: orgId,
                    team_id: currentTeamId,
                    from_date: leaveFormData.startDate,
                    to_date: leaveFormData.endDate,
                    reason: leaveReason,
                    status: 'pending',
                    duration_weekdays: paidDays,
                    lop_days: lopDays
                }];

            // If using specific dates, we need to decide which ones are LOP
            if (useSpecificDates) {
                let remainingPaid = paidDays;
                leaveRows.forEach(row => {
                    if (row.duration_weekdays > 0) {
                        if (remainingPaid > 0) {
                            remainingPaid--;
                        } else {
                            row.lop_days = 1;
                            row.duration_weekdays = 0;
                        }
                    }
                });
            }

            // Attempt 1: Try with the fetched team_id
            const { error: attempt1Error } = await supabase
                .from('leaves')
                .insert(leaveRows);

            if (attempt1Error) {
                console.warn('Attempt 1 with team_id failed:', attempt1Error);
                // Retrying logic... (same as original)
                if (attempt1Error.code === '23503' || attempt1Error.code === '409' || attempt1Error.message?.includes('violates foreign key constraint')) {
                    const fallbackRows = leaveRows.map(row => ({ ...row, team_id: null }));
                    const { error: attempt2Error } = await supabase.from('leaves').insert(fallbackRows);
                    if (attempt2Error) throw attempt2Error;
                } else {
                    throw attempt1Error;
                }
            }

            // Balance update REMOVED. Deduction now occurs only on Approval to prevent balance jumps.

            // --- NOTIFICATION LOGIC START ---
            try {
                // Explicitly get current user to ensure we have the correct ID for sender_id
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const senderId = currentUser?.id || userId; // Fallback to context ID if fetch fails (unlikely)

                // 1. Find Managers/Team Leads of this team
                const { data: managers } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('org_id', orgId)
                    .in('role', ['manager', 'team_lead']);

                // 2. Find All Executives
                const { data: executives } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('org_id', orgId)
                    .eq('role', 'executive');

                // 3. Combine recipients (Manager + Executives), excluding current user
                const recipientIds = new Set();

                managers?.forEach(m => recipientIds.add(m.id));
                executives?.forEach(e => recipientIds.add(e.id));
                recipientIds.delete(senderId); // Don't notify self

                if (recipientIds.size > 0) {
                    const notificationRecords = Array.from(recipientIds).map(receiverId => ({
                        receiver_id: receiverId,
                        sender_id: senderId, // <--- Now using the explicitly fetched ID
                        org_id: orgId,
                        sender_name: userName || 'Employee',
                        message: `${userName || 'Employee'} has applied for ${leaveFormData.leaveType}`,
                        type: 'leave_request',
                        is_read: false,
                        created_at: new Date().toISOString()
                    }));

                    const { error: notifError } = await supabase
                        .from('notifications')
                        .insert(notificationRecords);

                    if (notifError) console.error('Error sending notifications:', notifError);
                    else console.log('Notifications sent to:', Array.from(recipientIds));
                }
            } catch (notifErr) {
                console.error('Notification logic failed:', notifErr);
                // Don't block the main success flow
            }
            // --- NOTIFICATION LOGIC END ---

            addToast('Leave application submitted successfully', 'success');
            setShowApplyLeaveModal(false);
            setLeaveFormData({
                leaveType: 'Casual Leave',
                startDate: '',
                endDate: '',
                reason: ''
            });
            setSelectedDates([]);
            setDateToAdd('');

            // Refresh leaves list
            const { data: newLeaves, error: fetchError } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', userId)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (!fetchError && newLeaves) {
                const mappedLeaves = newLeaves.map(leave => {
                    const start = new Date(leave.from_date);
                    const end = new Date(leave.to_date);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    let type = 'Leave';
                    let reason = leave.reason || '';
                    if (reason.includes(':')) {
                        type = reason.split(':')[0];
                    }

                    // Normalize status for display (capitalized)
                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        employee_id: leave.employee_id,
                        name: userName,
                        type: type,
                        reason: leave.reason || 'No reason provided', // Include full reason from DB
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        appliedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                        created_at: new Date().toISOString()
                    };
                });
                // Sort by status (Pending first) then by created_at
                mappedLeaves.sort((a, b) => {
                    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                setLeaveRequests(mappedLeaves);
            }

        } catch (error) {
            console.error('Error submitting leave:', error);
            addToast('Failed to submit leave request: ' + error.message, 'error');
        }
    };

    const handleApplyLeave = (e) => {
        e.preventDefault();

        if (!userId) {
            addToast('User ID not found. Please log in again.', 'error');
            return;
        }

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

        // Show confirmation modal instead of submitting directly
        setShowConfirmationModal(true);
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <TaskLifecyclePage userRole={userRole} userId={userId} addToast={addToast} projectRole={projectRole} currentProjectId={currentProject?.id} teamId={teamId} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'status') return <StatusDemo />;
    if (type === 'project-documents') return <ProjectDocuments />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;

    // Helper to filter data by team
    const filterData = (data) => {
        // For leaves, we want to show all the user's leaves, not filter by team
        if (type === 'leaves') return data;

        if (!currentTeam || currentTeam === 'All') return data;
        return data.filter(item => item.dept === currentTeam || item.department === currentTeam);
    };

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Team Member Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {row.avatar_url ? (
                                <img
                                    src={row.avatar_url}
                                    alt={row.name}
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                />
                            ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {row.name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <p style={{ fontWeight: 500 }}>{row.name}</p>
                                    {row.isProjectManager && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: '700',
                                            color: '#fff',
                                            backgroundColor: '#8b5cf6',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            boxShadow: '0 2px 4px rgba(139,92,246,0.2)'
                                        }}>
                                            Project Manager
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Department', accessor: 'dept' },
                {
                    header: 'Status', accessor: 'status', render: (row) => {
                        let bgColor, textColor;
                        if (row.status === 'Active') {
                            bgColor = '#dcfce7'; textColor = '#166534';
                        } else if (row.status === 'On Leave') {
                            bgColor = '#fef3c7'; textColor = '#b45309';
                        } else {
                            bgColor = '#f1f5f9'; textColor = '#64748b';
                        }
                        return (
                            <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: bgColor,
                                color: textColor
                            }}>
                                {row.status}
                            </span>
                        );
                    }
                },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => handleAction('View Team Member', row)}
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
                            {((projectRole === 'manager' || projectRole === 'project_manager' || projectRole === 'team_lead') && row.id !== userId) && (
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
                                            width: '180px',
                                            zIndex: 50,
                                            overflow: 'hidden',
                                            padding: '4px'
                                        }}>
                                            <button
                                                onClick={() => { initiatHandover(row); setActiveMenuId(null); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
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

            data: teamMembers
        },
        status: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Department', accessor: 'dept' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],

            data: filterData([]).filter(item => item.name === userName)
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
                { header: 'Team Member', accessor: 'name' },
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
                { header: 'Applied On', accessor: 'appliedOn' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
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
                            {row.status === 'Pending' && (
                                <button
                                    onClick={() => handleDeleteLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fca5a5',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            )}
                        </div>
                    )
                },

            ],
            data: leaveRequests // Now we use the state directly which is already filtered by userId in fetch
        },
        payroll: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Month', accessor: 'month' },
                { header: 'Net Salary', accessor: 'salary' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                { header: 'Payslip', accessor: 'action', render: () => <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Download</span> }
            ],
            data: [].filter(item => item.name === userName)
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

    const config = configs[type] || configs.default;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '20px 24px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Decorative Mesh Grid */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    opacity: 0.5
                }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            <Calendar size={14} />
                            <span>Dashboard</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {title}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            {type === 'leaves' ? 'Manage your time off and track your leave allowance.' : `Management portal for your organizational ${title.toLowerCase()}`}
                        </p>
                    </div>

                    {type === 'leaves' && (
                        <button
                            onClick={() => handleAction('Apply for Leave')}
                            style={{
                                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                                color: 'white',
                                padding: '14px 28px',
                                borderRadius: '16px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(56, 189, 248, 0.4)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(56, 189, 248, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(56, 189, 248, 0.4)';
                            }}
                        >
                            <Plus size={22} />
                            Apply for Leave
                        </button>
                    )}
                </div>
            </div>

            {
                type === 'leaves' && (
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
                                Available Allowance
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{remainingLeaves}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                            </div>
                        </div>
                        <div style={{ position: 'absolute', right: '-20px', top: '-20px', zIndex: 0, opacity: 0.03 }}>
                            <Briefcase size={180} />
                        </div>
                    </div>
                )
            }

            {/* Render KanbanDemo for tasks, DataTable for others */}
            {
                type === 'tasks' ? (
                    <KanbanDemo />
                ) : (
                    <>
                        {/* ProjectDocuments removed from workforce view */}
                        <DataTable
                            title={`${title} List`}
                            columns={config.columns}
                            data={config.data}
                            onAction={handleAction}
                        />
                    </>
                )
            }

            {/* Apply Leave Modal - Redesigned */}
            {
                showApplyLeaveModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                        <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', padding: '40px', borderRadius: '32px', width: '650px', maxWidth: '95%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
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
                        </div>
                    </div>
                )
            }

            {/* Leave Confirmation Modal */}
            {showConfirmationModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', width: '600px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Confirm Leave Request</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                You have {pendingTasks.length} pending tasks. Please ensure you have planned your handover before proceeding.
                            </p>
                        </div>

                        {/* Pending Tasks List */}
                        <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={18} color="#64748b" /> Your Pending Tasks
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                {pendingTasks.length > 0 ? pendingTasks.map(task => (
                                    <div key={task.id} style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        backgroundColor: 'white',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1e293b' }}>{task.title}</div>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: task.priority === 'High' ? '#fee2e2' : '#f1f5f9',
                                                color: task.priority === 'High' ? '#ef4444' : '#64748b'
                                            }}>
                                                {task.priority || 'Medium'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: task.status === 'Completed' ? '#dcfce7' : '#e0f2fe',
                                                    color: task.status === 'Completed' ? '#166534' : '#0369a1',
                                                    fontWeight: 600,
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {task.status || 'Pending'}
                                                </span>
                                            </div>
                                            {task.due_date && (
                                                <span style={{ color: '#64748b' }}>
                                                    Due: <strong style={{ color: '#475569' }}>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '10px' }}>
                                        No pending tasks found.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setShowConfirmationModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: '700', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    submitLeaveRequest();
                                    setShowConfirmationModal(false);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                Agree & Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Details Modal (Read Only) */}
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
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Review the details and status of your leave request</p>
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
                                    const start = new Date(selectedLeaveRequest.startDate); // Ensure parsing
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
                                            color = '#64748b'; // slate-500
                                            bgColor = '#f1f5f9'; // slate-100
                                            borderColor = '#cbd5e1';
                                        } else {
                                            if (paidDaysLeft > 0) {
                                                status = 'Paid Leave';
                                                color = '#15803d'; // green-700
                                                bgColor = '#dcfce7'; // green-100
                                                borderColor = '#bbf7d0';
                                                paidDaysLeft--;
                                            } else {
                                                status = 'Loss of Pay';
                                                color = '#b91c1c'; // red-700
                                                bgColor = '#fee2e2'; // red-100
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

                        {/* Tasks During Leave */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Briefcase size={20} color="var(--primary)" /> Tasks During Leave Period
                                </h4>
                                {employeeTasks.length > 0 ? (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                                <tr>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Task</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Priority</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employeeTasks.map((task, index) => (
                                                    <tr key={task.id} style={{ borderTop: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '12px', fontSize: '0.875rem' }}>{task.title}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                backgroundColor: task.priority === 'High' ? '#fee2e2' :
                                                                    task.priority === 'Medium' ? '#fef3c7' : '#e0f2fe',
                                                                color: task.priority === 'High' ? '#991b1b' :
                                                                    task.priority === 'Medium' ? '#b45309' : '#075985'
                                                            }}>
                                                                {task.priority}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '32px',
                                        textAlign: 'center',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '12px',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        No tasks scheduled during this leave period
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



                        {/* Action Buttons - Close Only */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowLeaveDetailsModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    backgroundColor: '#f1f5f9',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
            {/* Employee Details Modal */}
            {
                showEmployeeModal && selectedEmployee && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            {/* Header */}
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Team Member Details</h3>
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
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.departmentName}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Project</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
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
                )
            }

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
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info (Simplified) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Email</p>
                                    <p style={{ fontWeight: 500 }}>{selectedCandidate.email}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Phone</p>
                                    <p style={{ fontWeight: 500 }}>{selectedCandidate.phone}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button
                                    onClick={() => setShowCandidateModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                            </div>
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
                            You are about to transfer your <strong>{projectRole === 'manager' ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.name}</strong>.
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
                            You are about to transfer your <strong>{(projectRole === 'manager' || projectRole === 'project_manager') ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.name}</strong>.
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
        </div>
    );
};

export default ModulePage;
