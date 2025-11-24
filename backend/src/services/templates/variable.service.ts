/**
 * Variable Substitution Service
 *
 * Provides variable substitution for message templates.
 * Variables use {{variableName}} syntax.
 *
 * Supported variables:
 * - {{clientName}} - Client's display name
 * - {{accountantName}} - Accountant's display name
 * - {{chatTitle}} - Chat title
 * - {{date}} - Current date (DD.MM.YYYY format)
 * - {{time}} - Current time (HH:MM format)
 *
 * @module services/templates/variable
 */

/**
 * Context for variable substitution
 */
export interface VariableContext {
  /** Client's display name */
  clientName?: string;
  /** Accountant's display name */
  accountantName?: string;
  /** Chat title */
  chatTitle?: string;
  /** Date string (auto-generated if not provided) */
  date?: string;
  /** Time string (auto-generated if not provided) */
  time?: string;
}

/**
 * Pattern to match variables in template text
 * Matches {{variableName}} syntax
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Format date in Russian format (DD.MM.YYYY)
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format time in 24-hour format (HH:MM)
 *
 * @param date - Date to get time from
 * @returns Formatted time string
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get default context values
 * Auto-generates date and time if not provided
 *
 * @param context - Partial context
 * @returns Complete context with defaults
 */
function getDefaultContext(context: VariableContext): Record<string, string> {
  const now = new Date();

  return {
    clientName: context.clientName ?? '',
    accountantName: context.accountantName ?? '',
    chatTitle: context.chatTitle ?? '',
    date: context.date ?? formatDate(now),
    time: context.time ?? formatTime(now),
  };
}

/**
 * Substitute variables in template text
 *
 * Replaces {{variableName}} placeholders with values from context.
 * Unknown variables are left as-is.
 * Missing optional variables are replaced with empty string.
 *
 * @param template - Template text with {{variable}} placeholders
 * @param context - Variable values for substitution
 * @returns Text with variables substituted
 *
 * @example
 * ```typescript
 * const result = substituteVariables(
 *   'Hello {{clientName}}, your request from {{date}} is processed.',
 *   { clientName: 'John' }
 * );
 * // Returns: "Hello John, your request from 15.11.2025 is processed."
 * ```
 */
export function substituteVariables(
  template: string,
  context: VariableContext
): string {
  const values = getDefaultContext(context);

  return template.replace(VARIABLE_PATTERN, (match, variableName: string) => {
    // Return the value if exists, otherwise keep original placeholder
    if (variableName in values) {
      return values[variableName] ?? match;
    }
    return match;
  });
}

/**
 * Extract variable names from template text
 *
 * Useful for validation or showing which variables are available.
 *
 * @param template - Template text with {{variable}} placeholders
 * @returns Array of unique variable names found
 *
 * @example
 * ```typescript
 * const vars = extractVariables('Hello {{clientName}}, date: {{date}}');
 * // Returns: ['clientName', 'date']
 * ```
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(VARIABLE_PATTERN);
  const variables = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * List of supported variable names
 */
export const SUPPORTED_VARIABLES = [
  'clientName',
  'accountantName',
  'chatTitle',
  'date',
  'time',
] as const;

/**
 * Type for supported variable names
 */
export type SupportedVariable = (typeof SUPPORTED_VARIABLES)[number];

/**
 * Check if all variables in template are supported
 *
 * @param template - Template text to validate
 * @returns Object with isValid flag and any unsupported variables
 *
 * @example
 * ```typescript
 * const result = validateVariables('Hello {{unknownVar}}');
 * // Returns: { isValid: false, unsupported: ['unknownVar'] }
 * ```
 */
export function validateVariables(template: string): {
  isValid: boolean;
  unsupported: string[];
} {
  const variables = extractVariables(template);
  const supportedSet = new Set<string>(SUPPORTED_VARIABLES);
  const unsupported = variables.filter((v) => !supportedSet.has(v));

  return {
    isValid: unsupported.length === 0,
    unsupported,
  };
}

export default {
  substituteVariables,
  extractVariables,
  validateVariables,
  SUPPORTED_VARIABLES,
};
