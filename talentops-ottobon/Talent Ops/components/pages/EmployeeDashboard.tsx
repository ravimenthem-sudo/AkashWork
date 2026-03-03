import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// @ts-ignore
import Layout from '../employee/components/Layout/Layout';
// @ts-ignore
import DashboardHome from '../employee/pages/DashboardHome';
// @ts-ignore
import ModulePage from '../employee/pages/ModulePage';
// @ts-ignore
import OrgHierarchy from '../employee/pages/OrgHierarchy';
// @ts-ignore
import MessagingHub from '../shared/MessagingHub';
// @ts-ignore
import RaiseTicketPage from '../shared/pages/RaiseTicketPage';
// @ts-ignore
import { ToastProvider } from '../employee/context/ToastContext';
// @ts-ignore
import { UserProvider } from '../employee/context/UserContext';
// @ts-ignore
import { ProjectProvider } from '../employee/context/ProjectContext';
// @ts-ignore
import MyTasksPage from '../employee/pages/MyTasksPage';
// @ts-ignore
import TeamTasksPage from '../employee/pages/TeamTasksPage';
// @ts-ignore
import TeamPerformance from '../performance/TeamPerformanceAnalytics';
// @ts-ignore
import EmployeeReviewPage from '../performance/EmployeeReviewPage';
import RoleGuard from '../shared/RoleGuard';
import '../employee/index.css';

export const EmployeeDashboard = () => {
    return (
        <RoleGuard allowedRoles={['employee']}>
            <UserProvider>
                <ProjectProvider>
                    <ToastProvider>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<DashboardHome />} />
                                <Route path="analytics" element={<ModulePage title="My Analytics" type="analytics" />} />
                                <Route path="employees" element={<ModulePage title="Project Documents" type="project-documents" />} />
                                {/* Real Task Routes */}
                                <Route path="my-tasks" element={<MyTasksPage />} />
                                <Route path="team-tasks" element={<TeamTasksPage />} />

                                <Route path="team-members" element={<ModulePage title="Team Members" type="workforce" />} />

                                <Route path="leaves" element={<ModulePage title="Leave Requests" type="leaves" />} />
                                <Route path="team-status" element={<ModulePage title="Your Status" type="status" />} />
                                <Route path="payslips" element={<ModulePage title="Your Payslip" type="payroll" />} />
                                <Route path="policies" element={<ModulePage title="Policies" type="policies" />} />
                                <Route path="hierarchy" element={<ModulePage title="Organizational Hierarchy" type="default" />} />
                                <Route path="org-hierarchy" element={<OrgHierarchy />} />
                                <Route path="project-hierarchy" element={<ModulePage title="Project Hierarchy" type="default" />} />
                                <Route path="messages" element={<MessagingHub />} />
                                <Route path="announcements" element={<ModulePage title="Announcements" type="default" />} />
                                <Route path="raise-ticket" element={<RaiseTicketPage />} />
                                <Route path="settings" element={<ModulePage title="Settings" type="default" />} />
                                { /* Role-specific routes for Team Lead and Manager */}
                                <Route path="approve-leaves" element={<ModulePage title="Approve Leaves" type="leaves" />} />
                                <Route path="manage-members" element={<ModulePage title="Manage Members" type="workforce" />} />
                                <Route path="performance" element={<TeamPerformance />} />
                                <Route path="review" element={<EmployeeReviewPage />} />
                            </Routes>
                        </Layout>
                    </ToastProvider>
                </ProjectProvider>
            </UserProvider>
        </RoleGuard>
    );
};
