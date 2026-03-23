# Messaging Module Refactoring Plan

## Goal
To decouple the messaging module from direct Supabase dependencies, creating a clean service layer, and to resolve identified architectural issues (SRP, OCP, race conditions).

## Phase 1: Decouple Supabase (Strict Service Layer)

**Objective:** `MessagingHub.jsx` and all components must NOT import `supabase` directly. All data access must go through `messageService.js`.

### 1. Update `services/messageService.js`
Add the following missing methods to encapsulate raw queries found in `MessagingHub.jsx`:

- [ ] **`fetchCurrentUserWithProfile()`**
    - Orchestrates `supabase.auth.getUser()` + `profiles` fetch.
    - Handles the fallback logic seen in MessagingHub (defaulting role to 'executive' if profile missing).
- [ ] **`subscribeToAuthChanges(callback)`**
    - Wraps `supabase.auth.onAuthStateChange`.
- [ ] **`hydrateMessage(messageId)`**
    - Fetches full message details with foreign keys (reply_to, sender, attachments, reactions) for realtime updates.
    - Replaces raw query in `onMessage` handler.
- [ ] **`deleteMessageForEveryone(messageId)`**
    - Performs the soft delete update.
- [ ] **`deleteMessageForMe(messageId, userId)`**
    - Handles the `deleted_for` array update logic.
- [ ] **`getConversationMembersForDM(conversationId)`**
    - Optimized fetch for resolving DM names (or ensure existing `getConversationMembers` is lightweight enough).

### 2. Refactor `MessagingHub.jsx`
- [ ] Remove `import { supabase } from '../../lib/supabaseClient';`
- [ ] Replace `loadOrgUsers` raw query with `messageService.getOrgUsers(orgId)`.
- [ ] Replace auth logic with `messageService.fetchCurrentUserWithProfile()`.
- [ ] Replace realtime hydration with `messageService.hydrateMessage()`.
- [ ] Replace delete handlers with `messageService.deleteMessage...`.

---

## Phase 2: Architectural Fixes (SOLID)

### 3. Decompose `ChatWindow.jsx` (SRP)
- [ ] Extract strict UI modals into `components/shared/messaging/modals/`:
    - `MembersModal.jsx`
    - `AddMemberModal.jsx`
    - `RenameGroupModal.jsx`
    - `VoteDetailsModal.jsx`
    - `ReactionDetailsModal.jsx` (already internal, move to file)
- [ ] Refactor `ChatWindow.jsx` to import and use these modals.

### 4. Message Renderer Registry (OCP)
- [ ] Create `components/shared/messaging/renderers/`:
    - `TextRenderer.jsx`
    - `PollRenderer.jsx`
    - `DeletedRenderer.jsx`
    - `index.js` (The Registry)
- [ ] Replace `if/else` chain in `ChatWindow` with `getRenderer(msg).render()`.

### 5. Shared UI Components (DRY)
- [ ] Create `components/shared/UserAvatar.jsx`.
- [ ] Replace duplicated avatar logic in `Sidebar`, `ChatWindow`, `Composer`.

### 6. Fix Race Condition
- [ ] In `MessagingHub.jsx`, chain the initialization logic:
    ```javascript
    const init = async () => {
        const user = await service.fetchUser();
        const users = await service.getOrgUsers(user.orgId); // Wait for this
        await loadConversations(); // Then this
    }
    ```
- [ ] Remove the patch `useEffect` that watches `orgUsers`.

---

## Verification Plan

### Automated Tests
*   No existing unit tests found for messaging.
*   We will rely on manual verification as this is a refactor of existing working code.

### Manual Verification Steps
1.  **Auth & Load**: Reload page. Verify no "Unknown User" names appear (Race condition fix). Verify console has no errors.
2.  **Messaging**: Send a text message. Send a poll. Send an attachment. Verify all appear correctly (Renderer registry check).
3.  **Realtime**: Open two browsers. Send message from A. Verify B receives it (Service layer hydration check).
4.  **Admin Actions**:
    *   Create a Team Chat.
    *   Add a member (Modal extraction check).
    *   Rename group (Modal extraction check).
    *   Delete message for everyone (Service layer check).
    *   Delete message for me (Service layer check).
5.  **Supabase Auditing**: Search codebase for `supabase` import in `components/shared/messaging/`. Should yield ZERO results.
