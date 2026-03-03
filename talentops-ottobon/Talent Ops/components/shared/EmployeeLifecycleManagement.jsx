import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, TrendingUp, History, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

const STAGES = ['Intern', 'FullTime_IC', 'Senior_IC', 'TeamLead', 'Manager', 'HR', 'Exited'];
const TRACKS = ['Engineering', 'Management', 'HR', 'Operations', 'Sales'];

export const EmployeeLifecycleManagement = ({ currentUser }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [history, setHistory] = useState([]);
    const [showPromoteModal, setShowPromoteModal] = useState(false);

    // Promotion Form State
    const [newStage, setNewStage] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (employeeId) => {
        try {
            const { data, error } = await supabase
                .from('employee_stage_history')
                .select('*, approver:approved_by(full_name)')
                .eq('employee_id', employeeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleEmployeeSelect = (employee) => {
        setSelectedEmployee(employee);
        setNewStage(employee.employee_stage || 'Intern');
        fetchHistory(employee.id);
    };

    const handleStageUpdate = async () => {
        if (!newStage || !reason) return;
        setSubmitting(true);

        try {
            const { error } = await supabase.rpc('update_employee_stage', {
                p_employee_id: selectedEmployee.id,
                p_new_stage: newStage,
                p_reason: reason,
                p_approved_by: currentUser?.id
            });

            if (error) throw error;

            // Update local state
            setEmployees(prev => prev.map(emp =>
                emp.id === selectedEmployee.id ? { ...emp, employee_stage: newStage } : emp
            ));

            // Refresh history
            fetchHistory(selectedEmployee.id);
            setShowPromoteModal(false);
            setReason('');

            alert('Employee stage updated successfully!');
        } catch (error) {
            console.error('Error updating stage:', error);
            alert('Failed to update stage: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading employees...</div>;

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Employee Lifecycle Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage career stages and functional tracks</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Employee List */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Users size={18} /> Employees
                        </h2>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2">
                        {employees.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => handleEmployeeSelect(emp)}
                                className={`p-3 rounded-lg cursor-pointer mb-2 transition-all ${selectedEmployee?.id === emp.id
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent'
                                    }`}
                            >
                                <div className="font-medium text-slate-800 dark:text-slate-200">{emp.full_name || 'Unnamed'}</div>
                                <div className="text-xs flex gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                        {emp.functional_track || 'No Track'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded ${emp.employee_stage === 'Exited' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                        }`}>
                                        {emp.employee_stage || 'Intern'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details & History */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {selectedEmployee ? (
                        <>
                            {/* Actions Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{selectedEmployee.full_name}</h2>
                                        <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">{selectedEmployee.email}</div>
                                    </div>
                                    <button
                                        onClick={() => setShowPromoteModal(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
                                    >
                                        <TrendingUp size={18} /> Change Stage
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div className="text-xs uppercase font-semibold text-slate-400 mb-1">Current Stage</div>
                                        <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{selectedEmployee.employee_stage || 'Intern'}</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div className="text-xs uppercase font-semibold text-slate-400 mb-1">Functional Track</div>
                                        <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{selectedEmployee.functional_track || 'Engineering'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* History Timeline */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex-1">
                                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
                                    <History size={18} /> Career History
                                </h3>

                                {history.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">No history recorded yet.</div>
                                ) : (
                                    <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-700 space-y-8">
                                        {history.map((record, idx) => (
                                            <div key={record.id} className="relative">
                                                <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-800" />
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-xs text-slate-400">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                        {record.from_stage || 'Start'} <ArrowRight size={14} className="text-slate-400" /> {record.to_stage}
                                                    </div>
                                                    {record.reason && (
                                                        <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded mt-1 border border-slate-100 dark:border-slate-700">
                                                            "{record.reason}"
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        Approved by: {record.approver?.full_name || 'System'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            Select an employee to view details
                        </div>
                    )}
                </div>
            </div>

            {/* Promotion Modal */}
            {showPromoteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Update Career Stage</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Stage</label>
                                <select
                                    value={newStage}
                                    onChange={(e) => setNewStage(e.target.value)}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {STAGES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason for Change</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Annual promotion, Performance review..."
                                    className="w-full p-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setShowPromoteModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStageUpdate}
                                    disabled={submitting || !reason}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Updating...' : 'Confirm Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
