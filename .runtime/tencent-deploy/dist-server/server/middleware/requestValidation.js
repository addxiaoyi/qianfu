const defaultNormalizeOptions = {
    body: {
        trimStrings: true,
        emptyStringAsUndefined: true,
        nullAsUndefined: false,
    },
    query: {
        trimStrings: true,
        emptyStringAsUndefined: true,
        nullAsUndefined: true,
    },
    params: {
        trimStrings: true,
        emptyStringAsUndefined: false,
        nullAsUndefined: false,
    },
};
function isSchemaConfig(input) {
    return typeof input === 'object' && input !== null && 'schema' in input;
}
function getSchemaConfig(input) {
    if (!input)
        return null;
    return isSchemaConfig(input) ? input : { schema: input };
}
function normalizeValue(value, options) {
    if (value === null) {
        return options.nullAsUndefined ? undefined : value;
    }
    if (typeof value === 'string') {
        const trimmed = options.trimStrings ? value.trim() : value;
        if (options.emptyStringAsUndefined && trimmed === '') {
            return undefined;
        }
        return trimmed;
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item, options));
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value).map(([k, v]) => [k, normalizeValue(v, options)]);
        return Object.fromEntries(entries);
    }
    return value;
}
function formatIssues(part, issues) {
    return issues.map((issue) => ({
        source: part,
        field: issue.path.join('.') || '(root)',
        message: issue.message,
        code: issue.code,
    }));
}
function createValidationError(message, details) {
    const err = new Error(message);
    err.statusCode = 400;
    err.errorCode = 'VALIDATION_ERROR';
    err.details = details;
    err.isOperational = true;
    return err;
}
function validatePart(req, part, schemaConfig) {
    const opts = {
        ...defaultNormalizeOptions[part],
        ...(schemaConfig.options ?? {}),
    };
    const rawValue = req[part];
    const normalized = normalizeValue(rawValue, opts);
    const parsed = schemaConfig.schema.safeParse(normalized);
    if (!parsed.success) {
        throw createValidationError(schemaConfig.options?.errorMessage ?? `Invalid ${part} parameters`, formatIssues(part, parsed.error.issues));
    }
    const nextValue = opts.assignParsedData ? parsed.data : normalized;
    if (part === 'body') {
        req[part] = nextValue;
        return;
    }
    const currentValue = req[part];
    if (currentValue && typeof currentValue === 'object' && nextValue && typeof nextValue === 'object') {
        for (const key of Object.keys(currentValue)) {
            delete currentValue[key];
        }
        Object.assign(currentValue, nextValue);
        return;
    }
    req[part] = nextValue;
}
export function validateRequest(config) {
    return (req, _res, next) => {
        try {
            const bodyCfg = getSchemaConfig(config.body);
            const queryCfg = getSchemaConfig(config.query);
            const paramsCfg = getSchemaConfig(config.params);
            if (bodyCfg)
                validatePart(req, 'body', bodyCfg);
            if (queryCfg)
                validatePart(req, 'query', queryCfg);
            if (paramsCfg)
                validatePart(req, 'params', paramsCfg);
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
export function validateBody(schema, options) {
    return validateRequest({ body: { schema, options } });
}
export function validateQuery(schema, options) {
    return validateRequest({ query: { schema, options } });
}
export function validateParams(schema, options) {
    return validateRequest({ params: { schema, options } });
}
//# sourceMappingURL=requestValidation.js.map