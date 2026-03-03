import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from './components/pages/LoginPage';
import { LandingPage } from './components/pages/LandingPage';
import { ExecutiveDashboard } from './components/pages/ExecutiveDashboard';
import { ManagerDashboard } from './components/pages/ManagerDashboard';
import { TeamLeadDashboard } from './components/pages/TeamLeadDashboard';
import { EmployeeDashboard } from './components/pages/EmployeeDashboard';
import { ForgotPasswordPage } from './components/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './components/pages/ResetPasswordPage';
// @ts-ignore
import FullRankingPage from './components/performance/FullRankingPage';
// @ts-ignore
import { ThemeProvider } from './components/shared/context/ThemeContext';
import { supabase } from './lib/supabaseClient';

function App() {
    useEffect(() => {
        const checkConnection = async () => {
            console.log('=== Supabase Connection Check ===');
            console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
            console.log('Key (first 20 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20));

            // Check session
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('❌ Supabase session error:', sessionError);
            } else {
                console.log('✅ Supabase connected successfully. Session:', sessionData);
            }

            // Test profiles table access
            try {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .limit(5);

                if (profilesError) {
                    console.error('❌ Error accessing profiles table:', profilesError);
                } else {
                    console.log('✅ Profiles table accessible. Sample data:', profilesData);
                    console.log(`Found ${profilesData?.length || 0} profiles`);
                }
            } catch (err) {
                console.error('❌ Unexpected error testing profiles:', err);
            }

            console.log('=== End Connection Check ===');
        };

        checkConnection();
    }, []);

    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />

                {/* Wrap application routes with ThemeProvider */}
                <Route element={<ThemeProvider><Outlet /></ThemeProvider>}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/executive-dashboard/*" element={<ExecutiveDashboard />} />
                    <Route path="/manager-dashboard/*" element={<ManagerDashboard />} />
                    <Route path="/teamlead-dashboard/*" element={<TeamLeadDashboard />} />
                    <Route path="/employee-dashboard/*" element={<EmployeeDashboard />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
