/**
 * Currency Utilities - Integer-based amount handling
 *
 * All amounts are stored as integers in "fen" (Chinese cents = 1/100 of yuan).
 * This eliminates floating-point precision issues in financial calculations.
 *
 * Usage:
 * - Input (API/UI): User enters yuan (e.g., 10.50)
 * - Storage (DB): Store as fen (e.g., 1050)
 * - Output (API/UI): Display yuan (e.g., 10.50)
 */
/**
 * Convert fen (integer) to yuan (for display)
 * @param fen Amount in fen (integer)
 * @returns Formatted yuan string with 2 decimal places
 */
export declare const fenToYuan: (fen: number) => string;
/**
 * Convert yuan to fen (for storage)
 * @param yuan Amount in yuan (number or string)
 * @returns Amount in fen (integer, rounded)
 */
export declare const yuanToFen: (yuan: number | string) => number;
/**
 * Format fen amount for display with currency symbol
 * @param fen Amount in fen (integer)
 * @param currency Currency code (default: CNY)
 * @returns Formatted currency string
 */
export declare const formatCurrency: (fen: number, currency?: string) => string;
/**
 * Format fen amount for API responses (yuan with 2 decimal places)
 * @param fen Amount in fen (integer)
 * @returns Amount in yuan as number
 */
export declare const fenToYuanNumber: (fen: number) => number;
/**
 * Parse and validate amount input, convert to fen
 * @param input Amount in yuan (from user/API input)
 * @returns Amount in fen (integer)
 * @throws Error if amount is invalid or negative
 */
export declare const parseAmount: (input: number | string) => number;
/**
 * Check if two fen amounts are equal
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns True if equal
 */
export declare const fenEquals: (a: number, b: number) => boolean;
/**
 * Add two fen amounts
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns Sum in fen
 */
export declare const fenAdd: (a: number, b: number) => number;
/**
 * Subtract fen amounts (b from a)
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns Difference in fen
 */
export declare const fenSubtract: (a: number, b: number) => number;
//# sourceMappingURL=currency.d.ts.map