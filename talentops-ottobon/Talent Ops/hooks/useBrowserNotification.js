import React, { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Hook to handle browser notifications for real-time updates
 * @param {string} userId - The current user's ID
 */
export const useBrowserNotification = (userId, onNewNotification = null) => {
    // Use a ref to store the latest callback to avoid re-subscribing when the function changes
    const callbackRef = React.useRef(onNewNotification);

    useEffect(() => {
        callbackRef.current = onNewNotification;
    }, [onNewNotification]);

    useEffect(() => {
        // Request permission on mount
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (!userId) {
            console.log('[useBrowserNotification] No userId provided yet.');
            return;
        }

        console.log(`[useBrowserNotification] Initializing for user: ${userId}`);

        // Check if browser supports notifications
        if (!("Notification" in window)) {
            console.log("[useBrowserNotification] This browser does not support desktop notification");
            return;
        }

        if (Notification.permission !== "granted") {
            console.log('[useBrowserNotification] Permission not granted:', Notification.permission);
        } else {
            console.log('[useBrowserNotification] Permission granted.');
        }

        console.log('[useBrowserNotification] Setting up Supabase channel...');

        const channel = supabase
            .channel(`browser-notifications-${userId}`) // Unique channel name per user
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `receiver_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[useBrowserNotification] Payload received:', payload);
                    const newNotification = payload.new;

                    // Trigger callback for UI updates (e.g., updating unread count)
                    // Use the ref to get the latest callback
                    if (callbackRef.current && typeof callbackRef.current === 'function') {
                        console.log('[useBrowserNotification] invoking onNewNotification with:', newNotification);
                        callbackRef.current(newNotification);
                    }

                    // Only show if permission is granted
                    if (Notification.permission === "granted") {
                        console.log('[useBrowserNotification] Triggering notification');
                        const title = newNotification.sender_name
                            ? `New Message from ${newNotification.sender_name}`
                            : 'New Notification';

                        const body = newNotification.message || 'You have received a new notification';

                        try {
                            // Create notification
                            const notification = new Notification(title, {
                                body: body,
                                icon: '/favicon.ico', // Assuming a favicon exists, otherwise browser default
                                tag: newNotification.id, // prevent duplicates if needed
                                requireInteraction: false // Changed to false to avoid annoying sticky notifications
                            });

                            // Optional: Focus window on click
                            notification.onclick = function () {
                                window.focus();
                                this.close();
                            };
                        } catch (e) {
                            console.error('[useBrowserNotification] Error creating notification:', e);
                        }
                    } else {
                        console.log('[useBrowserNotification] Skipped notification because permission is:', Notification.permission);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[useBrowserNotification] Subscription status changed to: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[useBrowserNotification] Successfully subscribed to realtime events');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[useBrowserNotification] Realtime channel error. Check your connection or RLS policies.');
                }
                if (status === 'TIMED_OUT') {
                    console.error('[useBrowserNotification] Realtime subscription timed out.');
                }
            });

        return () => {
            console.log('[useBrowserNotification] Cleaning up subscription for', userId);
            supabase.removeChannel(channel);
        };
    }, [userId]);
};

export default useBrowserNotification;
