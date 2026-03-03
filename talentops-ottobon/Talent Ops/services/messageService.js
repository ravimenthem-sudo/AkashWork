import { supabase } from '../lib/supabaseClient';

/**
 * Message Service
 * Handles all messaging-related operations with Supabase
 */

// ══════════════════════════════════════════════
//  AUTH & PROFILE HELPERS
// ══════════════════════════════════════════════

/**
 * Fetch current user and their profile with role fallback
 * @returns {Promise<{user: object, profile: object, orgId: string, role: string}>}
 */
export const fetchCurrentUserWithProfile = async () => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return null;

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('org_id, role')
            .eq('id', user.id)
            .single();

        // Fallback if profile doesn't exist or error
        const orgId = profile?.org_id || null;
        let role = profile?.role?.toLowerCase();
        if (!role || profileError) {
            role = 'executive'; // Default fallback from MessagingHub logic
        }

        return { user, profile, orgId, role };
    } catch (error) {
        console.error('Error in fetchCurrentUserWithProfile:', error);
        return null;
    }
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Function called with (event, session)
 * @returns {Object} Subscription object
 */
export const subscribeToAuthChanges = (callback) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
};

/**
 * Get conversations for a user filtered by category
 * @param {string} userId - Current user's ID
 * @param {string} category - 'myself' (DMs), 'team', or 'organization'
 * @returns {Promise<Array>} List of conversations
 */
export const getConversationsByCategory = async (userId, category, orgId) => {
    try {
        // Check if user is authenticated
        if (!userId) {
            console.warn('No user ID provided for getConversationsByCategory');
            return [];
        }

        // Step 1: Get user's conversation memberships first
        const { data: memberships, error: memberError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId);

        if (memberError) {
            console.error('Error fetching conversation memberships:', memberError);
            return [];
        }

        if (!memberships || memberships.length === 0) {
            console.log('No conversations found for user');
            return [];
        }

        const conversationIds = memberships.map(m => m.conversation_id);

        // Step 2: Get conversations the user is a member of
        let query = supabase
            .from('conversations')
            .select('*')
            .in('id', conversationIds);

        // Filter by org_id strictly
        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        // Filter by conversation type based on category
        if (category === 'myself') {
            query = query.eq('type', 'dm');
        } else if (category === 'team') {
            query = query.eq('type', 'team');
        } else if (category === 'organization') {
            query = query.eq('type', 'everyone');
        }

        const { data: conversations, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }

        if (!conversations || conversations.length === 0) {
            return [];
        }

        // Step 3: Fetch conversation indexes for these conversations
        const { data: indexes, error: indexError } = await supabase
            .from('conversation_indexes')
            .select('*')
            .in('conversation_id', conversations.map(c => c.id));

        if (indexError) {
            console.error('Error fetching conversation indexes:', indexError);
            // Return conversations without indexes rather than failing completely
            return conversations;
        }

        // Step 4: Merge indexes into conversations
        const conversationsWithIndexes = conversations.map(conv => {
            const index = indexes?.find(idx => idx.conversation_id === conv.id);
            return {
                ...conv,
                conversation_indexes: index ? [index] : []
            };
        });

        // Step 4.5: Sort by last_message_at (most recent first)
        conversationsWithIndexes.sort((a, b) => {
            const aTime = a.conversation_indexes?.[0]?.last_message_at;
            const bTime = b.conversation_indexes?.[0]?.last_message_at;

            if (!aTime && !bTime) return 0;
            if (!aTime) return 1;  // No message goes to bottom
            if (!bTime) return -1;

            return new Date(bTime) - new Date(aTime); // Newest first
        });

        // Step 5: Self-healing for missing message previews
        // If we have a timestamp but no message content, fetch it
        const brokenConversations = conversationsWithIndexes.filter(c => {
            const idx = c.conversation_indexes?.[0];
            return idx && idx.last_message_at && !idx.last_message;
        });

        if (brokenConversations.length > 0) {
            await Promise.all(brokenConversations.map(async (conv) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (msgs && msgs.length > 0) {
                    const content = msgs[0].content;
                    // Update local object immediately so UI shows it
                    if (conv.conversation_indexes[0]) {
                        conv.conversation_indexes[0].last_message = content;
                    }

                    // Background repair: Persist this fix to the DB index
                    updateConversationIndex(conv.id, content).catch(err =>
                        console.error('Failed to auto-repair conversation index:', err)
                    );
                }
            }));
        }

        return conversationsWithIndexes;
    } catch (error) {
        console.error('Error in getConversationsByCategory:', error);
        return [];
    }
};

