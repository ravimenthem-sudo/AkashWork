import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import DashboardHome from './pages/DashboardHome';
import ModulePage from './pages/ModulePage';
import NotificationsPage from '../shared/NotificationsPage';
import MessagingHub from '../shared/MessagingHub';
import ExecutiveAllTasksPage from './pages/ExecutiveAllTasksPage';
import { ToastProvider } from './context/ToastContext';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/executive-dashboard/dashboard" replace />} />
              <Route path="/executive-dashboard/dashboard" element={<DashboardHome />} />
              <Route path="/executive-dashboard/analytics" element={<ModulePage title="Analytics" type="analytics" />} />
              <Route path="/executive-dashboard/employees" element={<ModulePage title="Employees" type="workforce" />} />
              <Route path="/executive-dashboard/tasks" element={<ExecutiveAllTasksPage />} />
              <Route path="/executive-dashboard/leaves/employee-info" element={<ModulePage title="Employee Leave Information" type="employee-leave-info" />} />
              <Route path="/executive-dashboard/leaves" element={<ModulePage title="Leave Requests" type="leaves" />} />
              <Route path="/executive-dashboard/employee-status" element={<ModulePage title="Employee Status" type="status" />} />
              <Route path="/executive-dashboard/payslips" element={<ModulePage title="Payslips" type="payroll" />} />
              <Route path="/executive-dashboard/hiring" element={<ModulePage title="Hiring Portal" type="recruitment" />} />
              <Route path="/executive-dashboard/messages" element={<MessagingHub />} />
              <Route path="/executive-dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/executive-dashboard/hierarchy" element={<ModulePage title="Organizational Hierarchy" type="default" />} />
              <Route path="/executive-dashboard/audit" element={<ModulePage title="Audit Logs" type="default" />} />
              <Route path="/executive-dashboard/settings" element={<ModulePage title="Settings" type="default" />} />
              <Route path="/executive-dashboard/project-analytics" element={<ModulePage title="Project Analytics" type="project-analytics" />} />
            </Routes>
          </Layout>
        </Router>
      </ToastProvider>
    </UserProvider>
  );
}

export default App;
