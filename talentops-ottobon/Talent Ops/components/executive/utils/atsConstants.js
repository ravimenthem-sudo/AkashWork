export const PIPELINE_STAGES = [
    { id: 'applied', name: 'Applied', color: '#3b82f6' },
    { id: 'shortlisted', name: 'Shortlisted', color: '#8b5cf6' },
    { id: 'interview', name: 'Interview', color: '#f59e0b' },
    { id: 'offer', name: 'Offer', color: '#10b981' },
    { id: 'hired', name: 'Hired', color: '#059669' },
    { id: 'rejected', name: 'Rejected', color: '#ef4444' }
];

export const JOB_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
};

export const INTERVIEW_STATUS = {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

export const INTERVIEW_MODES = [
    { id: 'online', name: 'Online (Video Call)' },
    { id: 'offline', name: 'Offline (In-Person)' },
    { id: 'phone', name: 'Phone Call' }
];

export const PANEL_TYPES = [
    { id: 'hr', name: 'HR Round', icon: 'Users' },
    { id: 'technical', name: 'Technical Round', icon: 'Code' },
    { id: 'manager', name: 'Manager Round', icon: 'Briefcase' },
    { id: 'cultural', name: 'Cultural Fit', icon: 'Heart' }
];

export const RECOMMENDATIONS = {
    HIRE: 'hire',
    HOLD: 'hold',
    REJECT: 'reject'
};

export const RATING_CRITERIA = [
    { id: 'technical', name: 'Technical Skills', weight: 0.3 },
    { id: 'communication', name: 'Communication', weight: 0.2 },
    { id: 'problem_solving', name: 'Problem Solving', weight: 0.25 },
    { id: 'culture_fit', name: 'Culture Fit', weight: 0.15 },
    { id: 'experience', name: 'Relevant Experience', weight: 0.1 }
];

export const OFFER_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired'
};

export const USER_ROLES = {
    ADMIN: 'admin',
    HR: 'hr',
    INTERVIEWER: 'interviewer'
};

export const ROLE_PERMISSIONS = {
    admin: {
        canManageJobs: true,
        canManageCandidates: true,
        canScheduleInterviews: true,
        canSubmitFeedback: true,
        canManageOffers: true,
        canViewAnalytics: true,
        canManageUsers: true,
        canViewAuditLog: true
    },
    hr: {
        canManageJobs: true,
        canManageCandidates: true,
        canScheduleInterviews: false,
        canSubmitFeedback: false,
        canManageOffers: true,
        canViewAnalytics: true,
        canManageUsers: false,
        canViewAuditLog: false
    },
    interviewer: {
        canManageJobs: false,
        canManageCandidates: false,
        canScheduleInterviews: false,
        canSubmitFeedback: false,
        canManageOffers: false,
        canViewAnalytics: false,
        canManageUsers: false,
        canViewAuditLog: false
    }
};

export const DEPARTMENTS = [
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Human Resources',
    'Finance',
    'Operations',
    'Customer Support',
    'Legal'
];

export const EXPERIENCE_LEVELS = [
    { id: 'entry', name: 'Entry Level (0-2 years)' },
    { id: 'mid', name: 'Mid Level (2-5 years)' },
    { id: 'senior', name: 'Senior (5-8 years)' },
    { id: 'lead', name: 'Lead/Principal (8+ years)' },
    { id: 'executive', name: 'Executive' }
];

export const LOCATIONS = [
    'Remote',
    'New York, NY',
    'San Francisco, CA',
    'Los Angeles, CA',
    'Chicago, IL',
    'Austin, TX',
    'Seattle, WA',
    'Boston, MA',
    'Denver, CO',
    'Miami, FL',
    'Bangalore, Karnataka',
    'Mumbai, Maharashtra',
    'Delhi NCR',
    'Hyderabad, Telangana',
    'Chennai, Tamil Nadu',
    'Pune, Maharashtra',
    'Kolkata, West Bengal',
    'Ahmedabad, Gujarat'
];

export const COMMON_SKILLS = [
    'JavaScript',
    'Python',
    'React',
    'Node.js',
    'TypeScript',
    'Java',
    'SQL',
    'AWS',
    'Docker',
    'Kubernetes',
    'Git',
    'Agile',
    'Scrum',
    'Project Management',
    'Data Analysis',
    'Machine Learning',
    'UI/UX Design',
    'Communication',
    'Leadership',
    'Problem Solving'
];

export const STORAGE_KEYS = {
    JOBS: 'ats_jobs',
    CANDIDATES: 'ats_candidates',
    INTERVIEWS: 'ats_interviews',
    FEEDBACK: 'ats_feedback',
    OFFERS: 'ats_offers',
    USERS: 'ats_users',
    CURRENT_USER: 'ats_current_user',
    AUDIT_LOG: 'ats_audit_log'
};