/**
 * Get all messages for a specific conversation
 * @param {string} conversationId - ID of the conversation
 * @returns {Promise<Array>} List of messages
 */
export const getConversationMessages = async (conversationId) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                replied_to:messages!reply_to (
                    id,
                    content,
                    sender_id:sender_user_id
                ),
                attachments(*),
                message_reactions (
                    id,
                    reaction,
                    user_id
                )
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        // We also need to fetch profile names for the reactions and replied sender
        // Doing this client-side or via separate query might be cleaner than deep nested joins if RLS is tricky
        // But let's try to infer sender names from the already loaded conversation members if possible

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

/**
 * Send a new message
 * @param {string} conversationId - ID of the conversation
 * @param {string} userId - ID of the sender
 * @param {string} content - Message content
 * @param {Array} files - Optional array of files to attach
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = async (conversationId, userId, content, files = []) => {
    try {
        // Insert the message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_user_id: userId,
                sender_type: 'human',
                message_type: 'chat',
                content: content,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (messageError) throw messageError;

        // Upload attachments if any
        if (files && files.length > 0) {
            for (const file of files) {
                await uploadAttachment(file, conversationId, message.id);
            }
        }

        // Update conversation index
        // Use '[Attachment]' if no text but files were sent
        const indexMessage = content || (files && files.length > 0 ? '📎 Attachment' : '');
        await updateConversationIndex(conversationId, indexMessage);

        return message;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Upload a file attachment to Supabase Storage
 * @param {File} file - File to upload
 * @param {string} conversationId - ID of the conversation
 * @param {string} messageId - ID of the message
 * @returns {Promise<Object>} Attachment metadata
 */
export const uploadAttachment = async (file, conversationId, messageId) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${conversationId}/${fileName}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);

        // Insert attachment metadata
        const { data: attachment, error: attachmentError } = await supabase
            .from('attachments')
            .insert({
                message_id: messageId,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: filePath,
                url: publicUrl
            })
            .select()
            .single();

        if (attachmentError) throw attachmentError;

        return attachment;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        throw error;
    }
};

/**
 * Update conversation index with last message
 * @param {string} conversationId - ID of the conversation
 * @param {string} lastMessage - Last message content
 */
export const updateConversationIndex = async (conversationId, lastMessage) => {
    try {
        const { error } = await supabase
            .from('conversation_indexes')
            .upsert(
                {
                    conversation_id: conversationId,
                    last_message: lastMessage,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'conversation_id',
                    ignoreDuplicates: false
                }
            );

        if (error) throw error;
    } catch (error) {
        console.error('Error updating conversation index:', error);
        throw error;
    }
};

