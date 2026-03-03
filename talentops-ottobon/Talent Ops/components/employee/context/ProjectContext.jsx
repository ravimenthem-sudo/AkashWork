import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ProjectContext = createContext(null);

// Default values to prevent destructuring errors
const defaultContextValue = {
    currentProject: null,
    setCurrentProject: () => { },
    userProjects: [],
    projectRole: null,
    loading: true,
    hasMultipleProjects: false
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    return context || defaultContextValue;
};

export const ProjectProvider = ({ children }) => {
    const [currentProject, setCurrentProject] = useState(null);
    const [userProjects, setUserProjects] = useState([]);
    const [projectRole, setProjectRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUserProjects = React.useCallback(async () => {
        // Don't set loading to true here to avoid UI flicker during background refresh
        // unless it is the initial load (which is handled by initial state)

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // Single optimized query with join
            const { data: memberships, error } = await supabase
                .from('project_members')
                .select('id, role, project_id, projects(id, name, status)')
                .eq('user_id', user.id);

            if (error || !memberships) {
                console.error('Error fetching projects:', error);
                setLoading(false);
                return;
            }

            // Map to simplified project objects
            const projects = memberships
                .filter(m => m.projects)
                .map(m => ({
                    id: m.projects.id,
                    name: m.projects.name,
                    status: m.projects.status || 'active',
                    role: m.role,
                    membershipId: m.id
                }));

            setUserProjects(projects);

            // Update current project reference if it exists
            if (projects.length > 0) {
                setCurrentProject(prev => {
                    if (!prev) return projects[0];
                    const found = projects.find(p => p.id === prev.id);
                    return found || projects[0];
                });

                // Update role for current project
                setProjectRole(prevRole => {
                    // Logic to find the role of the current project in the new list
                    // Since we can't easily access the *current* currentProject state inside this callback 
                    // without adding it to dependency (causing loop), we rely on a side effect or 
                    // trust the consumers to handle switch, 
                    // BUT for handover we need immediate update.

                    // Let's try to sync it with the state update above.
                    // Actually, we can use a separate useEffect to sync projectRole with currentProject
                    return prevRole;
                });
            } else {
                setCurrentProject(null);
                setProjectRole(null);
            }

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    }, []);

    // Effect to sync projectRole whenever currentProject changes (or userProjects updates it)
    useEffect(() => {
        if (currentProject && userProjects.length > 0) {
            const found = userProjects.find(p => p.id === currentProject.id);
            if (found) {
                if (found.role !== projectRole) {
                    setProjectRole(found.role);
                }
                // Also update currentProject object if details changed (like role inside it)
                if (found.role !== currentProject.role) {
                    setCurrentProject(found);
                }
            }
        } else if (userProjects.length > 0 && !currentProject) {
            // Initial set
            setCurrentProject(userProjects[0]);
            setProjectRole(userProjects[0].role);
        }
    }, [userProjects, currentProject, projectRole]);


    // Initial Fetch
    useEffect(() => {
        fetchUserProjects();
    }, [fetchUserProjects]);

    // Memoize switch function
    const switchProject = useMemo(() => (projectId) => {
        const project = userProjects.find(p => p.id === projectId);
        if (project) {
            setCurrentProject(project);
            setProjectRole(project.role);
        }
    }, [userProjects]);

    // Memoize context value
    const contextValue = useMemo(() => ({
        currentProject,
        setCurrentProject: switchProject,
        userProjects,
        projectRole,
        loading,
        hasMultipleProjects: userProjects.length > 1,
        refreshProjects: fetchUserProjects
    }), [currentProject, switchProject, userProjects, projectRole, loading, fetchUserProjects]);

    return (
        <ProjectContext.Provider value={contextValue}>
            {children}
        </ProjectContext.Provider>
    );
};
