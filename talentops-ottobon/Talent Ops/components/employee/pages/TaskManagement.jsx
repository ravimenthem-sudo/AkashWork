import React from 'react';
import { Search, Calendar, CheckCircle } from 'lucide-react';

const TaskManagement = () => {
    console.log("🚀 TEST COMPONENT MOUNTED - HELLO WORLD");
    return (
        <div style={{ padding: '50px', background: '#ffe4e6', color: '#881337', fontSize: '24px', border: '5px solid red' }}>
            <h1>⚠️ DEBUG MODE: TEST COMPONENT</h1>
            <p>If you see this, the routing /employee-dashboard/my-tasks is working perfectly.</p>
            <p>The issue was likely in the previous component logic.</p>
        </div>
    );
};

export default TaskManagement;
