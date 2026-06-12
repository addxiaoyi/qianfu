import { api } from '@/api/request';
import { sanitizeUrl } from '@/utils/urlValidator';

export type OAuthStatusPayload = {
  app: {
    apiPublicUrl: string;
    frontendUrl: string;
    nodeEnv: string;
  };
  providers: {
    github: {
      backendEnabled: boolean;
      expectedCallback: string | null;
      frontendCallback?: string | null;
      loginUrl?: string | null;
      flow?: string | null;
    };
  };
};

export async function fetchOAuthStatus() {
  return api.get<OAuthStatusPayload>('/auth/oauth-status', undefined, {
    useAuth: false,
    skipCsrf: true,
  });
}

export async function beginGitHubOAuthLogin(status?: OAuthStatusPayload) {
  const resolvedStatus = status || (await fetchOAuthStatus());
  if (!resolvedStatus.providers.github.backendEnabled) {
    throw new Error('GitHub OAuth backend is not configured');
  }

  const loginUrl = sanitizeUrl(resolvedStatus.providers.github.loginUrl || '/api/v1/auth/github/start', '/api/v1/auth/github/start');
  const parsed = new URL(loginUrl, window.location.origin);
  if (parsed.origin !== window.location.origin) {
    throw new Error('GitHub OAuth login URL is not trusted');
  }
  window.location.assign(loginUrl);
}
