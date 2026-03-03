import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { getConversationsByCategory, sendMessage, markAsReadInDB } from '../../../services/messageService';
import { sendNotification } from '../../../services/notificationService';

const MessageContext = createContext();

export const useMessages = () => {
    return useContext(MessageContext);
};

export const MessageProvider = ({ children, addToast }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [conversations, setConversations] = useState([]);
    const [lastReadTimes, setLastReadTimes] = useState({});
    const [userId, setUserId] = useState(null);
    const [notificationQueue, setNotificationQueue] = useState([]);
    const [lastIncomingMessage, setLastIncomingMessage] = useState(null);

    // Hooks for navigation
    const navigate = useNavigate();
    const location = useLocation();

    // Get current user first
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setUserId(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                setConversations([]);
                setUnreadCount(0);
                setLastReadTimes({}); // Clear on logout
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Initialize from localStorage AFTER we have userId (user-specific storage)
    useEffect(() => {
        if (!userId) return;

        const storageKey = `message_read_times_${userId} `;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            try {
                setLastReadTimes(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse read times', e);
            }
        }
    }, [userId]);

    // Persist to localStorage whenever it changes (user-specific)
    useEffect(() => {
        if (!userId) return;
        if (Object.keys(lastReadTimes).length > 0) {
            const storageKey = `message_read_times_${userId} `;
            localStorage.setItem(storageKey, JSON.stringify(lastReadTimes));
        }
    }, [lastReadTimes, userId]);

    // Request Notification Permissions on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    // Tab Title Blinking Effect
    useEffect(() => {
        let intervalId;

        if (unreadCount > 0) {
            let showMessage = true;
            intervalId = setInterval(() => {
                document.title = showMessage ? `(${unreadCount}) New Message!` : 'Talent OPS';
                showMessage = !showMessage;
            }, 1000);
        } else {
            document.title = 'Talent OPS';
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
            document.title = 'Talent OPS';
        };
    }, [unreadCount]);

    const fetchConversations = async () => {
        if (!userId) return;
        try {
            // 1. Get user's conversation memberships
            const { data: memberships } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .eq('user_id', userId);

            if (!memberships?.length) return;

            const conversationIds = memberships.map(m => m.conversation_id);

            // 2. Get conversations with their indexes (last message info)
            const { data: convs, error } = await supabase
                .from('conversations')
                .select(`
id,
    type,
    name,
    conversation_indexes(
        last_message,
        last_message_at
    )
        `)
                .in('id', conversationIds);

            if (error) throw error;

            setConversations(convs || []);
            return convs || [];
        } catch (err) {
            console.error('Error fetching conversations for notifications:', err);
            return [];
        }
    };

    // Fetch conversations and calculate unread count
    useEffect(() => {
        fetchConversations();

        // Poll every 30 seconds for new messages (fallback)
        const interval = setInterval(fetchConversations, 30000);

        return () => clearInterval(interval);
    }, [userId]);

    // Real-time listener for notifications
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`message - notifs - ${userId} `)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `receiver_id = eq.${userId} `
                },
                async (payload) => {
                    // Handle ALL Notification Types
                    // 1. Determine title and body based on type
                    let notifTitle = 'New Notification';
                    let notifBody = payload.new.message || 'You have a new update';
                    let notifIcon = '/pwa-192x192.png';

                    if (payload.new.type === 'message') {
                        // Message specific logic
                        setUnreadCount(prev => prev + 1);
                        await fetchConversations(); // Refresh inbox

                        notifTitle = `New Message from ${payload.new.sender_name || 'User'} `;
                        notifBody = payload.new.message;

                        // Fetch sender profile & conversation context for notification
                        const senderId = payload.new.sender_id;
                        let senderAvatar = null;
                        let conversationId = null;
                        let displayMessage = payload.new.message || 'New Message';

                        if (senderId) {
                            const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', senderId).single();
                            senderAvatar = profile?.avatar_url;
                            notifIcon = senderAvatar || notifIcon;

                            // Attempt to find DM conversation ID
                            const { data: senderMemberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', senderId);
                            if (senderMemberships) {
                                const senderConvIds = senderMemberships.map(c => c.conversation_id);
                                const latestConvsWithIds = await fetchConversations();
                                const dm = latestConvsWithIds?.find(c => c.type === 'dm' && senderConvIds.includes(c.id));
                                if (dm) {
                                    conversationId = dm.id;
                                    const lastMessage = dm.conversation_indexes?.[0]?.last_message;
                                    if (lastMessage) {
                                        const looksGeneric = (payload.new.message || '').toLowerCase().startsWith('new message from');
                                        displayMessage = looksGeneric ? lastMessage : (payload.new.message || lastMessage);
                                    }
                                }
                            }
                        }

                        // ALWAYS add to notification queue (moved outside addToast check)
                        addNotification({
                            id: payload.new.id || Date.now(),
                            sender_id: senderId,
                            sender_name: payload.new.sender_name || 'User',
                            avatar_url: senderAvatar,
                            content: displayMessage,
                            conversation_id: conversationId,
                            timestamp: Date.now()
                        });

                        // Set last incoming message to trigger UI updates (e.g. resorting conversation list)
                        setLastIncomingMessage({
                            id: payload.new.id,
                            timestamp: Date.now()
                        });

                        // Also trigger legacy toast system if available
                        if (addToast) {
                            if (conversationId) {
                                const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
                                const myName = myProfile?.full_name || 'Someone';
                                const recipientId = senderId;
                                addToast(displayMessage, 'message_reply', {
                                    sender: { name: payload.new.sender_name || 'User', avatar_url: senderAvatar },
                                    action: {
                                        onReply: async (text) => {
                                            await sendMessage(conversationId, userId, text);
                                            await sendNotification(recipientId, userId, myName, text, 'message');
                                        }
                                    }
                                });
                            } else {
                                addToast(displayMessage, 'info', { label: 'View', onClick: () => navigate('/messages') });
                            }
                        }

                    } else if (payload.new.type === 'task_assigned') {
                        notifTitle = 'New Task Assigned';
                        notifBody = payload.new.message;
                        if (addToast) addToast(notifBody, 'info');
                    } else if (payload.new.type === 'task_closed') {
                        notifTitle = 'Task Update';
                        notifBody = payload.new.message;
                        if (addToast) addToast(notifBody, 'info');
                    } else if (payload.new.type === 'access_requested') {
                        notifTitle = 'Access Requested';
                        notifBody = payload.new.message;
                        if (addToast) addToast(notifBody, 'info');
                    } else if (payload.new.type === 'access_approved') {
                        notifTitle = 'Access Approved';
                        notifBody = payload.new.message;
                        if (addToast) addToast(notifBody, 'info');
                    } else if (payload.new.type === 'announcement') {
                        notifTitle = 'New Announcement';
                        notifBody = payload.new.message;
                        if (addToast) addToast(notifBody, 'info');
                    } else {
                        // Generic
                        if (addToast) addToast(notifBody, 'info');
                    }

                    // 2. System Notification (Always trigger if permission granted, regardless of focus)
                    // User requested "even though... it didn't blink".
                    // Explicitly triggering for visual feedback.
                    // 2. System Notification (Always trigger if permission granted)
                    // 2. System Notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            const senderName = payload.new.sender_name || 'User';
                            const isMessage = payload.new.type === 'message';
                            const systemTitle = isMessage ? `New Message from ${senderName} ` : notifTitle;
                            const systemBody = isMessage ? `New message from ${senderName} ` : (notifBody || 'You have a new update');

                            // Use basic notification (no CTA text) to match native style
                            const notification = new Notification(systemTitle, {
                                body: systemBody,
                                icon: isMessage ? undefined : (notifIcon && notifIcon.startsWith('http') ? notifIcon : undefined),
                                silent: false,
                                requireInteraction: true
                            });

                            notification.onclick = function () {
                                window.focus();
                                this.close();
                            };
                        } catch (err) {
                            console.error("System notification failed:", err);
                        }
                    } else if ('Notification' in window && Notification.permission !== 'denied') {
                        console.log("Notification permission not granted yet:", Notification.permission);
                    }


                    // 3. Trigger Tab Blinking (via unreadCount or separate state?)
                    // Currently blinking depends on unreadCount > 0.
                    // If it's a task, let's artificially increment a "notificationCount" or just unreadCount if compatible? 
                    // MessageContext is "Messaging". But user wants "Task" notification to blink too.
                    // Let's simply increment unreadCount for TASKS too, or create a temporary "attention" state.
                    // For simplicity and immediate effect, I will increment unreadCount even for tasks, 
                    // BUT this `unreadCount` variable is technically for "Conversations". 
                    // Hack: momentary blink?
                    // Better: Update the blinking logic to check a broader "hasUnreadNotifications" state.
                    // For now, I'll assume unreadCount is primary driver. I won't increment it for tasks to avoid confusing the "Message" inbox count.
                    // Instead, I'll manually handle Document Title for non-message notifications briefly?
                    // No, consistent way:
                    // Only Messages affect Unread Count (Tab Title).
                    // BUT User explicitly asked "even though i got assigned a task... add this too".
                    // So I will make the blinking triggered by a local "alerts" counter or just simple effect.

                    // Let's flash the title for non-message events for 5 seconds?
                    if (payload.new.type !== 'message') {
                        let flashCount = 0;
                        const flashInterval = setInterval(() => {
                            document.title = (flashCount % 2 === 0) ? `New ${payload.new.type === 'task_assigned' ? 'Task' : 'Alert'} !` : 'Talent OPS';
                            flashCount++;
                            if (flashCount > 10) {
                                clearInterval(flashInterval);
                                document.title = 'Talent OPS';
                            }
                        }, 1000);
                    }

                    // 3. Optional: Play sound
                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.play().catch(e => console.log('Audio play failed', e));
                    } catch (e) { }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, addToast, location.pathname, navigate]); // Removed conversations dependency

    // Calculate unread count
    useEffect(() => {
        if (!conversations.length) {
            // Don't reset to 0 if we already have a count from real-time notifications
            // Only reset if this is a fresh load (lastReadTimes has entries for these convs)
            return;
        }

        let count = 0;
        let hasValidIndexes = false;

        console.log('📊 Calculating unread count...');
        console.log('📊 Conversations:', conversations.length);
        console.log('📊 LastReadTimes:', lastReadTimes);

        conversations.forEach(conv => {
            const index = conv.conversation_indexes?.[0];
            if (!index?.last_message_at) {
                console.log(`📊 Conv ${conv.id}: No last_message_at`);
                return;
            }

            hasValidIndexes = true;
            const lastMsgTime = new Date(index.last_message_at).getTime();
            const lastReadTime = lastReadTimes[conv.id] || 0;

            console.log(`📊 Conv ${conv.id}: lastMsg = ${lastMsgTime}, lastRead = ${lastReadTime}, isUnread = ${lastMsgTime > lastReadTime} `);

            if (lastMsgTime > lastReadTime) {
                count++;
            }
        });

        console.log('📊 Final calculated count:', count, 'hasValidIndexes:', hasValidIndexes);

        // Only update if we have valid index data to calculate from
        // Otherwise, keep the existing count (from real-time notifications)
        if (hasValidIndexes) {
            setUnreadCount(count);
        }
    }, [conversations, lastReadTimes]);

    const markAsRead = (conversationId) => {
        const now = Date.now();
        setLastReadTimes(prev => ({
            ...prev,
            [conversationId]: now
        }));

        // Persist to database
        if (userId && conversationId) {
            markAsReadInDB(conversationId, userId);
        }
    };

    // Dismiss a notification from the queue
    const dismissNotification = (messageId) => {
        setNotificationQueue(prev => prev.filter(n => n.id !== messageId));
    };

    // Add notification to queue (for real-time messages)
    const addNotification = (notification) => {
        setNotificationQueue(prev => {
            // Limit to max 5 notifications
            const newQueue = [notification, ...prev].slice(0, 5);
            return newQueue;
        });
    };

    // Send quick reply from notification toast
    const sendQuickReply = async (conversationId, text) => {
        if (!userId || !conversationId || !text.trim()) return;
        try {
            await sendMessage(conversationId, userId, text.trim());

            // Get recipient from conversation
            const { data: members } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .neq('user_id', userId);

            if (members?.length > 0) {
                const { data: myProfile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userId)
                    .single();

                const myName = myProfile?.full_name || 'Someone';

                // Notify all other members
                for (const member of members) {
                    await sendNotification(member.user_id, userId, myName, text, 'message');
                }
            }
            return true;
        } catch (err) {
            console.error('Quick reply error:', err);
            return false;
        }
    };

    const value = {
        unreadCount,
        conversations,
        markAsRead,
        lastReadTimes,
        notificationQueue,
        dismissNotification,
        addNotification,
        sendQuickReply,
        lastIncomingMessage,
        userId
    };

    return (
        <MessageContext.Provider value={value}>
            {children}
        </MessageContext.Provider>
    );
};
