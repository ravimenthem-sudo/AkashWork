import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Search,
    ChevronRight,
    Star,
    Filter,
    CheckCircle2,
    Circle,
    Clock,
    AlertCircle,
    Brain,
    Heart,
    Save,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TeamReviewsPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, reviewed
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Review Form State
    const [reviewForm, setReviewForm] = useState({
        devSkills: {},
        softSkills: {},
        feedback: ''
    });
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

            // 1. Get current user's profile to know their org_id
            const { data: currentUserProfile, error: userError } = await supabase
                .from('profiles')
                .select('org_id, role')
                .eq('id', user.id)
                .single();

            if (userError) throw userError;

            // 2. Fetch ALL profiles in the same organization
            // Excluding the manager themselves
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, role, job_title, avatar_url, department')
                .eq('org_id', currentUserProfile.org_id)
                .neq('id', user.id) // Exclude self
                .order('full_name');

            if (profileError) throw profileError;

            // 2. Fetch existing reviews for these employees
            const { data: reviews, error: reviewError } = await supabase
                .from('employee_reviews')
                .select('*')
                .in('user_id', profiles.map(p => p.id));

            if (reviewError) throw reviewError;

            // Merge Data
            const merged = profiles.map(profile => {
                const review = reviews?.find(r => r.user_id === profile.id);
                // Check if manager skills object has keys (not just empty default object)
                const hasManagerReview = review?.manager_development_skills &&
                    Object.keys(review.manager_development_skills).length > 0;

                return {
                    ...profile,
                    reviewId: review ? review.id : null,
                    selfReviewed: !!review?.development_skills && Object.keys(review.development_skills || {}).length > 0,
                    managerReviewed: hasManagerReview,
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

        // Initialize form with existing manager review if available
        if (employee.reviewData?.manager_development_skills) {
            setReviewForm({
                devSkills: employee.reviewData.manager_development_skills || {},
                softSkills: employee.reviewData.manager_soft_skills || {},
                feedback: employee.reviewData.manager_feedback || ''
            });
        } else {
            // Initialize with 5s
            const initialDev = {};
            devSkillsList.forEach(s => initialDev[s] = 5);
            const initialSoft = {};
            softTraitsList.forEach(s => initialSoft[s] = 5);

            setReviewForm({
                devSkills: initialDev,
                softSkills: initialSoft,
                feedback: ''
            });
        }
        setSaveSuccess(false);
    };

    const handleScoreChange = (type, skill, value) => {
        setReviewForm(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [skill]: parseFloat(value)
            }
        }));
    };

    const handleSubmitReview = async () => {
        if (!selectedEmployee) return;
        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Calculate Scores
            const devTotal = Object.values(reviewForm.devSkills).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            const softTotal = Object.values(reviewForm.softSkills).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            const grandTotal = devTotal + softTotal;
            const percentage = ((grandTotal / 190) * 100).toFixed(1);

            const reviewData = {
                manager_development_skills: reviewForm.devSkills,
                manager_soft_skills: reviewForm.softSkills,
                manager_feedback: reviewForm.feedback,
                manager_id: user.id,
                manager_score_dev: devTotal,
                manager_score_soft: softTotal,
                manager_score_total: grandTotal,
                manager_score_percentage: percentage,
                date_reviewed: new Date().toISOString()
            };

            let error;

            if (selectedEmployee.reviewId) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('employee_reviews')
                    .update(reviewData)
                    .eq('id', selectedEmployee.reviewId);
                error = updateError;
            } else {
                // Create new (if employee hasn't self-reviewed yet, we create the row)
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

            // Refresh local data
            await fetchTeamData();

            setTimeout(() => {
                setSaveSuccess(false);
                setSelectedEmployee(null); // Return to list view
            }, 1500);

        } catch (err) {
            console.error('Error saving review:', err);
            alert('Failed to save review');
        } finally {
            setSaving(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 8) return 'text-emerald-600';
        if (score >= 5) return 'text-violet-600';
        return 'text-amber-600';
    };

    // Filter Logic
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        let matchesStatus = true;

        if (filterStatus === 'submitted') {
            matchesStatus = emp.selfReviewed;
        } else if (filterStatus === 'pending') {
            matchesStatus = !emp.selfReviewed;
        } else if (filterStatus === 'pending_manager') {
            // Show all employees pending MANAGER review, regardless of self-review status
            matchesStatus = !emp.managerReviewed;
        }

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-paper font-body p-6 pb-20 flex gap-6">

            {/* List Sidebar */}
            <div className={`w-full lg:w-1/3 flex flex-col gap-6 ${selectedEmployee ? 'hidden lg:flex' : ''}`}>
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-display font-medium text-ink">Employee Reviews</h1>
                    <p className="text-graphite-light text-sm">Evaluate your team members' performance.</p>
                </div>

                {/* Filters */}
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
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'submitted', label: 'Self Submitted' },
                            { id: 'pending_manager', label: 'Rev. Pending' },
                            { id: 'pending', label: 'Self Pending' }
                        ].map(option => (
                            <button
                                key={option.id}
                                onClick={() => setFilterStatus(option.id)}
                                className={`
                                    px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap
                                    ${filterStatus === option.id
                                        ? 'bg-ink text-white'
                                        : 'bg-paper text-graphite hover:bg-mist'
                                    }
                                `}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Employee List */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-180px)] no-scrollbar">
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
                                <div className="flex flex-col gap-2 mt-3">
                                    <div className="flex items-center justify-between">
                                        <span className={`
                                        text-[10px] px-2 py-0.5 rounded-full font-medium border
                                        ${emp.selfReviewed
                                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                            }
                                    `}>
                                            {emp.selfReviewed ? 'Self Assessment: Done' : 'Self Assessment: Pending'}
                                        </span>
                                        {emp.managerReviewed ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Review Complete
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-gray-50 text-gray-500 border-gray-200">
                                                Review Pending
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.button>
                        ))
                    )}
                </div>
            </div>

            {/* Review Form Area */}
            <div className={`flex-1 bg-white rounded-2xl border border-mist shadow-xl overflow-hidden flex flex-col ${!selectedEmployee ? 'hidden lg:flex items-center justify-center' : ''}`}>
                {!selectedEmployee ? (
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-violet-50 text-accent-violet rounded-full flex items-center justify-center mx-auto mb-4">
                            <Star className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-display font-medium text-ink mb-2">Select an Employee</h2>
                        <p className="text-graphite-light max-w-xs mx-auto">
                            Choose a team member from the list to start or edit their performance review.
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
                                    <h2 className="text-xl font-display font-medium text-ink">Reviewing {selectedEmployee.full_name}</h2>
                                    <p className="text-sm text-graphite-light">
                                        {selectedEmployee.managerReviewed ? 'Update your review' : 'Submit new review'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedEmployee.reviewData?.date_reviewed && (
                                    <div className="flex items-center gap-1.5 text-xs text-graphite-light bg-white px-3 py-1.5 rounded-full border border-mist">
                                        <Clock className="w-3.5 h-3.5" />
                                        Last updated: {new Date(selectedEmployee.reviewData.date_reviewed).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">

                            {/* Compare with Self Review if available */}
                            {selectedEmployee.selfReviewed && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-blue-900">Self Assessment Available</h4>
                                        <p className="text-sm text-blue-700 mt-1">
                                            {selectedEmployee.full_name} has completed their self-review. You can see their ratings as you fill out yours.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Dev Skills */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4 flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-accent-violet" />
                                    Technical Skills
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {devSkillsList.map(skill => (
                                        <div key={skill} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium text-graphite">{skill}</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1" max="10"
                                                        step="0.5"
                                                        value={reviewForm.devSkills[skill] || 0}
                                                        onChange={(e) => {
                                                            let val = parseFloat(e.target.value);
                                                            if (val > 10) val = 10;
                                                            if (val < 0) val = 0;
                                                            handleScoreChange('devSkills', skill, val || 0)
                                                        }}
                                                        className={`w-16 p-1.5 text-center text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-violet ${(reviewForm.devSkills[skill] || 0) >= 8 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                            (reviewForm.devSkills[skill] || 0) >= 5 ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                                                'bg-amber-50 border-amber-200 text-amber-700'
                                                            }`}
                                                    />
                                                    <span className="text-xs text-graphite-light font-medium">/10</span>
                                                </div>
                                            </div>

                                            {/* Interactive Range Slider with Visual Progress */}
                                            <div className="relative h-2 w-full bg-mist rounded-full overflow-hidden">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="0.5"
                                                    value={reviewForm.devSkills[skill] || 0}
                                                    onChange={(e) => handleScoreChange('devSkills', skill, e.target.value)}
                                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                />
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-accent-violet transition-all duration-300 rounded-full z-10"
                                                    style={{ width: `${((reviewForm.devSkills[skill] || 0) / 10) * 100}%` }}
                                                />
                                            </div>

                                            {selectedEmployee.selfReviewed && selectedEmployee.reviewData?.development_skills?.[skill] && (
                                                <div className="flex justify-between items-center bg-blue-50/50 p-1.5 rounded-lg border border-blue-100/50">
                                                    <span className="text-[10px] text-graphite-light">Employee Self-Rating</span>
                                                    <span className="text-xs font-semibold text-blue-600">
                                                        {selectedEmployee.reviewData.development_skills[skill]}/10
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <hr className="border-mist" />

                            {/* Soft Skills */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4 flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-pink-500" />
                                    Soft Traits
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {softTraitsList.map(skill => (
                                        <div key={skill} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium text-graphite">{skill}</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1" max="10"
                                                        step="0.5"
                                                        value={reviewForm.softSkills[skill] || 0}
                                                        onChange={(e) => {
                                                            let val = parseFloat(e.target.value);
                                                            if (val > 10) val = 10;
                                                            if (val < 0) val = 0;
                                                            handleScoreChange('softSkills', skill, val || 0)
                                                        }}
                                                        className={`w-16 p-1.5 text-center text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-violet ${(reviewForm.softSkills[skill] || 0) >= 8 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                            (reviewForm.softSkills[skill] || 0) >= 5 ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                                                'bg-amber-50 border-amber-200 text-amber-700'
                                                            }`}
                                                    />
                                                    <span className="text-xs text-graphite-light font-medium">/10</span>
                                                </div>
                                            </div>

                                            {/* Interactive Range Slider with Visual Progress */}
                                            <div className="relative h-2 w-full bg-mist rounded-full overflow-hidden">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="0.5"
                                                    value={reviewForm.softSkills[skill] || 0}
                                                    onChange={(e) => handleScoreChange('softSkills', skill, e.target.value)}
                                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                />
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-pink-500 transition-all duration-300 rounded-full z-10"
                                                    style={{ width: `${((reviewForm.softSkills[skill] || 0) / 10) * 100}%` }}
                                                />
                                            </div>

                                            {selectedEmployee.selfReviewed && selectedEmployee.reviewData?.soft_skills?.[skill] && (
                                                <div className="flex justify-between items-center bg-blue-50/50 p-1.5 rounded-lg border border-blue-100/50">
                                                    <span className="text-[10px] text-graphite-light">Employee Self-Rating</span>
                                                    <span className="text-xs font-semibold text-blue-600">
                                                        {selectedEmployee.reviewData.soft_skills[skill]}/10
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <hr className="border-mist" />

                            {/* Feedback */}
                            <div>
                                <h3 className="text-lg font-medium text-ink mb-4">Manager's Feedback</h3>
                                <textarea
                                    value={reviewForm.feedback}
                                    onChange={(e) => setReviewForm(prev => ({ ...prev, feedback: e.target.value }))}
                                    placeholder="Write your detailed feedback here..."
                                    className="w-full h-32 p-4 rounded-xl border border-mist focus:border-accent-violet focus:ring-1 focus:ring-accent-violet outline-none transition-all resize-none text-sm leading-relaxed"
                                ></textarea>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-mist bg-paper-warm flex justify-end items-center gap-4">
                            {saveSuccess && (
                                <span className="text-emerald-600 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Review Saved Successfully
                                </span>
                            )}
                            <button
                                onClick={handleSubmitReview}
                                disabled={saving}
                                className="px-6 py-2.5 bg-accent-violet hover:bg-accent-violet-deep text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Submit Review'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TeamReviewsPage;
