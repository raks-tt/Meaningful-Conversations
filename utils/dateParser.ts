/**
 * Date Parser Utility
 * Attempts to parse various date formats with fallback logic
 */

/**
 * Try to parse a deadline string into a Date object
 * @param deadline - The deadline string to parse (e.g., "2025-11-20", "by Wednesday", "next Friday")
 * @returns Date object if parsing succeeds, null otherwise
 */
export function parseDeadline(deadline: string): Date | null {
    if (!deadline || typeof deadline !== 'string') {
        return null;
    }

    const trimmed = deadline.trim();

    // Try ISO date format first (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try parsing with Date constructor (handles many formats)
    const attemptDate = new Date(trimmed);
    if (!isNaN(attemptDate.getTime()) && attemptDate.getFullYear() > 2000) {
        return attemptDate;
    }

    // Try relative date parsing (simple patterns)
    const now = new Date();
    const lowerDeadline = trimmed.toLowerCase();

    // Today/tomorrow
    if (lowerDeadline === 'today') {
        return now;
    }
    if (lowerDeadline === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    // "in X days"
    const inDaysMatch = lowerDeadline.match(/in\s+(\d+)\s+(day|days)/);
    if (inDaysMatch) {
        const days = parseInt(inDaysMatch[1]);
        const result = new Date(now);
        result.setDate(result.getDate() + days);
        return result;
    }

    // "in X weeks"
    const inWeeksMatch = lowerDeadline.match(/in\s+(\d+)\s+(week|weeks)/);
    if (inWeeksMatch) {
        const weeks = parseInt(inWeeksMatch[1]);
        const result = new Date(now);
        result.setDate(result.getDate() + (weeks * 7));
        return result;
    }

    // Day of week (next occurrence)
    const dayNames: { [key: string]: number } = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 0,
    };

    for (const [dayName, targetDay] of Object.entries(dayNames)) {
        if (lowerDeadline.includes(dayName)) {
            const currentDay = now.getDay();
            let daysUntil = targetDay - currentDay;
            if (daysUntil <= 0) {
                daysUntil += 7; // Next occurrence
            }
            const result = new Date(now);
            result.setDate(result.getDate() + daysUntil);
            return result;
        }
    }

    // Unable to parse
    return null;
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 * @param date - The Date object to format
 * @returns ISO date string
 */
export function formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Check if a deadline string is a valid ISO date format
 * @param deadline - The deadline string to check
 * @returns true if valid ISO format, false otherwise
 */
export function isISODateFormat(deadline: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(deadline.trim());
}

/**
 * Get a user-friendly error message for unparseable dates
 * @param language - 'en' or 'de'
 * @returns Error message string
 */
export function getDateParseErrorMessage(language: string): string {
    return 'Could not automatically recognize the date. Please select a date.';
}

