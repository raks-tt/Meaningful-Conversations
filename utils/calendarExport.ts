import { createEvent, EventAttributes } from 'ics';
import { parseDeadline as parseDeadlineUtil } from './dateParser';

export interface CalendarEvent {
  action: string;
  deadline: string;
  description?: string;
}

export interface ParsedDeadlineResult {
  success: boolean;
  date: Date | null;
  originalDeadline: string;
  needsManualInput: boolean;
}

/**
 * Parse deadline string using the enhanced date parser
 * Returns detailed information about parsing success
 */
const parseDeadline = (deadlineStr: string): ParsedDeadlineResult => {
  // Remove common prefixes
  let cleaned = deadlineStr.replace(/^(Deadline:|bis:)\s*/i, '').trim();

  const parsedDate = parseDeadlineUtil(cleaned);

  return {
    success: parsedDate !== null,
    date: parsedDate,
    originalDeadline: deadlineStr,
    needsManualInput: parsedDate === null
  };
};

/**
 * Generate filename-safe slug from action text
 */
const generateSlug = (action: string): string => {
  return action
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
};

/**
 * Truncate text to first 3 words, adding ellipsis if truncated
 */
const truncateToThreeWords = (text: string): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= 3) {
    return words.join(' ');
  }
  return words.slice(0, 3).join(' ') + '...';
};

/**
 * Generate ICS calendar event for a single next step with explicit date
 */
export const generateCalendarEventWithDate = (
  action: string,
  deadline: Date,
  language: 'en' | 'de' = 'en',
  description?: string
): Promise<{ error?: string; value?: string; filename?: string }> => {
  return new Promise((resolve) => {
    if (!deadline || isNaN(deadline.getTime())) {
      resolve({ error: 'Invalid date provided' });
      return;
    }

    // Create shortened title (3 words max)
    const shortTitle = truncateToThreeWords(action);

    const reminderText = 'Reminder: Revisit the Meaningful Conversations app to track progress and keep your Life Context file current.';

    // Build description with full action + reminder + app link
    const eventDescription = `${action}\n\n${reminderText}\n\nhttps://mc-app.manualmode.at`;

    // Set event to 9:00 AM on the deadline day
    const eventStart: [number, number, number, number, number] = [
      deadline.getFullYear(),
      deadline.getMonth() + 1,
      deadline.getDate(),
      9,
      0
    ];

    const eventAttributes: EventAttributes = {
      start: eventStart,
      duration: { minutes: 30 },
      title: shortTitle,
      description: eventDescription,
      status: 'CONFIRMED',
      busyStatus: 'FREE',
      alarms: [
        {
          action: 'display',
          description: shortTitle,
          trigger: { hours: 24, before: true } // 1 day before
        }
      ]
    };

    createEvent(eventAttributes, (error, value) => {
      if (error) {
        resolve({ error: error.message });
        return;
      }

      const filename = `meaningful-conversations-${generateSlug(action)}.ics`;
      resolve({ value, filename });
    });
  });
};

/**
 * Generate ICS calendar event for a single next step
 * Returns parsing info if date cannot be parsed
 */
export const generateCalendarEvent = (
  event: CalendarEvent,
  language: 'en' | 'de' = 'en'
): Promise<{ error?: string; value?: string; filename?: string; needsManualInput?: boolean }> => {
  return new Promise(async (resolve) => {
    const parseResult = parseDeadline(event.deadline);

    if (parseResult.needsManualInput) {
      resolve({
        error: `Could not parse deadline: ${event.deadline}`,
        needsManualInput: true
      });
      return;
    }

    if (!parseResult.date) {
      resolve({ error: 'Failed to parse deadline' });
      return;
    }

    const result = await generateCalendarEventWithDate(
      event.action,
      parseResult.date,
      language,
      event.description
    );

    resolve(result);
  });
};

/**
 * Download ICS file to user's device
 */
export const downloadICSFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Export a single next step as calendar event
 * Returns needsManualInput if date parsing fails
 */
export const exportSingleEvent = async (
  action: string,
  deadline: string,
  language: 'en' | 'de' = 'en'
): Promise<{ success: boolean; error?: string; needsManualInput?: boolean }> => {
  const result = await generateCalendarEvent({ action, deadline }, language);

  if (result.needsManualInput) {
    return { success: false, needsManualInput: true };
  }

  if (result.error || !result.value || !result.filename) {
    return { success: false, error: result.error || 'Failed to generate calendar event' };
  }

  downloadICSFile(result.value, result.filename);
  return { success: true };
};

/**
 * Export a single next step with manually selected date
 */
export const exportSingleEventWithDate = async (
  action: string,
  deadline: Date,
  language: 'en' | 'de' = 'en'
): Promise<{ success: boolean; error?: string }> => {
  const result = await generateCalendarEventWithDate(action, deadline, language);

  if (result.error || !result.value || !result.filename) {
    return { success: false, error: result.error || 'Failed to generate calendar event' };
  }

  downloadICSFile(result.value, result.filename);
  return { success: true };
};

/**
 * Export all next steps as separate calendar files
 */
export const exportAllEvents = async (
  nextSteps: { action: string; deadline: string }[],
  language: 'en' | 'de' = 'en'
): Promise<{ success: boolean; count: number; errors: string[] }> => {
  const errors: string[] = [];
  let successCount = 0;

  for (const step of nextSteps) {
    const result = await exportSingleEvent(step.action, step.deadline, language);
    if (result.success) {
      successCount++;
    } else {
      errors.push(`${step.action}: ${result.error}`);
    }

    // Small delay between downloads to avoid browser blocking
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    success: successCount > 0,
    count: successCount,
    errors
  };
};

