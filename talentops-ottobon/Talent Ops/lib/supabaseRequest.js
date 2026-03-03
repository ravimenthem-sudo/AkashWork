
/**
 * Helper function to handle Supabase requests with consistent error handling and logging.
 * @param requestPromise - The Supabase query promise (e.g., supabase.from('...').select())
 * @param addToast - Optional toast function to show user-friendly error messages
 * @returns The data from the response or throws an error
 */
export const supabaseRequest = async (requestPromise, addToast = null) => {
    try {
        const { data, error } = await requestPromise;

        if (error) {
            console.error('Supabase Data Error:', error);
            if (addToast) {
                addToast(`Data Error: ${error.message || 'Failed to fetch data'}`, 'error');
            }
            throw error;
        }

        return data;
    } catch (err) {
        // If it's not a Supabase error object (which we just threw), log it
        if (!err.code && !err.message) {
            console.error('Unexpected Request Error:', err);
        }

        // Re-throw so the caller can handle specific logic if needed
        throw err;
    }
};
