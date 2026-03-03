import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// @ts-ignore
import Layout from '../teamlead/components/Layout/Layout';
// @ts-ignore
import DashboardHome from '../teamlead/pages/DashboardHome';
// @ts-ignore
import ModulePage from '../teamlead/pages/ModulePage';
// @ts-ignore
import MessagingHub from '../shared/MessagingHub';
// @ts-ignore
import { ToastProvider } from '../teamlead/context/ToastContext';
// @ts-ignore
import { UserProvider } from '../teamlead/context/UserContext';
// @ts-ignore
import RaiseTicketPage from '../shared/pages/RaiseTicketPage';
// @ts-ignore
import ManagerReviewPage from '../performance/ManagerReviewPage';
// @ts-ignore
import FullRankingPage from '../performance/FullRankingPage';
import RoleGuard from '../shared/RoleGuard';
import '../teamlead/index.css';

export const TeamLeadDashboard = () => {
    return (
        <RoleGuard allowedRoles={['team_lead']}>
            <UserProvider>
                <ToastProvider>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<Navigate to="dashboard" replace />} />
                            <Route path="dashboard" element={<DashboardHome />} />
                            <Route path="analytics" element={<ModulePage title="Analytics" type="analytics" />} />
                            <Route path="employees" element={<ModulePage title="Team Members" type="team_members" />} />
                            <Route path="tasks" element={<ModulePage title="Task Teamlead" type="tasks" />} />
                            <Route path="team-tasks" element={<ModulePage title="Team Tasks" type="team_tasks" />} />
                            <Route path="leaves" element={<ModulePage title="Leave Requests" type="leaves" />} />
                            <Route path="team-status" element={<ModulePage title="Team Status" type="status" />} />
                            <Route path="payslips" element={<ModulePage title="Payslips" type="payroll" />} />
                            <Route path="policies" element={<ModulePage title="Policies" type="policies" />} />
                            <Route path="hierarchy" element={<ModulePage title="Organizational Hierarchy" type="default" />} />
                            <Route path="project-hierarchy" element={<ModulePage title="Project Hierarchy" type="default" />} />
                            <Route path="messages" element={<MessagingHub />} />
                            <Route path="announcements" element={<ModulePage title="Announcements" type="default" />} />
                            <Route path="raise-ticket" element={<RaiseTicketPage />} />
                            <Route path="team-reviews" element={<ManagerReviewPage />} />
                            <Route path="rankings" element={<FullRankingPage />} />
                            <Route path="settings" element={<ModulePage title="Settings" type="default" />} />
                        </Routes>
                    </Layout>
                </ToastProvider>
            </UserProvider>
        </RoleGuard>
    );
};
