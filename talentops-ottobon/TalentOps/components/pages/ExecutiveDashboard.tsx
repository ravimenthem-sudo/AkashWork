import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// @ts-ignore
import Layout from '../executive/components/Layout/Layout';
// @ts-ignore
import DashboardHome from '../executive/pages/DashboardHome';
// @ts-ignore
import ModulePage from '../executive/pages/ModulePage';
// @ts-ignore
import MessagingHub from '../shared/MessagingHub';
// @ts-ignore
import { ToastProvider, useToast } from '../executive/context/ToastContext';
// @ts-ignore
import { UserProvider } from '../executive/context/UserContext';

// @ts-ignore
import { ATSDataProvider } from '../executive/context/ATSDataContext';
// @ts-ignore
import HiringPortal from '../executive/pages/HiringPortal/HiringPortal';
// @ts-ignore
import ProjectManagement from '../executive/pages/ProjectManagement';
// @ts-ignore
import ProjectDocuments from '../employee/pages/ProjectDocuments';
// @ts-ignore
import RaiseTicketPage from '../shared/pages/RaiseTicketPage';
// @ts-ignore
import ExecutiveAllTasksPage from '../executive/pages/ExecutiveAllTasksPage';
// @ts-ignore
import ExecutiveReviewPage from '../performance/ExecutiveReviewPage';
// @ts-ignore
import FullRankingPage from '../performance/FullRankingPage';
import { EmployeeLifecycleManagement } from '../shared/EmployeeLifecycleManagement';
import RoleGuard from '../shared/RoleGuard';
// @ts-ignore
import AttendanceLogsPage from '../shared/AttendanceLogsPage';
import '../executive/index.css';

// Wrapper to provide toast context from executive provider to employee component
const DocumentsWithToast = () => {
    const { addToast } = useToast();
    return <ProjectDocuments userRole="executive" addToast={addToast} />;
};

export const ExecutiveDashboard = () => {
    return (
        <RoleGuard allowedRoles={['executive', 'admin']}>
            <UserProvider>
                <ToastProvider>
                    <ATSDataProvider>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<DashboardHome />} />
                                <Route path="analytics" element={<ModulePage title="Analytics" type="analytics" />} />
                                <Route path="projects" element={<ProjectManagement />} />
                                <Route path="employees" element={<ModulePage title="Employees" type="workforce" />} />
                                <Route path="tasks" element={<ExecutiveAllTasksPage />} />
                                <Route path="leaves" element={<ModulePage title="Leave Requests" type="leaves" />} />
                                <Route path="leaves/employee-info" element={<ModulePage title="Employee Leave Information" type="employee-leave-info" />} />
                                <Route path="employee-status" element={<ModulePage title="Employee Status" type="status" />} />
                                <Route path="attendance-logs" element={<AttendanceLogsPage />} />
                                <Route path="payslips" element={<ModulePage title="Payslips" type="payroll" />} />
                                <Route path="policies" element={<ModulePage title="Policies" type="policies" />} />
                                <Route path="payroll" element={<ModulePage title="Payroll" type="payroll-generation" />} />
                                <Route path="invoice" element={<ModulePage title="Invoice" type="invoice" />} />
                                <Route path="messages" element={<MessagingHub />} />
                                <Route path="hiring" element={<HiringPortal />} />
                                <Route path="hierarchy" element={<ModulePage title="Organizational Hierarchy" type="default" />} />
                                <Route path="lifecycle" element={<EmployeeLifecycleManagement currentUser={{ id: 'current-user-placeholder' }} />} />
                                <Route path="project-hierarchy" element={<ModulePage title="Project Hierarchy" type="default" />} />
                                <Route path="announcements" element={<ModulePage title="Announcements" type="default" />} />
                                <Route path="raise-ticket" element={<RaiseTicketPage />} />
                                <Route path="settings" element={<ModulePage title="Settings" type="default" />} />
                                <Route path="project-analytics" element={<ModulePage title="Project Analytics" type="project-analytics" />} />
                                <Route path="documents" element={<DocumentsWithToast />} />
                                <Route path="executive-reviews" element={<ExecutiveReviewPage />} />
                                <Route path="rankings" element={<FullRankingPage />} />
                            </Routes>
                        </Layout>
                    </ATSDataProvider>
                </ToastProvider>
            </UserProvider>
        </RoleGuard>
    );
};
