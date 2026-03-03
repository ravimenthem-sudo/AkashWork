import React from 'react';
import { useProject } from '../context/ProjectContext';
import AllTasksView from '../../shared/AllTasksView';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';

/**
 * Wrapper component for AllTasksView that uses the project role
 * to determine what tasks to show and what permissions the user has
 */
const TeamTasksPage = () => {
    const { projectRole } = useProject();
    const { addToast } = useToast();
    const { userId, orgId } = useUser();

    // Map project roles to the userRole expected by AllTasksView
    // manager and team_lead see all team tasks
    // regular employees see only their tasks
    const userRole = (projectRole === 'manager' || projectRole === 'team_lead')
        ? projectRole
        : 'employee';

    return (
        <AllTasksView
            userRole={userRole}
            projectRole={projectRole}  // Pass projectRole for validation permissions
            userId={userId}
            orgId={orgId}
            addToast={addToast}
        />
    );
};

export default TeamTasksPage;
