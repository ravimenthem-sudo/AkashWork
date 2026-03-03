import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Trash2, CheckCircle, Activity } from 'lucide-react';

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
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import TeamTasks from '../components/TeamTasks';
import PayslipsPage from '../../shared/PayslipsPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';


const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { currentTeam, userName, userId, teamId, orgId, userRole } = useUser();

    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [remainingLeaves, setRemainingLeaves] = useState(0);

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [evalBalance, setEvalBalance] = useState(0);
    const [evalPendingPaid, setEvalPendingPaid] = useState(0);

    // AI Leave Analysis state


    // State for team members
    const [teamMembers, setTeamMembers] = useState([]);

    // State for team status
    const [teamStatus, setTeamStatus] = useState([]);

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
    const [policyError, setPolicyError] = useState(null);


    const fetchLeaves = async () => {
        if (type !== 'leaves' || !orgId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch team members to get their leaves too
            const { data: assignments } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', teamId)
                .eq('org_id', orgId);

            const teamMemberIds = assignments?.map(a => a.user_id) || [];
            const allRelevantIds = Array.from(new Set([user.id, ...teamMemberIds]));

            // Fetch leaves for self AND team members
            const { data, error } = await supabase
                .from('leaves')
                .select('*, profiles:employee_id(full_name)')
                .in('employee_id', allRelevantIds)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedLeaves = data.map(leave => {
                    const start = new Date(leave.from_date);
                    const end = new Date(leave.to_date);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    let type = 'Leave';
                    let reason = leave.reason || '';
                    if (reason.includes(':')) {
                        type = reason.split(':')[0];
                    }

                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        employee_id: leave.employee_id,
                        name: leave.profiles?.full_name || (leave.employee_id === user.id ? userName : 'Unknown'),
                        type: type,
                        reason: leave.reason || 'No reason provided',
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                        duration_weekdays: leave.duration_weekdays, // Critical for approval calculation
                        lop_days: leave.lop_days, // Critical for approval calculation
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        created_at: leave.created_at
                    };
                });
                setLeaveRequests(mappedLeaves);
            }
        } catch (error) {
            console.error('Error fetching leaves:', error);
        }
    };

    // Fetch leaves and remaining leaves
    useEffect(() => {
        fetchLeaves();

        const fetchRemainingLeaves = async () => {
            if (type !== 'leaves') return;

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

        fetchRemainingLeaves();
    }, [userId, teamId, addToast, type, orgId]);

    // Fetch team members
    useEffect(() => {
        console.log('Team Members Effect - teamId:', teamId, 'type:', type);

        if (!teamId || type !== 'team_members') {
            console.log('Skipping fetch - teamId:', teamId, 'type:', type);
            return;
        }

        const fetchTeamMembers = async () => {
            try {
                console.log('Fetching team members for teamId:', teamId);

                // 1. Fetch team members from project_members table joined with profiles
                const { data: assignments, error: assignmentError } = await supabase
                    .from('project_members')
                    .select('*, profiles:user_id(id, full_name, role, email, phone, location, created_at, avatar_url)')
                    .eq('project_id', teamId)
                    .eq('org_id', orgId);

                console.log('Assignments fetched:', assignments, 'Error:', assignmentError);

                if (assignmentError) throw assignmentError;

                if (!assignments || assignments.length === 0) {
                    console.log('No members found for project:', teamId);
                    setTeamMembers([]);
                    return;
                }

                const profiles = assignments.map(a => a.profiles).filter(Boolean);

                // 2. Fetch team name separately (from projects table)
                let teamName = 'Unassigned';
                const { data: projectData } = await supabase
                    .from('projects')
                    .select('name')
                    .eq('id', teamId)
                    .eq('org_id', orgId)
                    .single();

                if (projectData) teamName = projectData.name;

                // 3. Fetch today's attendance for status (Check yesterday too for timezones)
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('employee_id, clock_in, clock_out, date')
                    .in('date', [yesterday, today])
                    .eq('org_id', orgId);

                const activeSet = new Set();
                if (attendance) {
                    const sortedAtt = [...attendance].sort((a, b) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.clock_in.localeCompare(b.clock_in);
                    });
                    sortedAtt.forEach(a => {
                        if (a.clock_in && !a.clock_out) {
                            activeSet.add(a.employee_id);
                        } else if (a.clock_out) {
                            activeSet.delete(a.employee_id);
                        }
                    });
                }

                // 4. Fetch today's leaves for status
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('employee_id')
                    .eq('status', 'approved')
                    .eq('org_id', orgId)
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

                    return {
                        id: member.id,
                        name: member.full_name || 'Unknown',
                        email: member.email || 'N/A',
                        role: member.role || 'N/A',
                        dept: teamName,
                        phone: member.phone || 'N/A',
                        location: member.location || 'N/A',
                        status: status,
                        joinDate: member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A',
                        avatar_url: member.avatar_url
                    };
                });

                console.log('Mapped members:', mappedMembers);
                setTeamMembers(mappedMembers);

            } catch (err) {
                console.error('Error fetching team members:', err);
                setTeamMembers([]);
            }
        };

        fetchTeamMembers();
    }, [teamId, type, orgId]);

    // Fetch team status
    useEffect(() => {
        console.log('🔍 Team Status Effect - teamId:', teamId, 'type:', type);

        if (!teamId || type !== 'status') {
            console.log('⏭️ Skipping team status fetch - teamId:', teamId, 'type:', type);
            return;
        }

        const fetchTeamStatus = async () => {
            try {
                console.log('📥 Fetching team status for teamId:', teamId);

                // Fetch team members from project_members table
                // Explicitly select profile fields to avoid potential issues with dropped columns
                const { data: assignments, error: assignmentError } = await supabase
                    .from('project_members')
                    .select('*, profiles:user_id(id, full_name, email, role, avatar_url)')
                    .eq('project_id', teamId)
                    .eq('org_id', orgId);

                if (assignmentError) throw assignmentError;

                const profiles = assignments.map(a => a.profiles).filter(Boolean);

                console.log('👥 Profiles fetched:', profiles);

                if (!profiles || profiles.length === 0) {
                    console.log('⚠️ No profiles found for teamId:', teamId);
                    setTeamStatus([]);
                    return;
                }

                // Fetch team name (from Projects table)
                let teamName = 'Unassigned';
                const { data: projectData } = await supabase
                    .from('projects')
                    .select('name')
                    .eq('id', teamId)
                    .eq('org_id', orgId)
                    .single();

                if (projectData) teamName = projectData.name;

                const today = new Date().toISOString().split('T')[0];
                console.log('📅 Fetching attendance for date:', today);

                // Try to fetch records for range to debug
                let attendance = [];
                const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const { data: allAttendance, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('*')
                    .in('date', [yesterday, today])
                    .eq('org_id', orgId);

                console.log('⏰ ALL Attendance data fetched:', allAttendance);

                if (attendanceError) {
                    console.error('❌ Attendance error:', attendanceError);
                    console.error('❌ Error details:', JSON.stringify(attendanceError, null, 2));
                    console.error('❌ Error message:', attendanceError.message);
                    console.error('❌ Error code:', attendanceError.code);
                } else {
                    console.log('✅ Attendance fetched successfully, total records:', allAttendance?.length);
                    // Filter by today's date in JavaScript
                    attendance = allAttendance?.filter(a => a.date === today) || [];
                    console.log('⏰ Today\'s attendance (filtered):', attendance);
                    console.log('⏰ Today\'s attendance count:', attendance.length);
                }

                const attendanceMap = {};
                if (attendance && attendance.length > 0) {
                    attendance.forEach(a => {
                        console.log(`  📝 Mapping attendance for employee ${a.employee_id}:`, {
                            clock_in: a.clock_in,
                            clock_out: a.clock_out,
                            date: a.date
                        });
                        attendanceMap[a.employee_id] = a;
                    });
                }

                console.log('🗺️ Attendance Map:', attendanceMap);
                console.log('🗺️ Attendance Map keys:', Object.keys(attendanceMap));

                // Fetch today's leaves
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('employee_id')
                    .eq('status', 'approved')
                    .eq('org_id', orgId)
                    .lte('from_date', today)
                    .gte('to_date', today);

                const leaveSet = new Set(leaves?.map(l => l.employee_id));
                console.log('🏖️ Leave Set:', Array.from(leaveSet));

                const mappedStatus = profiles.map(member => {
                    let availability = 'Offline';
                    let lastActive = 'N/A';
                    let currentTask = 'No active task';

                    const att = attendanceMap[member.id];

                    console.log(`👤 Processing ${member.full_name}:`, {
                        id: member.id,
                        hasAttendance: !!att,
                        attendance: att,
                        isOnLeave: leaveSet.has(member.id)
                    });

                    if (leaveSet.has(member.id)) {
                        availability = 'On Leave';
                        console.log(`  ✅ ${member.full_name} is On Leave`);
                    } else if (att && att.clock_in && !att.clock_out) {
                        availability = 'Online';
                        lastActive = 'Active now';
                        currentTask = att.current_task || 'No active task';
                        console.log(`  ✅ ${member.full_name} is Online (clocked in at ${att.clock_in})`);
                    } else if (att && att.clock_out) {
                        availability = 'Offline';
                        lastActive = `Left at ${att.clock_out.slice(0, 5)}`;
                        console.log(`  ✅ ${member.full_name} is Offline (clocked out at ${att.clock_out})`);
                    } else if (att && att.updated_at) {
                        lastActive = new Date(att.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        console.log(`  ✅ ${member.full_name} is Offline (last active: ${lastActive})`);
                    } else {
                        console.log(`  ✅ ${member.full_name} is Offline (no attendance record)`);
                    }

                    return {
                        id: member.id,
                        name: member.full_name || 'Unknown',
                        dept: teamName,
                        availability: availability,
                        task: currentTask,
                        lastActive: lastActive,
                        avatar_url: member.avatar_url
                    };
                });

                console.log('📊 Final Team Status:', mappedStatus);
                setTeamStatus(mappedStatus);

            } catch (err) {
                console.error('❌ Error fetching team status:', err);
                setTeamStatus([]);
            }
        };

        fetchTeamStatus();
    }, [teamId, type, orgId]);

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
    }, [type, orgId]);


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

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    const fetchPendingTasks = async (employeeId) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .not('status', 'in', '("completed","closed")')
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
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
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

        // Fetch pending tasks for the approver (Current Team Lead)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const pTasks = await fetchPendingTasks(user.id);
            setPendingTasks(pTasks);
        }

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

    // Helper to check if leave was created within the last 12 hours
    const isWithin12Hours = (createdAt) => {
        if (!createdAt) return false;
        const createdTime = new Date(createdAt).getTime();
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        return (now - createdTime) < twelveHoursMs;
    };

    // Delete leave handler with balance refund
    const handleDeleteLeave = async (leaveRequest) => {
        if (!window.confirm('Are you sure you want to delete this leave request?')) {
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                addToast('User not found', 'error');
                return;
            }

            // Calculate duration for refund
            const start = new Date(leaveRequest.startDate);
            const end = new Date(leaveRequest.endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Check if it was NOT Loss of Pay
            const isLossOfPay = leaveRequest.type === 'Loss of Pay';

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

    const handleAction = (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            openApplyLeaveModal();
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';
            const dbStatus = action === 'Approve' ? 'approved' : 'rejected';

            // Optimistic Update
            setLeaveRequests(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: newStatus }
                        : request
                )
            );

            // DB Update
            const updateDb = async () => {
                try {
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

                    // Update leave request status and final split
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
                            sender_name: 'Team Lead',
                            message: notificationMessage,
                            type: 'leave_status',
                            is_read: false,
                            created_at: new Date().toISOString()
                        });
                    }

                    addToast(`Leave request ${action.toLowerCase()}d`, 'success');
                    fetchLeaves(); // Refresh list to show updated split
                } catch (error) {
                    console.error('Error updating leave:', error);
                    addToast('Failed to update leave', 'error');
                }
            };
            updateDb();
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

    const openApplyLeaveModal = async () => {
        try {
            // Fetch pending tasks for the applier (Current Team Lead)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tasks = await fetchPendingTasks(user.id);
                setPendingTasks(tasks);
            }

            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setSelectedDates([]);
            setDateToAdd('');
            setShowApplyLeaveModal(true);
        } catch (error) {
            console.error('Error opening apply leave modal:', error);
            setShowApplyLeaveModal(true);
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            addToast('User not found', 'error');
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

        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const requestedDays = useSpecificDates ? datesToApply.length : diffDays;

        try {
            const leaveReason = `${leaveFormData.leaveType}: ${leaveFormData.reason}` +
                (useSpecificDates ? ` (Dates: ${datesToApply.join(', ')})` : '');


            // Insert leave request(s)
            // Calculate initial Paid/LOP split for application record
            // This is just an estimate; final split happens on approval
            const { data: profile } = await supabase
                .from('profiles')
                .select('total_leaves_balance')
                .eq('id', user.id)
                .single();

            const { data: pendingLeaves } = await supabase
                .from('leaves')
                .select('duration_weekdays')
                .eq('employee_id', user.id)
                .eq('status', 'pending');

            const pendingPaid = pendingLeaves?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0;
            const effectiveBalance = Math.max(0, (profile?.total_leaves_balance || 0) - pendingPaid);

            const leaveRows = useSpecificDates
                ? datesToApply.map((date, idx) => {
                    const isPaid = idx < effectiveBalance;
                    return {
                        employee_id: user.id,
                        org_id: orgId,
                        team_id: teamId,
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
                        employee_id: user.id,
                        org_id: orgId,
                        team_id: teamId,
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

            // Balance deduction and profile update deferred to APPROVAL stage
            // Refresh list
            fetchLeaves();
            fetchRemainingLeaves();

        } catch (error) {
            console.error('Error applying leave:', JSON.stringify(error, null, 2));
            addToast('Failed to apply: ' + error.message, 'error');
        }
    };

    // Render specific demos for certain types
    if (type === 'team_tasks') return <TeamTasks orgId={orgId} />;
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <TaskLifecyclePage userRole={userRole} userId={userId} addToast={addToast} teamId={teamId} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;

    // Helper to filter data by team
    const filterData = (data) => {
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
                { header: 'Department', accessor: 'dept' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.status === 'Active' ? '#dcfce7' : '#fee2e2',
                            color: row.status === 'Active' ? '#166534' : '#991b1b'
                        }}>
                            {row.status}
                        </span>
                    )
                },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
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
                    )
                },
            ],

            data: filterData([])
        },
        team_members: {
            columns: [
                {
                    header: 'Team Member Name', accessor: 'name', render: (row) => (
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

            data: teamStatus
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
            data: leaveRequests
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
        // leave team_tasks config removed as it uses custom component now
        // Default fallback for other modules
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
                            <span>Team Lead</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {title}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            {type === 'leaves' ? 'Manage your personal leave requests and track available balance.' :
                                `Management portal for organizational ${title.toLowerCase()}`}
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

            {/* Remaining Leaves Card */}
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
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{remainingLeaves}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                        </div>
                    </div>
                </div>
            )}

            <DataTable
                title={`${title} List`}
                columns={config.columns}
                data={config.data}
                onAction={handleAction}
            />

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
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Teamlead</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.teamlead || 'N/A'}</p>
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
            )}
            {showCandidateModal && /* existing candidate modal code would be here but simplified for this tool call */ null}

            {/* Leave Details Modal */}
            {showLeaveDetailsModal && selectedLeaveRequest && (
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
                        {selectedLeaveRequest.employee_id !== userId && selectedLeaveRequest.status === 'Pending' && (
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
                                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Current Balance</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalBalance} Days</div>
                                    </div>
                                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Other Pending (Paid)</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalPendingPaid} Days</div>
                                    </div>
                                    <div style={{
                                        backgroundColor: '#0369a1',
                                        padding: '16px',
                                        borderRadius: '14px',
                                        color: 'white',
                                        gridColumn: 'span 1'
                                    }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '8px' }}>Effective Balance</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{Math.max(0, evalBalance - evalPendingPaid)} Days</div>
                                    </div>
                                </div>

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

                        {/* Tasks Section for Approver View */}
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
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: task.priority === 'High' ? '#ef4444' : 'var(--primary)', textTransform: 'uppercase' }}>{task.priority || 'Medium'}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ padding: '20px', textAlign: 'center', borderRadius: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No pending tasks!</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Approver Responsibilities */}
                        {selectedLeaveRequest.employee_id !== userId && (
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
                        )}

                        {/* Footer */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={() => setShowLeaveDetailsModal(false)}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                            >
                                Close Details
                            </button>
                            {selectedLeaveRequest.employee_id !== userId && selectedLeaveRequest.status === 'Pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            handleAction('Reject', selectedLeaveRequest);
                                            setShowLeaveDetailsModal(false);
                                        }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}
                                    >
                                        Reject Request
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleAction('Approve', selectedLeaveRequest);
                                            setShowLeaveDetailsModal(false);
                                        }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, border: 'none', backgroundColor: 'var(--success)', color: 'white', cursor: 'pointer' }}
                                    >
                                        Approve Request
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModulePage;
