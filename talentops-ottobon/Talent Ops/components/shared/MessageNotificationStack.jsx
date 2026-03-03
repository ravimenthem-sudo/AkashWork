import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMessages } from './context/MessageContext';
import MessageNotificationToast from './MessageNotificationToast';

/**
 * Wrapper component that renders the notification stack.
 * Must be used inside MessageProvider.
 */
const MessageNotificationStack = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        notificationQueue,
        dismissNotification,
        sendQuickReply
    } = useMessages();

    // Don't show notifications if already on messages page
    const isOnMessagesPage = location.pathname.includes('/messages');

    if (isOnMessagesPage) {
        return null;
    }

    // Determine dashboard path based on current route
    const getDashboardPath = () => {
        if (location.pathname.includes('/manager-dashboard')) return '/manager-dashboard/messages';
        if (location.pathname.includes('/executive-dashboard')) return '/executive-dashboard/messages';
        if (location.pathname.includes('/employee-dashboard')) return '/employee-dashboard/messages';
        if (location.pathname.includes('/teamlead-dashboard')) return '/teamlead-dashboard/messages';
        return '/messages';
    };

    const handleReply = async (notification, text) => {
        if (notification.conversation_id) {
            await sendQuickReply(notification.conversation_id, text);
        }
        dismissNotification(notification.id);
    };

    const handleNavigate = (notification) => {
        dismissNotification(notification.id);
        navigate(getDashboardPath());
    };

    return (
        <div className="notification-stack">
            {notificationQueue.slice(0, 3).map((notification, index) => (
                <MessageNotificationToast
                    key={notification.id}
                    message={notification}
                    index={index}
                    onReply={(text) => handleReply(notification, text)}
                    onDismiss={() => dismissNotification(notification.id)}
                    onNavigate={() => handleNavigate(notification)}
                />
            ))}
        </div>
    );
};

export default MessageNotificationStack;
