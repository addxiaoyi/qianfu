# Rust v2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将千服后端从现有 Node/Prisma 单体逐步迁移到可灰度、可回滚的 Rust API + PostgreSQL + Worker 架构，并覆盖当前已确认的认证、服务器发布、DNS、邮件、图库、探测和移动端问题。

**Architecture:** Rust Axum API 只处理鉴权、校验和事务；PostgreSQL 负责核心数据与任务状态；独立 Worker 使用 `FOR UPDATE SKIP LOCKED` 消费幂等任务。外部 DNS、SMTP/POP、R2 和 Minecraft 探测都通过 Provider trait 接入，Node 服务在灰度结束前保留为回滚路径。

**Tech Stack:** Rust 2024, Axum, Tokio, SQLx/PostgreSQL, Argon2id, PKCE S256, reqwest, Cloudflare API, Alibaba Cloud DNS RPC, SMTP/IMAP/POP3, S3-compatible R2.

---

### Current vertical slices

- [x] core response/config/PKCE/server/task contracts
- [x] PostgreSQL schema and repository boundary
- [x] Argon2id credentials and hashed session tokens
- [x] API registration/login/me and owner-protected server CRUD/review routes
- [x] DNS record policy and Cloudflare/Alibaba provider boundary

### Remaining slices

- [x] DNS domain binding persistence and provider-aware task execution
- [x] SMTP/IMAP/POP3 mail provider and verification delivery task
- [x] R2 media provider with public URL and content-type/size checks
- [x] Minecraft Java/Bedrock probe worker and latest status persistence
- [x] GitHub OAuth callback with PKCE state/verifier persistence
- [x] frontend API adapter and Rust v2 health/gray-release mapping (mobile/entry regression checks remain open)
- [x] Docker/health/metrics deployment skeleton (Node/Rust dual-run, rollback and production acceptance remain open)
