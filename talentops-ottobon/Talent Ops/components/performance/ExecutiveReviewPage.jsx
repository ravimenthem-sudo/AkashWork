import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    Search,
    ChevronRight,
    Star,
    CheckCircle2,
    Clock,
    AlertCircle,
    Brain,
    Heart,
    Save,
    Loader2,
    User,
    Users,
    MessageSquare,
    Building2
} from 'lucide-react';
import { motion } from 'framer-motion';

const ExecutiveReviewsPage = () => {
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, reviewed
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [executiveRemarks, setExecutiveRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const devSkillsList = [
        "Frontend", "Backend", "Workflows", "Databases", "Prompting",
        "Non-popular LLMs", "Fine-tuning", "Data Labelling", "Content Generation"
    ];

    const softTraitsList = [
        "Accountability", "Compliance", "Learnability", "Ambitious",
        "Abstract Thinking", "Communication", "Curiosity", "English",
        "Second-Order Thinking", "First-Principle Thinking"
    ];

    useEffect(() => {
        fetchTeamData();
    }, []);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get current user's profile
            const { data: currentUserProfile, error: userError } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .single();

            if (userError) throw userError;

            // 2. Fetch ALL profiles in the organization
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, role, job_title, avatar_url, department')
                .eq('org_id', currentUserProfile.org_id)
                .neq('id', user.id)
                .order('full_name');

            if (profileError) throw profileError;

            // 3. Fetch reviews
            const { data: reviews, error: reviewError } = await supabase
                .from('employee_reviews')
                .select('*')
                .in('user_id', profiles.map(p => p.id));

            if (reviewError) throw reviewError;

            // Merge Data
            const merged = profiles.map(profile => {
                const review = reviews?.find(r => r.user_id === profile.id);
                const hasManagerReview = review?.manager_development_skills &&
                    Object.keys(review.manager_development_skills).length > 0;

                return {
                    ...profile,
                    reviewId: review ? review.id : null,
                    selfReviewed: !!review?.development_skills && Object.keys(review.development_skills || {}).length > 0,
                    managerReviewed: hasManagerReview,
                    executiveReviewed: !!review?.executive_remarks,
                    reviewData: review || null
                };
            });

            setEmployees(merged);
        } catch (error) {
            console.error('Error fetching team data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEmployeeSelect = (employee) => {
        setSelectedEmployee(employee);
        setExecutiveRemarks(employee.reviewData?.executive_remarks || '');
        setSaveSuccess(false);
    };

    const handleSaveRemarks = async () => {
        if (!selectedEmployee) return;
        setSaving(true);

        try {
            const reviewData = {
                executive_remarks: executiveRemarks
            };

            let error;

            if (selectedEmployee.reviewId) {
                const { error: updateError } = await supabase
                    .from('employee_reviews')
                    .update(reviewData)
                    .eq('id', selectedEmployee.reviewId);
                error = updateError;
            } else {
                // Should not happen usually in executive flow as reviews likely exist, 
                // but if executive reviews first, we create the row.
                const { error: insertError } = await supabase
                    .from('employee_reviews')
                    .insert({
                        user_id: selectedEmployee.id,
                        ...reviewData
                    });
                error = insertError;
            }

            if (error) throw error;

            setSaveSuccess(true);
            await fetchTeamData(); // Refresh list to show updated status

            setTimeout(() => {
                setSaveSuccess(false);
                setSelectedEmployee(null);
            }, 1000);

        } catch (err) {
            console.error('Error saving remarks:', err);
            alert('Failed to save remarks');
        } finally {
            setSaving(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (score >= 5) return 'text-violet-600 bg-violet-50 border-violet-100';
        return 'text-amber-600 bg-amber-50 border-amber-100';
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        let matchesStatus = true;

        if (filterStatus === 'completed') {
            matchesStatus = emp.selfReviewed && emp.managerReviewed;
        } else if (filterStatus === 'pending') {
            // "pending ,where self essessment is done and manager review is pending"
            matchesStatus = emp.selfReviewed && !emp.managerReviewed;
        }

        return matchesSearch && matchesStatus;
    });

    const renderSkillBar = (label, selfScore, managerScore) => (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-graphite">{label}</label>
            </div>

            {/* Multi-value Progress Bar */}
            <div className="relative h-6 w-full bg-mist/30 rounded-lg overflow-hidden flex items-center">
                {/* Background Grid Lines */}
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="absolute h-full w-px bg-white/50" style={{ left: `${(i + 1) * 10}%` }} />
                ))}

                {/* Self Score Marker */}
                {selfScore !== undefined && (
                    <div
                        className="absolute h-4 w-4 rounded-full bg-blue-500 shadow-sm border-2 border-white z-10 flex items-center justify-center group cursor-help transition-all duration-500"
                        style={{ left: `calc(${selfScore * 10}% - 8px)` }}
                        title={`Self Rating: ${selfScore}`}
                    >
                        <div className="hidden group-hover:block absolute bottom-full mb-1 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                            Self: {selfScore}
                        </div>
                    </div>
                )}

                {/* Manager Score Marker */}
                {managerScore !== undefined && (
                    <div
                        className="absolute h-4 w-4 rounded-full bg-violet-600 shadow-sm border-2 border-white z-20 flex items-center justify-center group cursor-help transition-all duration-500"
                        style={{ left: `calc(${managerScore * 10}% - 8px)` }}
                        title={`Manager Rating: ${managerScore}`}
                    >
                        <div className="hidden group-hover:block absolute bottom-full mb-1 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                            Manager: {managerScore}
                        </div>
                    </div>
                )}

                {/* Connecting Line (Gap Analysis) */}
                {selfScore !== undefined && managerScore !== undefined && (
                    <div
                        className={`absolute h-1 z-0 transition-all duration-500 ${Math.abs(selfScore - managerScore) > 2 ? 'bg-amber-300' : 'bg-violet-200'}`}
                        style={{
                            left: `${Math.min(selfScore, managerScore) * 10}%`,
                            width: `${Math.abs(selfScore - managerScore) * 10}%`
                        }}
                    />
                )}
            </div>

            <div className="flex justify-between text-[10px] text-graphite-light mt-1">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Self ({selfScore || 'N/A'})
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                    Manager ({managerScore || 'N/A'})
                </span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-paper font-body p-6 pb-20 flex gap-6">

            {/* List Sidebar */}
            <div className={`w-full lg:w-1/3 flex flex-col gap-6 ${selectedEmployee ? 'hidden lg:flex' : ''}`}>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-violet-600 mb-1">
                        <Building2 className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Executive Overview</span>
                    </div>
                    <h1 className="text-2xl font-display font-medium text-ink">Performance Reviews</h1>
                    <p className="text-graphite-light text-sm">Review employee assessments and managers' evaluations.</p>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-mist shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-light" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-accent-violet transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'completed', 'pending'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`
                                    flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors
                                    ${filterStatus === status
                                        ? 'bg-ink text-white'
                                        : 'bg-paper text-graphite hover:bg-mist'
                                    }
                                `}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Employee List */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-250px)] no-scrollbar">
                    {loading ? (
                        <div className="py-8 text-center text-graphite-light">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading team...
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-8 text-graphite-light text-sm">
                            No employees found.
                        </div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <motion.button
                                key={emp.id}
                                layoutId={emp.id}
                                onClick={() => handleEmployeeSelect(emp)}
                                className={`
                                    w-full text-left p-4 rounded-xl border transition-all duration-200 group
                                    ${selectedEmployee?.id === emp.id
                                        ? 'bg-white border-accent-violet shadow-md'
                                        : 'bg-white border-mist hover:border-accent-violet/50 hover:shadow-sm'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-accent-violet font-bold">
                                                {emp.full_name?.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-medium text-ink">{emp.full_name}</h3>
                                            <p className="text-xs text-graphite-light">{emp.job_title || 'Employee'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                                    <span className={`px-2 py-0.5 rounded-full font-medium border ${emp.selfReviewed ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                        Self: {emp.selfReviewed ? 'Done' : 'Pending'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full font-medium border ${emp.managerReviewed ? 'bg-violet-50 text-violet-600 border-violet-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                        Manager: {emp.managerReviewed ? 'Done' : 'Pending'}
                                    </span>
                                    {emp.executiveReviewed && (
                                        <span className="px-2 py-0.5 rounded-full font-medium border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Remarks Added
                                        </span>
                                    )}
                                </div>
                            </motion.button>
                        ))
                    )}
                </div>
            </div>

            {/* Review Details Area */}
            <div className={`flex-1 bg-white rounded-2xl border border-mist shadow-xl overflow-hidden flex flex-col ${!selectedEmployee ? 'hidden lg:flex items-center justify-center' : ''}`}>
                {!selectedEmployee ? (
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-violet-50 text-accent-violet rounded-full flex items-center justify-center mx-auto mb-4">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-display font-medium text-ink mb-2">Executive Review Console</h2>
                        <p className="text-graphite-light max-w-xs mx-auto">
                            Select an employee to compare self-assessment vs manager scores and add your executive remarks.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-mist flex justify-between items-start bg-paper-warm">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="lg:hidden p-2 hover:bg-mist rounded-lg"
                                >
                                    <ChevronRight className="w-5 h-5 rotate-180" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-display font-medium text-ink flex items-center gap-2">
                                        Reviewing {selectedEmployee.full_name}
                                        {selectedEmployee.executiveReviewed && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                    </h2>
                                    <p className="text-sm text-graphite-light">
                                        {selectedEmployee.job_title} • {selectedEmployee.department || 'General'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedEmployee.reviewData?.date_reviewed && (
                                    <div className="flex items-center gap-1.5 text-xs text-graphite-light bg-white px-3 py-1.5 rounded-full border border-mist">
                                        <Clock className="w-3.5 h-3.5" />
                                        Updated: {new Date(selectedEmployee.reviewData.date_reviewed).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">

                            {/* Summary Cards */}
                            <div className="flex gap-4">
                                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                                        <User className="w-4 h-4" /> Self Assessment
                                    </div>
                                    <div className="text-sm text-blue-900">
                                        {selectedEmployee.selfReviewed
                                            ? "Assessment completed by employee."
                                            : "Employee has not submitted self-assessment yet."}
                                    </div>
                                </div>
                                <div className="flex-1 bg-violet-50 border border-violet-100 rounded-xl p-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-violet-700 font-medium text-sm">
                                        <Users className="w-4 h-4" /> Manager Review
                                    </div>
                                    <div className="text-sm text-violet-900">
                                        {selectedEmployee.managerReviewed
                                            ? "Evaluation completed by manager."
                                            : "Manager evaluation pending."}
                                    </div>
                                </div>
                            </div>

                            {/* Dev Skills */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4 flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-accent-violet" />
                                    Technical Skills Comparison
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {devSkillsList.map(skill => renderSkillBar(
                                        skill,
                                        selectedEmployee.reviewData?.development_skills?.[skill],
                                        selectedEmployee.reviewData?.manager_development_skills?.[skill]
                                    ))}
                                </div>
                            </div>

                            <hr className="border-mist" />

                            {/* Soft Skills */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4 flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-pink-500" />
                                    Soft Traits Comparison
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {softTraitsList.map(skill => renderSkillBar(
                                        skill,
                                        selectedEmployee.reviewData?.soft_skills?.[skill],
                                        selectedEmployee.reviewData?.manager_soft_skills?.[skill]
                                    ))}
                                </div>
                            </div>

                            <hr className="border-mist" />

                            {/* Manager Feedback Display */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-mist">
                                <h3 className="text-sm font-semibold text-ink mb-2">Manager's Feedback</h3>
                                <p className="text-sm text-graphite italic leading-relaxed">
                                    {selectedEmployee.reviewData?.manager_feedback || "No feedback provided by manager yet."}
                                </p>
                            </div>

                            {/* Executive Remarks Input */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                                    Executive Remarks
                                </h3>
                                <textarea
                                    value={executiveRemarks}
                                    onChange={(e) => setExecutiveRemarks(e.target.value)}
                                    placeholder="Add your executive summary and remarks here..."
                                    className="w-full h-32 p-4 rounded-xl border border-mist focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none text-sm leading-relaxed"
                                ></textarea>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-mist bg-paper-warm flex justify-end items-center gap-4">
                            {saveSuccess && (
                                <span className="text-emerald-600 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Remarks Saved
                                </span>
                            )}
                            <button
                                onClick={handleSaveRemarks}
                                disabled={saving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Remarks'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div >
    );
};

export default ExecutiveReviewsPage;
