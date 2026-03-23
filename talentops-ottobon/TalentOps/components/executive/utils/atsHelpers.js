export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

export const formatDateTime = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Invalid Date';
    }
};

export const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const getRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
};

export const getInitials = (name) => {
    if (!name) return '';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

export const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const formatNumber = (num) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
};

export const calculateAverageRating = (ratings) => {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
};

export const getStatusColor = (status) => {
    const colors = {
        draft: 'info',
        published: 'success',
        archived: 'warning',
        scheduled: 'info',
        completed: 'success',
        cancelled: 'error',
        sent: 'info',
        accepted: 'success',
        rejected: 'error',
        expired: 'warning',
        applied: 'info',
        shortlisted: 'primary',
        interview: 'warning',
        offer: 'success',
        hired: 'success'
    };
    return colors[status] || 'info';
};

export const filterItems = (items, filters, searchTerm, searchFields) => {
    return items.filter(item => {
        // Check search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesSearch = searchFields.some(field => {
                const value = item[field];
                if (Array.isArray(value)) {
                    return value.some(v => v.toLowerCase().includes(term));
                }
                return value && value.toString().toLowerCase().includes(term);
            });
            if (!matchesSearch) return false;
        }

        // Check filters
        for (const [key, value] of Object.entries(filters)) {
            if (value && item[key] !== value) {
                return false;
            }
        }

        return true;
    });
};

export const sortItems = (items, sortKey, sortOrder = 'asc') => {
    return [...items].sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        // Handle dates
        if (sortKey.includes('date') || sortKey.includes('Date') || sortKey.includes('At')) {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
    });
};

export const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

export const downloadFile = (content, filename, type = 'application/pdf') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const isValidPhone = (phone) => {
    const re = /^\+?[\d\s-]{10,}$/;
    return re.test(phone);
};

export const groupBy = (items, key) => {
    return items.reduce((groups, item) => {
        const value = item[key];
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
        return groups;
    }, {});
};

export const countBy = (items, key) => {
    return items.reduce((counts, item) => {
        const value = item[key];
        counts[value] = (counts[value] || 0) + 1;
        return counts;
    }, {});
};
