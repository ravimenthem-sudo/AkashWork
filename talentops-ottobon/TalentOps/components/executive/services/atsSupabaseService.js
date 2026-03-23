import { supabase } from '../../../lib/supabaseClient';



const toCamel = (o, table) => {
    if (!o) return o;
    const newO = {};
    for (const key in o) {
        let newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

        if (key === 'applied_date') newKey = 'appliedAt';
        if (key === 'requirements' && !o.skills) newKey = 'skills';
        if (table === 'jobs' && key === 'type') newKey = 'employmentType';
        if (table === 'interviews' && key === 'type') newKey = 'panelType';
        if (table === 'interviews' && key === 'date') newKey = 'scheduledAt';
        if (table === 'candidates' && key === 'job_id') newKey = 'jobId';
        if (table === 'candidates' && key === 'job_title') newKey = 'jobTitle';

        if (table === 'audit_log' && key === 'entity_type') newKey = 'entity';

        if (table === 'interviews' && key === 'notes' && typeof o[key] === 'string' && o[key].includes('__METADATA__')) {
            const parts = o[key].split('__METADATA__\n');
            newO['notes'] = parts[0].trim();
            try {
                const metadata = JSON.parse(parts[1]);
                Object.assign(newO, metadata);
            } catch (e) {
                console.error("Failed to parse metadata from notes", e);
            }
            continue;
        }

        newO[newKey] = o[key];
    }
    return newO;
};

const toSnake = (o, table) => {
    if (!o) return o;
    const newO = {};
    for (const key in o) {
        let newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

        if (table === 'interviews' && key === 'scheduledAt') {
            newO['date'] = o[key];
            if (o[key] && o[key].includes('T')) {
                newO['time'] = o[key].split('T')[1].replace('Z', '');
            } else {
                newO['time'] = o[key];
            }
            continue;
        }

        if (table === 'jobs' && key === 'employmentType') newKey = 'type';
        if (table === 'interviews' && key === 'panelType') newKey = 'type';
        if (key === 'appliedAt') newKey = 'applied_date';
        if (key === 'jobId') newKey = 'job_id';
        if (key === 'jobTitle') newKey = 'job_title';

        if (table === 'audit_log' && key === 'entity') newKey = 'entity_type';

        newO[newKey] = o[key];
    }
    return newO;
};

export const getItems = async (table) => {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) {
        // console.error(`Error fetching ${table}:`, error); // Suppress error for now as tables might not exist yet
        return [];
    }
    return data.map(item => toCamel(item, table));
};

export const addItem = async (table, item, userId) => {
    const snakeItem = toSnake(item, table);
    delete snakeItem.id;

    const { data, error } = await supabase.from(table).insert([snakeItem]).select().single();
    if (error) throw error;

    await addAuditEntry({
        action: 'CREATE',
        entity: table,
        entityId: data.id,
        userId,
        details: `Created ${table}: ${item.title || item.name || 'item'}`
    });

    return toCamel(data, table);
};

export const updateItem = async (table, id, updates, userId) => {
    const snakeUpdates = toSnake(updates, table);
    const { data, error } = await supabase.from(table).update(snakeUpdates).eq('id', id).select().single();
    if (error) throw error;

    await addAuditEntry({
        action: 'UPDATE',
        entity: table,
        entityId: id,
        userId,
        details: `Updated ${table}`,
        changes: updates
    });

    return toCamel(data, table);
};

export const deleteItem = async (table, id, userId) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;

    await addAuditEntry({
        action: 'DELETE',
        entity: table,
        entityId: id,
        userId,
        details: `Deleted ${table} item ${id}`
    });
    return true;
};

export const addAuditEntry = async (entry) => {
    try {
        const snakeEntry = toSnake(entry, 'audit_log');
        const { error } = await supabase.from('audit_log').insert([snakeEntry]);
        if (error) console.error('Error logging audit:', error);
    } catch (e) {
        // Ignore audit errors
    }
};

export const getAuditLog = async (filters = {}) => {
    let query = supabase.from('audit_log').select('*').order('timestamp', { ascending: false });

    if (filters.entity) query = query.eq('entity_type', filters.entity);
    if (filters.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.action) query = query.eq('action', filters.action);

    const { data, error } = await query;
    if (error) return [];
    return data.map(item => toCamel(item, 'audit_log'));
};

export const uploadResume = async (file, candidateId) => {
    const timestamp = Date.now();
    const filePath = `candidates/${candidateId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Upload Error:', uploadError);
        throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);

    const updates = {
        resume_url: publicUrl,
    };

    const { data: updatedCandidate, error: updateError } = await supabase
        .from('candidates')
        .update(toSnake(updates))
        .eq('id', candidateId)
        .select()
        .single();

    if (updateError) {
        console.error('Update Candidate Error:', updateError);
        throw updateError;
    }

    await addAuditEntry({
        action: 'UPDATE',
        entity: 'candidates',
        entityId: candidateId,
        userId: (await supabase.auth.getUser()).data.user?.id,
        details: `Uploaded resume for candidate`
    });

    return toCamel(updatedCandidate);
};

export const checkConnection = async () => {
    try {
        const { error } = await supabase.from('jobs').select('count', { count: 'exact', head: true });
        return !error;
    } catch (e) {
        return false;
    }
};
