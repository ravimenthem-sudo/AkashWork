# Logic Breakdown: Profile Settings & Security

This detailed breakdown analyzes the logic currently residing in `SettingsDemo.jsx` and outlines the exact plan to refactor it into secure Supabase RPCs.

---

## 1. Profile Information Update (Phone, Location, Avatar)

### 🔴 Current Frontend Logic (The Problem)
Currently, your React component directly manipulates the `profiles` table.
1.  **Direct Table Access**: It calls `.from('profiles').update(...)`. This requires the frontend to know the table name and column names.
2.  **Fragmented Updates**:
    *   When you change text details: It runs one update query.
    *   When you upload a photo: It uploads to storage, gets a connection-dependent URL, then runs *another* separate update query.
3.  **Security Risk**: You are relying on generic RLS policies. A bug in your RLS could allow a user to update *someone else's* profile.

### 🟢 Proposed RPC Solution: `update_my_profile`

We will create a single "Zero-Knowledge" RPC. The frontend just sends the values; the server handles the rest.

**The Supabase RPC Function:**
```sql
CREATE OR REPLACE FUNCTION update_my_profile(
    p_phone text,
    p_location text,
    p_avatar_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges (bypassing RLS)
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Secure user identification (Never trust the frontend ID)
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- 2. Validate Inputs (Server-side validation is safer)
    IF length(p_phone) > 20 THEN
         RETURN json_build_object('success', false, 'error', 'Phone number too long');
    END IF;

    -- 3. Perform the Update
    -- We use COALESCE for avatar_url so if checking null, we don't overwrite existing
    UPDATE public.profiles
    SET 
        phone = p_phone,
        location = p_location,
        avatar_url = COALESCE(p_avatar_url, avatar_url), -- Only update if new URL provided
        updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true);
END;
$$;
```

**How to Use in React:**
```javascript
// Old Way:
// await supabase.from('profiles').update({ phone, location }).eq('id', user.id);

// New RPC Way:
await supabase.rpc('update_my_profile', {
    p_phone: editedProfile.phone,
    p_location: editedProfile.location,
    p_avatar_url: newAvatarUrl || null // Optional
});
```

---

## 2. Password Change Logic

### 🔴 Current Frontend Logic
1.  **Local State**: Managing `currentPassword`, `newPassword`, `confirmPassword`.
2.  **Validation**: `if (new !== confirm)` and `if (length < 6)`.
3.  **Execution**: Calls `supabase.auth.updateUser({ password: ... })`.

### 🟡 The Exception: Why we keep `auth.updateUser`
**You should NOT replace Password Change with a SQL RPC.**

**Why?**
*   **Encryption**: Passwords must be hashed (bcrypt/argon2). Standard PostgreSQL RPCs usually don't handle this secure hashing automatically compatible with Supabase Auth (GoTrue).
*   **Security standard**: `supabase.auth.updateUser` is *already* a secure remote procedure call to Supabase's Auth Server. It creates a secure tunnel.
*   **Risk**: Writing your own password handling logic in SQL is extremely dangerous (risk of logging plain text passwords, weak hashing, etc.).

### 🟢 Proposed Refactor (Zero-Logic Wrapper)
While we keep the API call, we can clean up the *Frontend Logic* (validation).

1.  **Move Validation**: Ensure the validation logic (Match Check, Length Check) is rigorous.
2.  **Keep API Call**: Continue using `supabase.auth.updateUser`. It is best-In-class security.

---

## 3. Profile Photo Upload Logic

### 🔴 Current Logic
1.  Check file size in JS.
2.  Upload to `avatars` bucket.
3.  Get Public URL.
4.  Update `profiles` table (2nd DB Call).

### 🟢 Proposed "Hybrid" Strategy
We cannot move the *file upload* entirely to SQL because the browser needs to stream the binary data. However, we can fix the "Two-Step Database Update".

**The Clean Workflow:**
1.  **Frontend**: Uploads file to Storage Bucket (Allow this via Storage Policies).
2.  **Frontend**: Gets the `publicUrl`.
3.  **Frontend**: Calls `update_my_profile(..., p_avatar_url: publicUrl)`.

**Optimization**:
Currently, your code does a separate `.update` just for the avatar.
We will **Atomicize** this. The user hits "Save", and we send *everything* (Phone, Location, AND the new Avatar URL if one exists) in one single RPC call.

---

## Summary of Changes

| Feature | Action | Logic Location | Function Name |
| :--- | :--- | :--- | :--- |
| **Update Info** | **MIGRATE** | Move from React -> SQL | `update_my_profile` |
| **Update Password** | **KEEP** | Keep `auth.updateUser` | N/A (Already Secure) |
| **Update Avatar** | **MERGE** | Upload in UI -> Update DB in RPC | `update_my_profile` |

### Next Steps
1.  I can create the `update_my_profile` RPC function in your database now.
2.  Then we can refactor `SettingsDemo.jsx` to use it.
