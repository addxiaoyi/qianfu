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
export const fenToYuan = (fen) => {
    return (fen / 100).toFixed(2);
};
/**
 * Convert yuan to fen (for storage)
 * @param yuan Amount in yuan (number or string)
 * @returns Amount in fen (integer, rounded)
 */
export const yuanToFen = (yuan) => {
    const num = typeof yuan === 'string' ? parseFloat(yuan) : yuan;
    if (!Number.isFinite(num)) {
        throw new Error(`Invalid yuan amount: ${yuan}`);
    }
    return Math.round(num * 100);
};
/**
 * Format fen amount for display with currency symbol
 * @param fen Amount in fen (integer)
 * @param currency Currency code (default: CNY)
 * @returns Formatted currency string
 */
export const formatCurrency = (fen, currency = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency,
    }).format(fen / 100);
};
/**
 * Format fen amount for API responses (yuan with 2 decimal places)
 * @param fen Amount in fen (integer)
 * @returns Amount in yuan as number
 */
export const fenToYuanNumber = (fen) => {
    return Number((fen / 100).toFixed(2));
};
/**
 * Parse and validate amount input, convert to fen
 * @param input Amount in yuan (from user/API input)
 * @returns Amount in fen (integer)
 * @throws Error if amount is invalid or negative
 */
export const parseAmount = (input) => {
    const yuan = typeof input === 'string' ? parseFloat(input) : input;
    if (!Number.isFinite(yuan) || yuan < 0) {
        throw new Error(`Invalid amount: ${input}`);
    }
    return Math.round(yuan * 100);
};
/**
 * Check if two fen amounts are equal
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns True if equal
 */
export const fenEquals = (a, b) => {
    return a === b;
};
/**
 * Add two fen amounts
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns Sum in fen
 */
export const fenAdd = (a, b) => {
    return a + b;
};
/**
 * Subtract fen amounts (b from a)
 * @param a First amount in fen
 * @param b Second amount in fen
 * @returns Difference in fen
 */
export const fenSubtract = (a, b) => {
    return a - b;
};
//# sourceMappingURL=currency.js.map