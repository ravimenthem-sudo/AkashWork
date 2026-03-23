import { supabase } from '../../../lib/supabaseClient';

// ==================== CLIENT OPERATIONS ====================

// Get all clients
export const getClients = async (orgId) => {
    try {
        let query = supabase
            .from('clients')
            .select('*')
            .order('name');

        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching clients:', error);
        return { data: null, error };
    }
};

// Create a new client
export const createClient = async (clientData) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .insert([clientData])
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error creating client:', error);
        return { data: null, error };
    }
};

// Update a client
export const updateClient = async (clientId, updates) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', clientId)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error updating client:', error);
        return { data: null, error };
    }
};

// Delete a client
export const deleteClient = async (clientId) => {
    try {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', clientId);

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Error deleting client:', error);
        return { error };
    }
};

// ==================== INVOICE OPERATIONS ====================

// Get next invoice number
export const getNextInvoiceNumber = async (orgId) => {
    try {
        // Month names array
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        // Get current month and year
        const now = new Date();
        const month = monthNames[now.getMonth()];
        const year = String(now.getFullYear()).slice(-2);
        const prefix = `INV-${month}${year}`;

        // Get invoices from current month/year
        let query = supabase
            .from('invoices')
            .select('invoice_number')
            .like('invoice_number', `${prefix}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            return { data: `${prefix}-01`, error: null };
        }

        // Extract number from last invoice (e.g., "INV-1224-01" -> 1)
        const lastNumber = data[0].invoice_number;
        const match = lastNumber.match(/-(\d+)$/);

        if (match) {
            const nextNum = parseInt(match[1]) + 1;
            const paddedNum = String(nextNum).padStart(2, '0');
            return { data: `${prefix}-${paddedNum}`, error: null };
        }

        return { data: `${prefix}-01`, error: null };
    } catch (error) {
        console.error('Error getting next invoice number:', error);
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const now = new Date();
        const month = monthNames[now.getMonth()];
        const year = String(now.getFullYear()).slice(-2);
        return { data: `INV-${month}${year}-01`, error };
    }
};

// Create a new invoice with items
export const createInvoice = async (invoiceData) => {
    try {
        // Prepare invoice data
        const invoice = {
            org_id: invoiceData.org_id,
            invoice_number: invoiceData.invoice_number,
            client_id: invoiceData.client_id || null,
            invoice_date: invoiceData.invoice_date,
            due_date: invoiceData.due_date,
            currency: invoiceData.currency,
            subtotal: invoiceData.subtotal,
            tax_percent: invoiceData.tax_percent || 0,
            tax_amount: invoiceData.tax_amount,
            total_amount: invoiceData.total_amount,
            status: invoiceData.status || 'draft',
            notes: invoiceData.notes || null,
            template_id: invoiceData.template_id || null
        };

        // Insert invoice
        const { data: invoiceResult, error: invoiceError } = await supabase
            .from('invoices')
            .insert([invoice])
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // Insert invoice items
        if (invoiceData.items && invoiceData.items.length > 0) {
            const items = invoiceData.items.map(item => ({
                invoice_id: invoiceResult.id,
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.amount
            }));

            const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(items);

            if (itemsError) throw itemsError;
        }

        return { data: invoiceResult, error: null };
    } catch (error) {
        console.error('Error creating invoice:', error);
        return { data: null, error };
    }
};

// Get all invoices
export const getInvoices = async (orgId) => {
    try {
        let query = supabase
            .from('invoices')
            .select(`
        *,
        clients (
          name,
          email,
          company_name
        )
      `)
            .order('created_at', { ascending: false });

        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return { data: null, error };
    }
};

// Get a single invoice with items and client
export const getInvoice = async (invoiceId) => {
    try {
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
        *,
        clients (*)
      `)
            .eq('id', invoiceId)
            .single();

        if (invoiceError) throw invoiceError;

        const { data: items, error: itemsError } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId);

        if (itemsError) throw itemsError;

        return { data: { ...invoice, items }, error: null };
    } catch (error) {
        console.error('Error fetching invoice:', error);
        return { data: null, error };
    }
};

// Update an invoice
export const updateInvoice = async (invoiceId, updates) => {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .update(updates)
            .eq('id', invoiceId)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error updating invoice:', error);
        return { data: null, error };
    }
};

// Delete an invoice
export const deleteInvoice = async (invoiceId) => {
    try {
        // Delete invoice items first (cascade)
        await supabase
            .from('invoice_items')
            .delete()
            .eq('invoice_id', invoiceId);

        // Delete invoice
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', invoiceId);

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return { error };
    }
};

// ==================== STORAGE OPERATIONS ====================

// Upload company logo
export const uploadCompanyLogo = async (file) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('company-logos')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('company-logos')
            .getPublicUrl(fileName);

        return { data: publicUrl, error: null };
    } catch (error) {
        console.error('Error uploading logo:', error);
        return { data: null, error };
    }
};

// Upload invoice PDF to templates bucket in invoices folder
export const uploadInvoicePDF = async (invoiceNumber, pdfBlob) => {
    try {
        console.log('[uploadInvoicePDF] Starting upload...');
        console.log('[uploadInvoicePDF] Invoice Number:', invoiceNumber);
        console.log('[uploadInvoicePDF] PDF Blob size:', pdfBlob.size, 'bytes');

        // Upload to templates bucket, inside invoices folder
        const fileName = `invoices/${invoiceNumber}.pdf`;
        console.log('[uploadInvoicePDF] Target path:', fileName);
        console.log('[uploadInvoicePDF] Target bucket: templates');

        const { data, error } = await supabase.storage
            .from('templates')
            .upload(fileName, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        console.log('[uploadInvoicePDF] Upload response:', { data, error });

        if (error) {
            console.error('[uploadInvoicePDF] Upload error:', error);
            throw error;
        }

        console.log('[uploadInvoicePDF] Upload successful, getting signed URL...');

        // Get signed URL with 1 year expiry (31536000 seconds)
        // This provides long-term access while maintaining security
        const oneYearInSeconds = 365 * 24 * 60 * 60; // 31536000 seconds
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('templates')
            .createSignedUrl(fileName, oneYearInSeconds);

        if (signedUrlError) {
            console.error('[uploadInvoicePDF] Signed URL error:', signedUrlError);
            throw signedUrlError;
        }

        console.log('[uploadInvoicePDF] Signed URL (1 year expiry):', signedUrlData.signedUrl);

        return { data: signedUrlData.signedUrl, error: null };
    } catch (error) {
        console.error('[uploadInvoicePDF] FATAL ERROR:', error);
        console.error('[uploadInvoicePDF] Error type:', error.constructor.name);
        console.error('[uploadInvoicePDF] Error message:', error.message);
        console.error('[uploadInvoicePDF] Full error:', JSON.stringify(error, null, 2));
        return { data: null, error };
    }
};

// ==================== TEMPLATE OPERATIONS ====================

// Get all templates
export const getTemplates = async () => {
    try {
        const { data, error } = await supabase
            .from('invoice_templates')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching templates:', error);
        return { data: null, error };
    }
};

// Get default template
export const getDefaultTemplate = async () => {
    try {
        const { data, error } = await supabase
            .from('invoice_templates')
            .select('*')
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching default template:', error);
        return { data: null, error };
    }
};