/**
 * Create a new DM conversation
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createDMConversation = async (userId1, userId2, orgId) => {
    try {
        // Strategy: Find existing DM between these two users regardless of org_id or context

        // 1. Get all conversation IDs for User 1
        const { data: user1Convs } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId1);

        const candidateIds = user1Convs?.map(c => c.conversation_id) || [];

        if (candidateIds.length > 0) {
            // 2. Search for a DM conversation in these candidates that ALSO includes User 2
            const { data: existingDM } = await supabase
                .from('conversations')
                .select(`
                    *,
                    conversation_members!inner(user_id)
                `)
                .in('id', candidateIds) // Must be one of User 1's conversations
                .eq('type', 'dm')       // Must be a DM
                .eq('conversation_members.user_id', userId2) // Must include User 2 (inner join filters for this)
                .maybeSingle();

            if (existingDM) {
                console.log('Found existing DM:', existingDM.id);
                return existingDM;
            }
        }

        console.log('Creating new DM conversation...');

        // Create new DM conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'dm',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add both users as members
        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert([
                { conversation_id: conversation.id, user_id: userId1 },
                { conversation_id: conversation.id, user_id: userId2 }
            ]);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating DM conversation:', error);
        throw error;
    }
};

/**
 * Create a Team conversation
 * @param {string} creatorId - User creating the team chat
 * @param {Array} memberIds - Array of user IDs to add to team
 * @param {string} teamName - Name of the team chat
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createTeamConversation = async (creatorId, memberIds, teamName, orgId) => {
    try {
        // Create team conversation with creator tracking
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'team',
                name: teamName,
                created_by: creatorId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add all members including creator
        const allMembers = [...new Set([creatorId, ...memberIds])];
        const memberInserts = allMembers.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId,
            is_admin: userId === creatorId // Creator is automatically admin
        }));

        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert(memberInserts);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating team conversation:', error);
        throw error;
    }
};

/**
 * Get or create organization-wide conversation
 * @param {string} userId - Current user's ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Organization conversation
 */
