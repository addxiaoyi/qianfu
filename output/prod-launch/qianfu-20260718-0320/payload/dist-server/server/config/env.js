import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string().min(1).refine((value) => {
        if (value.startsWith('file:'))
            return true;
        try {
            new URL(value);
            return true;
        }
        catch {
            return false;
        }
    }, 'DATABASE_URL must be a valid URL or file: path'),
    JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters for security"),
    ADMIN_TOKEN: z.string().min(16, "ADMIN_TOKEN should be at least 16 characters"),
    LOCAL_AUTH_ONLY: z.enum(['true', 'false']).default('false'),
    SUPERTOKENS_CONNECTION_URI: z.string().optional(),
    SUPERTOKENS_API_KEY: z.string().optional(),
    API_PUBLIC_URL: z.string().url().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    FRONTEND_URL: z.string().url().default('http://localhost:4123'),
    COOKIE_DOMAIN: z.string().optional(),
    WAF_ENABLED: z.string().default('false'),
    TRUST_PROXY: z.string().default('false'),
    FORCE_HTTPS: z.string().default('false'),
});
const parsed = envSchema.safeParse(process.env);
// Create a simple logger for env validation (before full logger is loaded)
const envLogger = {
    error: (msg, meta) => {
        console.error(`[ENV] ${msg}`, meta || '');
    }
};
if (!parsed.success) {
    envLogger.error('Invalid environment variables', { errors: parsed.error.format() });
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}
export const env = parsed.success ? parsed.data : process.env;
//# sourceMappingURL=env.js.map