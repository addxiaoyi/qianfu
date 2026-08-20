import { z } from 'zod';
export function emptyStringToUndefined(value) {
    if (typeof value === 'string' && value.trim() === '')
        return undefined;
    return value;
}
export function optionalEnv(schema) {
    return z.preprocess(emptyStringToUndefined, schema.optional());
}
//# sourceMappingURL=envParsing.js.map