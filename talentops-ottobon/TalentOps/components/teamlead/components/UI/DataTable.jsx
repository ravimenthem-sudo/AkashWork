import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const DataTable = ({ columns, data, title, onAction }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showSearch, setShowSearch] = useState(false);
    const itemsPerPage = 10;

    // Filtering
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;

        return data.filter(row => {
            return columns.some(col => {
                const value = row[col.accessor];
                return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
            });
        });
    }, [data, searchTerm, columns]);

    // Sorting
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = sortedData.slice(startIndex, endIndex);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{title}</h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: showSearch ? 'var(--accent)' : 'transparent',
                            color: showSearch ? 'white' : 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        <Search size={16} /> Search
                    </button>

                </div>
            </div>

            {/* Search Input */}
            {showSearch && (
                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            fontSize: '0.9rem'
                        }}
                    />
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {columns.map((col, index) => (
                                <th
                                    key={index}
                                    onClick={() => col.accessor && handleSort(col.accessor)}
                                    style={{
                                        textAlign: 'left',
                                        padding: '12px 16px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        cursor: col.accessor ? 'pointer' : 'default'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {col.header}
                                        {col.accessor && <ArrowUpDown size={12} />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {currentData.length > 0 ? (
                            currentData.map((row, rowIndex) => (
                                <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                                    {columns.map((col, colIndex) => (
                                        <td key={colIndex} style={{ padding: '16px', fontSize: '0.9rem' }}>
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No results found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-sm)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <span>
                    Showing {data.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, sortedData.length)} of {sortedData.length} results
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: currentPage === 1 ? 'var(--background)' : 'var(--surface)',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentPage === 1 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <ChevronLeft size={16} /> Previous
                    </button>

                    <span style={{ padding: '0 8px' }}>
                        Page {currentPage} of {totalPages || 1}
                    </span>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: (currentPage === totalPages || totalPages === 0) ? 'var(--background)' : 'var(--surface)',
                            cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                            opacity: (currentPage === totalPages || totalPages === 0) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
