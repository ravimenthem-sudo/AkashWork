import React from 'react';
import { Search, Calendar, Clock, X, ChevronDown, CheckCircle2 } from 'lucide-react';

const TaskFilters = ({
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilters,
    setStatusFilters,
    showStatusDropdown,
    setShowStatusDropdown
}) => {
    return (
        <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
            backgroundColor: 'white',
            padding: '12px 16px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
        }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                <Search size={18} style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                }} />
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 16px 12px 42px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.9rem',
                        outline: 'none',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s',
                        color: '#334155'
                    }}
                    onFocus={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                        e.target.style.backgroundColor = '#f8fafc';
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                    }}
                />
            </div>

            {/* Filters Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Date Picker */}
                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '4px',
                    transition: 'all 0.2s'
                }}>
                    <div style={{
                        padding: '8px 12px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        borderRight: '1px solid #e2e8f0'
                    }}>
                        <Calendar size={16} />
                    </div>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            color: '#334155',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            height: '24px',
                            fontFamily: 'inherit',
                            fontWeight: 500
                        }}
                    />
                </div>

                {/* Today Button */}
                <button
                    onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.2s'
                    }}
                    title="Show Today's Tasks"
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Clock size={16} />
                    <span>Today</span>
                </button>

                {dateFilter && (
                    <button
                        onClick={() => setDateFilter('')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            border: '1px solid #fee2e2',
                            backgroundColor: '#fff1f2',
                            color: '#e11d48',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(225, 29, 72, 0.05)'
                        }}
                        title="Clear Date Filter"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffe4e6';
                            e.currentTarget.style.transform = 'rotate(90deg)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff1f2';
                            e.currentTarget.style.transform = 'rotate(0deg)';
                        }}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Status Filter Multi-Select */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    style={{
                        padding: '10px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        backgroundColor: 'white',
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <span>{statusFilters.includes('all') ? 'All Statuses' : `${statusFilters.length} Selected`}</span>
                    <ChevronDown size={14} />
                </button>

                {showStatusDropdown && (
                    <>
                        <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                            onClick={() => setShowStatusDropdown(false)}
                        />
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                            padding: '8px',
                            zIndex: 50,
                            width: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }}>
                            {[
                                { value: 'all', label: 'All Statuses' },
                                { value: 'pending', label: 'Pending' },
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'on_hold', label: 'On Hold' },
                                { value: 'rejected', label: 'Rejected' },
                                { value: 'archived', label: 'Archived' }
                            ].map(option => (
                                <div
                                    key={option.value}
                                    onClick={() => {
                                        if (option.value === 'all') {
                                            setStatusFilters(['all']);
                                        } else {
                                            let newFilters = statusFilters.filter(f => f !== 'all');
                                            if (newFilters.includes(option.value)) {
                                                newFilters = newFilters.filter(f => f !== option.value);
                                            } else {
                                                newFilters.push(option.value);
                                            }
                                            if (newFilters.length === 0) newFilters = ['all'];
                                            setStatusFilters(newFilters);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        color: '#334155',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: statusFilters.includes(option.value) ? '#f0f9ff' : 'transparent',
                                        transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = statusFilters.includes(option.value) ? '#e0f2fe' : '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = statusFilters.includes(option.value) ? '#f0f9ff' : 'transparent'}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '4px',
                                        border: `2px solid ${statusFilters.includes(option.value) ? '#3b82f6' : '#cbd5e1'}`,
                                        backgroundColor: statusFilters.includes(option.value) ? '#3b82f6' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {statusFilters.includes(option.value) && <CheckCircle2 size={10} color="white" />}
                                    </div>
                                    {option.label}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskFilters;
