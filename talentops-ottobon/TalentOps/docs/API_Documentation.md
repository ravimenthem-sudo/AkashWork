# API Documentation

The application uses a **Service Layer Pattern** to interact with the Supabase backend. There is no traditional REST API server; instead, the client calls Supabase directly via these service wrappers.

## 1. Message Service (`services/messageService.js`)

### `getConversationsByCategory(userId, category, orgId)`
Fetches a list of conversations for the user, filtered by type.
-   **Inputs**: `userId` (UUID), `category` ('myself'|'team'|'organization'), `orgId` (UUID)
-   **Returns**: `Promise<Conversation[]>`
-   **Logic**:
    1.  Fetches `conversation_members` for the user.
    2.  Queries `conversations` matching those IDs and the requested category.
    3.  Joins with `conversation_indexes` to get the last message snippet.
    4.  Performs client-side "healing" if index is missing but messages exist.

### `sendMessage(conversationId, userId, content, files, replyToId)`
Sends a message and handles attachments.
-   **Inputs**: `conversationId`, `userId`, `content`, `files` (File[]), `replyToId`
-   **Returns**: `Promise<Message>`
-   **Logic**:
    1.  Inserts row into `messages`.
    2.  If files exist, uploads individually via `uploadAttachment` and inserts into `attachments`.
    3.  Updates `conversation_indexes` with the new content.
    4.  Triggers `notifications` for other participants.

### `createPoll(conversationId, userId, question, options, allowMultiple)`
Creates an interactive poll in the chat.
-   **Inputs**: `conversationId`, `userId`, `question`, `options` (String[]), `allowMultiple` (Boolean)
-   **Returns**: `Promise<Message>`
-   **Logic**:
    1.  Creates a message of type `poll`.
    2.  Inserts provided options into `poll_options`.

### `votePoll(pollOptionId, userId)`
Toggles a vote for a poll option.
-   **Inputs**: `pollOptionId`, `userId`
-   **Returns**: `Promise<{ action: 'added' | 'removed' }>`
-   **Logic**:
    1.  Checks if vote exists.
    2.  If yes, deletes it (toggle off).
    3.  If no, checks poll metadata (single vs multiple choice).
    4.  If single choice, removes all other votes for this user in this poll.
    5.  Inserts new vote.

## 2. Notification Service (`services/notificationService.js`)

### `sendNotification(receiverId, senderId, senderName, message, type)`
Generic function to push a notification.
-   **Inputs**: `receiverId`, `senderId`, `senderName`, `message`, `type`
-   **Returns**: `Promise<void>`
-   **Logic**: Inserts a row into `notifications`.

## 3. Reviews Service (`services/reviews/`)

### `getOrganizationRankings(periodStart, periodType, orgId)`
Calculates leaderboard rankings based on assessments.
-   **Inputs**: `periodStart` (Date string), `periodType`, `orgId`
-   **Returns**: `Promise<RankingData[]>`
-   **Logic**:
    1.  Fetches all `employee` profiles for the org.
    2.  Fetches `student_skills_assessments` for the period.
    3.  Aggregates scores (Soft Skills + Dev Skills).
    4.  Sorts by `overall_score` descending.

### `getStudentSkillsAssessments(studentId, periodType)`
Retrieves history of assessments for a student.
-   **Inputs**: `studentId`, `periodType`
-   **Returns**: `Promise<SkillsAssessment[]>`
-   **Logic**: specific query on `student_skills_assessments` ordered by date.
