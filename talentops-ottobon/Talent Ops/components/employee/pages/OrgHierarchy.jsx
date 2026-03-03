import React from 'react';
// @ts-ignore
import HierarchyDemo from '../../shared/HierarchyDemo';

const OrgHierarchy = () => {
    return (
        <div style={{ height: 'calc(100vh - 100px)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', margin: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <HierarchyDemo />
        </div>
    );
};

export default OrgHierarchy;
