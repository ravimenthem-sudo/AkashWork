# IMPL-001: Implementation Plan for `update_my_profile`

This document outlines the step-by-step plan to migrate the Profile Update logic from React to a secure Supabase RPC function.

## 1. Database Layer (The RPC)

We will create a new Postgres function `update_my_profile` that handles updating `phone`, `location`, and optionally `avatar_url` for the authenticated user.

### SQL Definition
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

### Permissions
We must grant execute permission to authenticated users:
```sql
GRANT EXECUTE ON FUNCTION update_my_profile(text, text, text) TO authenticated;
```

---

## 2. Frontend Layer (React Component)

We will update `SettingsDemo.jsx` to replace the direct `.from('profiles').update()` call with the new RPC call.

### Current Implementation (To Be Removed)
```javascript
const { error } = await supabase
    .from('profiles')
    .update({
        phone: editedProfile.phone,
        location: editedProfile.location
    })
    .eq('id', userProfile.id);
```

### New Implementation (To Be Added)
```javascript
const { data, error } = await supabase.rpc('update_my_profile', {
    p_phone: editedProfile.phone,
    p_location: editedProfile.location,
    p_avatar_url: newAvatarUrl || null // Optional, passed if updated
});

if (error || !data.success) {
    throw new Error(error?.message || data?.error || 'Update failed');
}
```

---

## 3. Verification Steps

1.  **Execute SQL**: Run the SQL script to create the function.
2.  **Update React**: Modify `SettingsDemo.jsx` across all roles (Employee, Manager, etc. if shared).
3.  **Test**:
    *   Change phone number -> Click Save -> verify DB update.
    *   Change location -> Click Save -> verify DB update.
    *   Upload new Avatar -> Click Save -> verify DB update.
    *   Attempt to update without login (should fail).

---

## 4. Rollback Plan

If the RPC fails or causes issues, we can revert the React component changes to use the direct `.update()` method temporarily while debugging the SQL function.
