type MailRuntimeState = {
  configured: boolean;
  enabled: boolean;
};

type MailReadiness = {
  required: boolean;
  ready: boolean;
  reason?: string;
};

const MAIL_UNAVAILABLE_REASON = 'registration email transport unavailable';

export function evaluateMailReadiness(runtime: MailRuntimeState, nodeEnv = process.env.NODE_ENV): MailReadiness {
  const required = nodeEnv === 'production';
  const ready = !required || (runtime.configured && runtime.enabled);

  return ready
    ? { required, ready }
    : { required, ready, reason: MAIL_UNAVAILABLE_REASON };
}