export const getOrCreateOrgConversation = async (userId, orgId) => {
    try {
        // Check if org conversation exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .eq('type', 'everyone')
            .eq('org_id', orgId)
            .maybeSingle();

        if (existing) {
            // Make sure user is a member
            const { data: membership } = await supabase
                .from('conversation_members')
                .select('id')
                .eq('conversation_id', existing.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!membership) {
                await supabase
                    .from('conversation_members')
                    .insert({ conversation_id: existing.id, user_id: userId });
            }

            return existing;
        }

        // Create new org-wide conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'everyone',
                name: 'Company Chat',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add creator as first member
        await supabase
            .from('conversation_members')
            .insert({ conversation_id: conversation.id, user_id: userId });

        return conversation;
    } catch (error) {
        console.error('Error getting/creating org conversation:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time updates for a conversation
 * @param {string} conversationId - ID of the conversation
 * @param {Function} callback - Callback function for new messages
 * @returns {Object} Subscription object
 */
export const subscribeToConversation = (conversationId, callbacks) => {
    const { onMessage, onReaction } = typeof callbacks === 'function'
        ? { onMessage: callbacks } // Backward compatibility
        : callbacks;

    const subscription = supabase
        .channel(`conversation:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                if (onMessage) onMessage(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'message_reactions'
            },
            (payload) => {
                console.log('Realtime reaction event (raw):', payload);
                if (onReaction) onReaction(payload.new || payload.old);
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'poll_votes'
            },
            (payload) => {
                if (callbacks.onPollUpdate) callbacks.onPollUpdate(payload.new || payload.old);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Unsubscribe from real-time updates
 * @param {Object} subscription - Subscription object to unsubscribe
 */
export const unsubscribeFromConversation = async (subscription) => {
    if (subscription) {
        await supabase.removeChannel(subscription);
    }
};

/**
 * Get user details for conversation display
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
export const getUserDetails = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user details:', error);
        return null;
    }
};

/**
 * Get all users in the organization for starting new DMs
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} List of users
 */
export const getOrgUsers = async (orgId) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role')
            .eq('org_id', orgId)
            .order('full_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching org users:', error);
        return [];
    }
};

/**
 * ============================================
 * GROUP ADMIN FUNCTIONS
 * ============================================
 */

/**
 * Check if a user is an admin of a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is admin
 */
export const isConversationAdmin = async (conversationId, userId) => {
    try {
        const { data, error } = await supabase
            .from('conversation_members')
            .select('is_admin')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data?.is_admin || false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

/**
 * Get all members of a conversation with their admin status
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} List of members with admin status
 */
export const getConversationMembers = async (conversationId) => {
    try {
        console.log('🔍 Fetching members for conversation:', conversationId);

        // First, get the conversation members
        const { data: memberData, error: memberError } = await supabase
            .from('conversation_members')
            .select('user_id, is_admin')
            .eq('conversation_id', conversationId);

        if (memberError) {
            console.error('❌ Error fetching conversation_members:', memberError);
            throw memberError;
        }

        console.log('✅ Found conversation_members:', memberData);

        if (!memberData || memberData.length === 0) {
            console.warn('⚠️ No members found for this conversation');
            return [];
        }

        // Then, get the profile details for each member
        const userIds = memberData.map(m => m.user_id);
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role')
            .in('id', userIds);

        if (profileError) {
            console.error('❌ Error fetching profiles:', profileError);
            throw profileError;
        }

        console.log('✅ Found profiles:', profileData);

        // Combine the data
        const members = memberData.map(member => {
            const profile = profileData.find(p => p.id === member.user_id) || {};
            return {
                id: member.user_id,
                user_id: member.user_id,
                is_admin: member.is_admin || false,
                email: profile.email || '',
                full_name: profile.full_name || 'Unknown User',
                avatar_url: profile.avatar_url || null,
                role: profile.role || ''
            };
        });

        console.log('✅ Final processed members:', members);
        return members;

    } catch (error) {
        console.error('❌ Error in getConversationMembers:', error);
        return [];
    }
};

/**
 * Get conversation members IDs only (lightweight for DM check)
 * @param {string} conversationId
 * @returns {Promise<Array>} List of {user_id} objects
 */
export const getConversationMemberIds = async (conversationId) => {
    try {
        const { data, error } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conversationId);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching member IDs:', error);
        return [];
    }
};

/**
 * Add a new member to a team conversation (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to add
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<Object>} Added member data
 */
export const addMemberToConversation = async (conversationId, userId, adminId) => {
    try {
        // Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can add members to this conversation');
        }

        // Check if user is already a member
        const { data: existing } = await supabase
            .from('conversation_members')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .maybeSingle();

        if (existing) {
            throw new Error('User is already a member of this conversation');
        }

        // Add the member
        const { data, error } = await supabase
            .from('conversation_members')
            .insert({
                conversation_id: conversationId,
                user_id: userId,
                is_admin: false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding member:', error);
        throw error;
    }
};

/**
 * Remove a member from a team conversation (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} userIdToRemove - User ID to remove
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<void>}
 */
export const removeMemberFromConversation = async (conversationId, userIdToRemove, adminId) => {
    try {
        // Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can remove members from this conversation');
        }

        // Prevent removing yourself if you're the last admin
        if (userIdToRemove === adminId) {
            const { data: admins } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('is_admin', true);

            if (admins && admins.length === 1) {
                throw new Error('Cannot remove yourself as the last admin. Promote another member first or delete the group.');
            }
        }

        const { error } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToRemove);

        if (error) throw error;
    } catch (error) {
        console.error('Error removing member:', error);
        throw error;
    }
};

/**
 * Promote a member to admin (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} userIdToPromote - User ID to promote
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<void>}
 */
export const promoteMemberToAdmin = async (conversationId, userIdToPromote, adminId) => {
    try {
        // Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can promote members to admin');
        }

        const { error } = await supabase
            .from('conversation_members')
            .update({ is_admin: true })
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToPromote);

        if (error) throw error;
    } catch (error) {
        console.error('Error promoting member:', error);
        throw error;
    }
};

/**
 * Demote an admin to regular member (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} userIdToDemote - User ID to demote
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<void>}
 */
export const demoteMemberFromAdmin = async (conversationId, userIdToDemote, adminId) => {
    try {
        // Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can demote other admins');
        }

        // Prevent demoting yourself if you're the last admin
        if (userIdToDemote === adminId) {
            const { data: admins } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('is_admin', true);

            if (admins && admins.length === 1) {
                throw new Error('Cannot demote yourself as the last admin');
            }
        }

        const { error } = await supabase
            .from('conversation_members')
            .update({ is_admin: false })
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToDemote);

        if (error) throw error;
    } catch (error) {
        console.error('Error demoting member:', error);
        throw error;
    }
};

/**
 * Rename a team conversation (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} newName - New conversation name
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<void>}
 */
export const renameConversation = async (conversationId, newName, adminId) => {
    try {
        // Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can rename this conversation');
        }

        if (!newName || newName.trim().length === 0) {
            throw new Error('Conversation name cannot be empty');
        }

        const { error } = await supabase
            .from('conversations')
            .update({ name: newName.trim() })
            .eq('id', conversationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error renaming conversation:', error);
        throw error;
    }
};

/**
 * Delete a team conversation (admin only)
 * @param {string} conversationId - Conversation ID
 * @param {string} adminId - Admin user ID performing the action
 * @returns {Promise<void>}
 */
export const deleteConversation = async (conversationId, adminId) => {
    try {
        console.log('🗑️ Starting cleanup for conversation deletion:', conversationId);

        // 1. Verify admin status
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) {
            throw new Error('Only admins can delete this conversation');
        }

        // 2. Fetch all message IDs in this conversation to clean up their children
        const { data: messages, error: msgFetchError } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conversationId);

        if (msgFetchError) throw msgFetchError;

        const messageIds = messages?.map(m => m.id) || [];
        console.log(`💬 Found ${messageIds.length} messages to clean up`);

        if (messageIds.length > 0) {
            // 3. Delete poll votes
            const { error: pollError } = await supabase
                .from('poll_votes')
                .delete()
                .in('message_id', messageIds);
            if (pollError) console.warn('Non-fatal error deleting poll votes:', pollError);

            // 4. Delete message reactions
            const { error: reactionError } = await supabase
                .from('message_reactions')
                .delete()
                .in('message_id', messageIds);
            if (reactionError) console.warn('Non-fatal error deleting reactions:', reactionError);

            // 5. Delete attachments
            const { error: attachError } = await supabase
                .from('attachments')
                .delete()
                .in('message_id', messageIds);
            if (attachError) console.warn('Non-fatal error deleting attachments:', attachError);

            // 6. Nullify reply references to avoid self-reference FK issues during batch delete
            const { error: replyError } = await supabase
                .from('messages')
                .update({ reply_to: null })
                .in('id', messageIds);
            if (replyError) console.warn('Non-fatal error nullifying replies:', replyError);

            // 7. Finally delete the messages
            const { error: msgsDeleteError } = await supabase
                .from('messages')
                .delete()
                .eq('conversation_id', conversationId);
            if (msgsDeleteError) throw msgsDeleteError;
        }

        // 8. Delete conversation members
        const { error: membersError } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId);
        if (membersError) throw membersError;

        // 9. Delete conversation index
        const { error: indexError } = await supabase
            .from('conversation_indexes')
            .delete()
            .eq('conversation_id', conversationId);
        if (indexError) {
            // Sometimes it might not exist, ignore if so
            console.log('Note: Index delete might have failed or not existed');
        }

        // 10. Finally delete the conversation itself
        const { error: convDeleteError } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId);

        if (convDeleteError) throw convDeleteError;

        console.log('✅ Conversation and all related data deleted successfully');
    } catch (error) {
        console.error('❌ Error in deleteConversation:', error);
        throw error;
    }
};

/**
 * Leave a conversation (any member)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID leaving
 * @returns {Promise<void>}
 */
export const leaveConversation = async (conversationId, userId) => {
    try {
        // Check if user is the last admin
        const isAdmin = await isConversationAdmin(conversationId, userId);

        if (isAdmin) {
            const { data: admins } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('is_admin', true);

            if (admins && admins.length === 1) {
                throw new Error('You are the last admin. Promote another member to admin before leaving, or delete the group.');
            }
        }

        const { error } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error leaving conversation:', error);
        throw error;
    }
};

/**
 * ============================================
 * MESSAGE REPLIES & REACTIONS FUNCTIONS
 * ============================================
 */

/**
 * Send a message with optional reply
 * @param {string} conversationId - Conversation ID
 * @param {string} content - Message content
 * @param {string} senderId - Sender user ID
 * @param {string} replyToId - Optional: ID of message being replied to
 * @returns {Promise<Object>} Created message
 */
export const sendMessageWithReply = async (conversationId, content, senderId, replyToId = null, repliedContent = null, repliedSender = null) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                content: content,
                sender_user_id: senderId,
                reply_to: replyToId,
                replied_message_content: repliedContent,
                replied_message_sender_name: repliedSender
            }])
            .select()
            .single();

        if (error) throw error;

        // Update conversation index to ensure sorting works
        await updateConversationIndex(conversationId, content);

        return data;
    } catch (error) {
        console.error('Error sending message with reply:', error);
        throw error;
    }
};

/**
 * Hydrate a message with full details (for realtime updates)
 * @param {string} messageId 
 * @returns {Promise<Object>} Full message object
 */
export const hydrateMessage = async (messageId) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`*, replied_to:messages!reply_to (id, content, sender_id:sender_user_id), attachments(*), message_reactions (id, reaction, user_id)`)
            .eq('id', messageId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error hydrating message:', error);
        throw error;
    }
};

/**
 * Delete a message for everyone (soft delete)
 * @param {string} messageId 
 */
export const deleteMessageForEveryone = async (messageId) => {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ content: 'This message was deleted', is_deleted: true })
            .eq('id', messageId);

        if (error) throw error;

        // Also remove attachments if any
        await supabase.from('attachments').delete().eq('message_id', messageId);

    } catch (error) {
        console.error('Error deleting message for everyone:', error);
        throw error;
    }
};

/**
 * Delete a message for me (hidden from view)
 * @param {string} messageId 
 * @param {string} userId
 */
export const deleteMessageForMe = async (messageId, userId) => {
    try {
        const { data: currentMsg } = await supabase
            .from('messages')
            .select('deleted_for')
            .eq('id', messageId)
            .single();

        const currentDeletedFor = currentMsg?.deleted_for || [];

        if (!currentDeletedFor.includes(userId)) {
            const { error } = await supabase
                .from('messages')
                .update({ deleted_for: [...currentDeletedFor, userId] })
                .eq('id', messageId);

            if (error) throw error;
        }
    } catch (error) {
        console.error('Error deleting message for me:', error);
        throw error;
    }
};

/**
 * Mark a conversation as read in the database
 */
export const markAsReadInDB = async (conversationId, userId) => {
    try {
        const { error } = await supabase
            .from('conversation_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking conversation as read in DB:', error);
    }
};

/**
 * Get message with reply context
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} Message with replied message details
 */
export const getMessageWithReply = async (messageId) => {
    try {
        const { data, error } = await supabase
            .rpc('get_message_with_reply', { message_id: messageId });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching message with reply:', error);
        return null;
    }
};

/**
 * Add a reaction to a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} reaction - Emoji reaction (e.g., '👍', '❤️')
 * @returns {Promise<Object>} Created reaction
 */
export const addReaction = async (messageId, userId, reaction) => {
    try {
        const { data, error } = await supabase
            .from('message_reactions')
            .insert([{
                message_id: messageId,
                user_id: userId,
                reaction: reaction
            }])
            .select()
            .single();

        if (error) {
            // If it's a unique constraint violation, the user already reacted with this emoji
            if (error.code === '23505') {
                console.log('User already reacted with this emoji');
                return null;
            }
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error adding reaction:', error);
        throw error;
    }
};

/**
 * Remove a reaction from a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} reaction - Emoji reaction to remove
 * @returns {Promise<void>}
 */
export const removeReaction = async (messageId, userId, reaction) => {
    try {
        const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', userId)
            .eq('reaction', reaction);

        if (error) throw error;
    } catch (error) {
        console.error('Error removing reaction:', error);
        throw error;
    }
};

/**
 * Toggle a reaction (add if not exists, remove if exists)
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} reaction - Emoji reaction
 * @returns {Promise<boolean>} True if added, false if removed
 */
export const toggleReaction = async (messageId, userId, reaction) => {
    try {
        const { error } = await supabase.rpc('toggle_reaction', {
            p_message_id: messageId,
            p_user_id: userId,
            p_reaction: reaction
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error toggling reaction:', error);
        throw error;
    }
};


/**
 * Get all reactions for a message
 * @param {string} messageId - Message ID
 * @returns {Promise<Array>} Array of reactions with user details
 */
export const getMessageReactions = async (messageId) => {
    try {
        const { data, error } = await supabase
            .from('message_reactions')
            .select(`
                id,
                reaction,
                user_id,
                created_at,
                profiles:user_id (
                    full_name,
                    email,
                    avatar_url
                )
            `)
            .eq('message_id', messageId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching message reactions:', error);
        return [];
    }
};

/**
 * Get reaction summary for a message (grouped by reaction type)
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} Object with reaction counts and user lists
 */
export const getReactionSummary = async (messageId) => {
    try {
        const reactions = await getMessageReactions(messageId);

        // Group by reaction type
        const summary = {};
        reactions.forEach(r => {
            if (!summary[r.reaction]) {
                summary[r.reaction] = {
                    count: 0,
                    users: []
                };
            }
            summary[r.reaction].count++;
            summary[r.reaction].users.push({
                user_id: r.user_id,
                name: r.profiles?.full_name || r.profiles?.email || 'Unknown'
            });
        });

        return summary;
    } catch (error) {
        console.error('Error getting reaction summary:', error);
        return {};
    }
};


/**
 * Send a poll message
 * @param {string} conversationId - Conversation ID
 * @param {string} senderId - Sender user ID
 * @param {string} question - Poll question
 * @param {Array} options - Array of string options
 * @param {boolean} allowMultiple - Whether multiple answers are allowed
 * @returns {Promise<Object>} Created message
 */
export const sendPoll = async (conversationId, senderId, question, options, allowMultiple = false) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                sender_user_id: senderId,
                content: question, // Content doubles as question for preview
                message_type: 'poll',
                is_poll: true,
                poll_question: question,
                poll_options: options,
                allow_multiple_answers: allowMultiple,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Update conversation index
        await updateConversationIndex(conversationId, `📊 Poll: ${question}`);

        return data;
    } catch (error) {
        console.error('Error sending poll:', error);
        throw error;
    }
};

/**
 * Vote in a poll
 * @param {string} messageId - Poll message ID
 * @param {string} userId - User ID
 * @param {number} optionIndex - Index of the option being voted for
 * @param {boolean} allowMultiple - Whether multiple answers are allowed
 * @returns {Promise<void>}
 */
export const voteInPoll = async (messageId, userId, optionIndex, allowMultiple = false) => {
    try {
        if (!allowMultiple) {
            // Remove any existing votes by this user for this poll
            await supabase
                .from('poll_votes')
                .delete()
                .eq('message_id', messageId)
                .eq('user_id', userId);
        }

        // Check if this specific vote already exists
        const { data: existing } = await supabase
            .from('poll_votes')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', userId)
            .eq('option_index', optionIndex)
            .maybeSingle();

        if (existing) {
            // Toggle off if it exists
            await supabase
                .from('poll_votes')
                .delete()
                .eq('id', existing.id);
        } else {
            // Add vote
            const { error } = await supabase
                .from('poll_votes')
                .insert([{
                    message_id: messageId,
                    user_id: userId,
                    option_index: optionIndex
                }]);
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error voting in poll:', error);
        throw error;
    }
};

/**
 * Get votes for a poll
 * @param {string} messageId - Poll message ID
 * @returns {Promise<Array>} Array of votes
 */
export const getPollVotes = async (messageId) => {
    try {
        const { data, error } = await supabase
            .from('poll_votes')
            .select(`
                *,
                profiles:user_id (
                    full_name,
                    email,
                    avatar_url
                )
            `)
            .eq('message_id', messageId);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching poll votes:', error);
        return [];
    }
};
