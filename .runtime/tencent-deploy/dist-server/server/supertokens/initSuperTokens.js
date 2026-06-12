import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import ThirdParty from 'supertokens-node/recipe/thirdparty';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { syncPrismaUserFromSuperTokens } from '../services/supertokensPrismaSync.js';
import { sendSuperTokensPasswordResetEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';
function emailConfiguredForApp() {
    return Boolean(process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.BREVO_API_KEY);
}
function websiteDomain() {
    return process.env.FRONTEND_URL || 'http://localhost:4123';
}
function apiDomain() {
    return process.env.API_PUBLIC_URL || websiteDomain();
}
function githubConfigured() {
    return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}
function qqConfigured() {
    return Boolean(process.env.QQ_CLIENT_ID?.trim() && process.env.QQ_CLIENT_SECRET?.trim());
}
export function initSuperTokens() {
    const connectionURI = process.env.SUPERTOKENS_CONNECTION_URI || 'http://127.0.0.1:3567';
    const apiKey = process.env.SUPERTOKENS_API_KEY?.trim() || undefined;
    const recipeList = [
        EmailPassword.init({
            ...(emailConfiguredForApp()
                ? {
                    emailDelivery: {
                        service: {
                            sendEmail: async (input) => {
                                if (input.type === 'PASSWORD_RESET') {
                                    await sendSuperTokensPasswordResetEmail(input.user.email, input.passwordResetLink);
                                }
                            },
                        },
                    },
                }
                : {}),
            override: {
                apis: (oi) => ({
                    ...oi,
                    signUpPOST: async (input) => {
                        const response = await oi.signUpPOST(input);
                        if (response.status === 'OK') {
                            try {
                                const emailField = String(input.formFields.find((f) => f.id === 'email')?.value ?? '');
                                const email = response.user.emails[0] || emailField;
                                await syncPrismaUserFromSuperTokens(response.user.id, email, { emailVerified: false });
                            }
                            catch (e) {
                                logger.error('[SuperTokens] Prisma sync after signUp failed:', e);
                            }
                        }
                        return response;
                    },
                    signInPOST: async (input) => {
                        const response = await oi.signInPOST(input);
                        if (response.status === 'OK') {
                            try {
                                const email = response.user.emails[0] ||
                                    input.formFields.find((f) => f.id === 'email')?.value ||
                                    '';
                                await syncPrismaUserFromSuperTokens(response.user.id, email, { emailVerified: false });
                            }
                            catch (e) {
                                logger.error('[SuperTokens] Prisma sync after signIn failed:', e);
                            }
                        }
                        return response;
                    },
                }),
            },
        }),
    ];
    if (githubConfigured() || qqConfigured()) {
        const providers = [];
        if (githubConfigured()) {
            providers.push({
                config: {
                    thirdPartyId: 'github',
                    clients: [
                        {
                            clientType: 'web',
                            clientId: process.env.GITHUB_CLIENT_ID,
                            clientSecret: process.env.GITHUB_CLIENT_SECRET,
                        },
                    ],
                },
            });
        }
        if (qqConfigured()) {
            providers.push({
                config: {
                    thirdPartyId: 'qq',
                    name: 'QQ',
                    authorizationEndpoint: 'https://graph.qq.com/oauth2.0/authorize',
                    tokenEndpoint: 'https://graph.qq.com/oauth2.0/token',
                    tokenEndpointBodyParams: {
                        fmt: 'json',
                    },
                    userInfoEndpoint: 'https://graph.qq.com/user/get_user_info',
                    userInfoEndpointQueryParams: {
                        fmt: 'json',
                    },
                    userInfoMap: {
                        fromUserInfoAPI: {
                            userId: 'openid',
                        },
                    },
                    clients: [
                        {
                            clientType: 'web',
                            clientId: process.env.QQ_CLIENT_ID,
                            clientSecret: process.env.QQ_CLIENT_SECRET,
                            scope: ['get_user_info'],
                        },
                    ],
                    requireEmail: false,
                    generateFakeEmail: async ({ thirdPartyUserId, tenantId }) => {
                        const safeTenant = tenantId.replace(/[^a-zA-Z0-9._-]/g, '_');
                        return `qq_${thirdPartyUserId}@${safeTenant}.qq.oauth.local`;
                    },
                },
                // 保持默认 provider 实现，避免与第三方类型定义耦合导致类型漂移。
                // QQ openid 通过 userInfoMap/fromUserInfoAPI 映射 userId。
            });
        }
        recipeList.push(ThirdParty.init({
            signInAndUpFeature: {
                providers,
            },
            override: {
                apis: (oi) => ({
                    ...oi,
                    signInUpPOST: async (input) => {
                        const response = await oi.signInUpPOST(input);
                        if (response.status === 'OK') {
                            try {
                                const fromApi = response.rawUserInfoFromProvider.fromUserInfoAPI;
                                const provider = input.provider.id;
                                const name = (typeof fromApi?.name === 'string' && fromApi.name) ||
                                    (typeof fromApi?.nickname === 'string' && fromApi.nickname) ||
                                    (typeof fromApi?.login === 'string' && fromApi.login) ||
                                    undefined;
                                const picture = (typeof fromApi?.avatar_url === 'string' && fromApi.avatar_url) ||
                                    (typeof fromApi?.figureurl_qq_2 === 'string' && fromApi.figureurl_qq_2) ||
                                    (typeof fromApi?.figureurl_qq_1 === 'string' && fromApi.figureurl_qq_1) ||
                                    (typeof fromApi?.figureurl_2 === 'string' && fromApi.figureurl_2) ||
                                    undefined;
                                const email = response.user.emails[0] || '';
                                await syncPrismaUserFromSuperTokens(response.user.id, email, {
                                    name,
                                    picture,
                                    emailVerified: true,
                                });
                                logger.info(`[SuperTokens] Synced user profile from ${provider} OAuth`, {
                                    recipeUserId: response.user.id,
                                    provider,
                                });
                            }
                            catch (e) {
                                logger.error('[SuperTokens] Prisma sync after OAuth signInUp failed:', e);
                            }
                        }
                        return response;
                    },
                }),
            },
        }));
    }
    else {
        logger.info('[SuperTokens] Third-party OAuth disabled (configure GitHub and/or QQ credentials to enable)');
    }
    recipeList.push(Session.init({
        getTokenTransferMethod: () => 'cookie',
    }));
    supertokens.init({
        framework: 'express',
        supertokens: {
            connectionURI,
            ...(apiKey ? { apiKey } : {}),
        },
        appInfo: {
            appName: process.env.SUPERTOKENS_APP_NAME || 'QianFu',
            apiDomain: apiDomain(),
            websiteDomain: websiteDomain(),
            apiBasePath: '/auth',
            websiteBasePath: '/',
        },
        recipeList,
    });
    logger.info('[SuperTokens] Initialized', {
        connectionURI,
        apiDomain: apiDomain(),
        websiteDomain: websiteDomain(),
    });
}
export const superTokensMiddleware = middleware;
export const superTokensErrorHandler = errorHandler;
//# sourceMappingURL=initSuperTokens.js.map