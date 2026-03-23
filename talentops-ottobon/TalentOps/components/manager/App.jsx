import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import DashboardHome from './pages/DashboardHome';
import ModulePage from './pages/ModulePage';
import MyLeavesPage from './pages/MyLeavesPage';
import NotificationsPage from '../shared/NotificationsPage';
import MessagingHub from '../shared/MessagingHub';
import ManagerTasks from './components/Tasks/ManagerTasks';
import ManagerAllTasksPage from './pages/ManagerAllTasksPage';
import { ToastProvider } from './context/ToastContext';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardHome />} />
              <Route path="/analytics" element={<ModulePage title="Analytics" type="analytics" />} />
              <Route path="/employees" element={<ModulePage title="Employees" type="workforce" />} />
              <Route path="/project-members" element={<ModulePage title="Project Team Members" type="project-members" />} />
              <Route path="/tasks" element={<ManagerAllTasksPage />} />
              <Route path="/leaves/employee-info" element={<ModulePage title="Employee Leave Information" type="employee-leave-info" />} />
              <Route path="/leaves" element={<ModulePage title="Leave Requests" type="leaves" />} />
              <Route path="/my-leaves" element={<MyLeavesPage />} />
              <Route path="/employee-status" element={<ModulePage title="Employee Status" type="status" />} />
              <Route path="/payslips" element={<ModulePage title="Payslips" type="payroll" />} />
              <Route path="/hiring" element={<ModulePage title="Hiring Portal" type="recruitment" />} />
              <Route path="/messages" element={<MessagingHub />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/hierarchy" element={<ModulePage title="Team Hierarchy" type="default" />} />
              <Route path="/audit" element={<ModulePage title="Audit Logs" type="default" />} />
              <Route path="/settings" element={<ModulePage title="Settings" type="default" />} />
            </Routes>
          </Layout>
        </Router>
      </ToastProvider>
    </UserProvider>
  );
}

export default App;
