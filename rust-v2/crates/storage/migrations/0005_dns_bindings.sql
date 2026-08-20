CREATE TABLE IF NOT EXISTS dns_suffixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suffix TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('CLOUDFLARE', 'ALIYUN')),
    zone TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl BETWEEN 60 AND 86400),
    quota_per_user INTEGER NOT NULL DEFAULT 1 CHECK (quota_per_user BETWEEN 1 AND 20),
    reserved_prefixes JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS server_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL UNIQUE REFERENCES servers(id) ON DELETE CASCADE,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suffix_id UUID NOT NULL REFERENCES dns_suffixes(id),
    prefix TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    target TEXT NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    application_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (application_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED')),
    dns_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED' CHECK (dns_status IN ('NOT_REQUESTED', 'PENDING', 'ACTIVE', 'FAILED', 'REVOKE_PENDING', 'REVOKED')),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (suffix_id, prefix)
);

CREATE INDEX IF NOT EXISTS server_domains_owner_idx ON server_domains (owner_id, application_status);
CREATE INDEX IF NOT EXISTS server_domains_dns_idx ON server_domains (dns_status);

CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_domain_id UUID NOT NULL REFERENCES server_domains(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'SRV')),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    ttl INTEGER NOT NULL CHECK (ttl BETWEEN 60 AND 86400),
    provider_record_id TEXT,
    created_by_platform BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'FAILED', 'DELETED')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (server_domain_id, record_type, name, content)
);

CREATE INDEX IF NOT EXISTS dns_records_provider_idx ON dns_records (provider_record_id) WHERE provider_record_id IS NOT NULL;
