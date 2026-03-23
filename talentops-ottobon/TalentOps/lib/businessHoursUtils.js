/**
 * Business Hours Utility Functions
 * 
 * Calculates task due dates based on business hours (work hours only).
 * Default: 9 AM to 6 PM, Monday-Friday
 */

// Default organization settings
const DEFAULT_SETTINGS = {
    work_start_time: '09:00:00',
    work_end_time: '18:00:00',
    exclude_weekends: true
};

/**
 * Parse time string (HH:MM:SS) to hours and minutes
 */
function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
}

/**
 * Get work hours per day based on start and end time
 */
function getWorkHoursPerDay(settings = DEFAULT_SETTINGS) {
    const start = parseTime(settings.work_start_time || DEFAULT_SETTINGS.work_start_time);
    const end = parseTime(settings.work_end_time || DEFAULT_SETTINGS.work_end_time);
    return (end.hours + end.minutes / 60) - (start.hours + start.minutes / 60);
}

/**
 * Check if a given day is a work day
 */
function isWorkDay(date, settings = DEFAULT_SETTINGS) {
    const day = date.getDay();
    if (settings.exclude_weekends !== false) {
        // 0 = Sunday, 6 = Saturday
        return day !== 0 && day !== 6;
    }
    return true;
}

/**
 * Check if current time is within business hours
 */
export function isWithinBusinessHours(date, settings = DEFAULT_SETTINGS) {
    if (!isWorkDay(date, settings)) {
        return false;
    }

    const start = parseTime(settings.work_start_time || DEFAULT_SETTINGS.work_start_time);
    const end = parseTime(settings.work_end_time || DEFAULT_SETTINGS.work_end_time);

    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get the next business day start time
 */
export function getNextBusinessDayStart(date, settings = DEFAULT_SETTINGS) {
    const start = parseTime(settings.work_start_time || DEFAULT_SETTINGS.work_start_time);
    const result = new Date(date);

    // Move to next day
    result.setDate(result.getDate() + 1);
    result.setHours(start.hours, start.minutes, 0, 0);

    // Skip weekends if needed
    while (!isWorkDay(result, settings)) {
        result.setDate(result.getDate() + 1);
    }

    return result;
}

/**
 * Calculate due date/time based on allocated hours and business hours
 * 
 * @param {Date} startDate - When the task is being created/assigned
 * @param {number} allocatedHours - Total hours allocated for the task
 * @param {Object} settings - Organization settings with work hours
 * @returns {Object} - { dueDate: 'YYYY-MM-DD', dueTime: 'HH:MM:SS' }
 */
export function calculateDueDateTime(startDate, allocatedHours, settings = DEFAULT_SETTINGS) {
    if (!allocatedHours || allocatedHours <= 0) {
        // No allocated hours, return end of today
        const result = new Date(startDate);
        const end = parseTime(settings.work_end_time || DEFAULT_SETTINGS.work_end_time);
        result.setHours(end.hours, end.minutes, 0, 0);
        return {
            dueDate: result.toISOString().split('T')[0],
            dueTime: settings.work_end_time || DEFAULT_SETTINGS.work_end_time
        };
    }

    const start = parseTime(settings.work_start_time || DEFAULT_SETTINGS.work_start_time);
    const end = parseTime(settings.work_end_time || DEFAULT_SETTINGS.work_end_time);
    const workHoursPerDay = getWorkHoursPerDay(settings);

    let remainingHours = allocatedHours;
    let currentDate = new Date(startDate);

    // If starting outside work hours, move to next work period
    if (!isWithinBusinessHours(currentDate, settings)) {
        // If before work hours today and it's a work day
        if (isWorkDay(currentDate, settings)) {
            const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
            const startMinutes = start.hours * 60 + start.minutes;

            if (currentMinutes < startMinutes) {
                // Before work hours - start at work_start_time today
                currentDate.setHours(start.hours, start.minutes, 0, 0);
            } else {
                // After work hours - start next work day
                currentDate = getNextBusinessDayStart(currentDate, settings);
            }
        } else {
            // Weekend - move to next work day
            currentDate = getNextBusinessDayStart(currentDate, settings);
        }
    }

    // Calculate how many hours left in current work day
    const endMinutes = end.hours * 60 + end.minutes;
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const hoursLeftToday = (endMinutes - currentMinutes) / 60;

    if (remainingHours <= hoursLeftToday) {
        // Task can be completed today
        currentDate.setMinutes(currentDate.getMinutes() + remainingHours * 60);
    } else {
        // Need multiple days
        remainingHours -= hoursLeftToday;

        // Move to next work day
        currentDate = getNextBusinessDayStart(currentDate, settings);

        // Add full work days
        while (remainingHours > workHoursPerDay) {
            remainingHours -= workHoursPerDay;
            currentDate = getNextBusinessDayStart(currentDate, settings);
        }

        // Add remaining hours to final day
        currentDate.setMinutes(currentDate.getMinutes() + remainingHours * 60);
    }

    // Format output
    const dueDate = currentDate.toISOString().split('T')[0];
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const dueTime = `${hours}:${minutes}:00`;

    return { dueDate, dueTime };
}

/**
 * Calculate elapsed business hours between two dates
 */
export function calculateElapsedBusinessHours(startDate, endDate, settings = DEFAULT_SETTINGS) {
    if (endDate <= startDate) return 0;

    const start = parseTime(settings.work_start_time || DEFAULT_SETTINGS.work_start_time);
    const end = parseTime(settings.work_end_time || DEFAULT_SETTINGS.work_end_time);
    const workHoursPerDay = getWorkHoursPerDay(settings);

    let totalHours = 0;
    let current = new Date(startDate);

    while (current < endDate) {
        if (isWorkDay(current, settings)) {
            const dayStart = new Date(current);
            dayStart.setHours(start.hours, start.minutes, 0, 0);

            const dayEnd = new Date(current);
            dayEnd.setHours(end.hours, end.minutes, 0, 0);

            // Calculate overlap with work hours
            const effectiveStart = current > dayStart ? current : dayStart;
            const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;

            if (effectiveEnd > effectiveStart) {
                totalHours += (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
            }
        }

        // Move to next day at work start time
        current.setDate(current.getDate() + 1);
        current.setHours(start.hours, start.minutes, 0, 0);
    }

    return totalHours;
}

export default {
    calculateDueDateTime,
    isWithinBusinessHours,
    getNextBusinessDayStart,
    calculateElapsedBusinessHours,
    DEFAULT_SETTINGS
};
