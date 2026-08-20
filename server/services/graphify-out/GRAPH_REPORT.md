# Graph Report - D:\qwq\项目\千服\server\services  (2026-08-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 808 nodes · 1233 edges · 49 communities (41 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2d95d70`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `RedisService` - 33 edges
2. `MetricsService` - 29 edges
3. `sendMailSmart()` - 18 edges
4. `asString()` - 17 edges
5. `TTLCache` - 14 edges
6. `EscalationEngine` - 14 edges
7. `LRUCache` - 12 edges
8. `AlertStateStore` - 11 edges
9. `getEffectiveMailRuntime()` - 11 edges
10. `getMailMeta()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `grantSubscriptionAccess()` --calls--> `invalidateUserCache()`  [INFERRED]
  creemPaymentService.ts → userLevelService.ts
- `revokeSubscriptionAccess()` --calls--> `invalidateUserCache()`  [INFERRED]
  creemPaymentService.ts → userLevelService.ts
- `revokeOneTimeAccess()` --calls--> `invalidateUserCache()`  [INFERRED]
  creemPaymentService.ts → userLevelService.ts
- `executeSchedule()` --calls--> `sendAdminBroadcastEmail()`  [EXTRACTED]
  mailScheduleService.ts → emailService.ts
- `clearPublicServersCache()` --calls--> `cacheDelete()`  [EXTRACTED]
  publicServerCache.ts → cache.ts

## Import Cycles
- None detected.

## Communities (49 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (57): buildEmailTemplate(), checkFeishuRateLimit(), createTransporter(), getMailMeta(), getRuntimeSourceLabel(), isFeishuRuntime(), recordSend(), sendAdminBroadcastEmail() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (47): ACCESS_PERMISSIONS, ACTIVE_EVENTS, asDate(), asNumber(), asRecord(), assertRecordConsistency(), asString(), cancelCreemSubscription() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (12): Alert, AlertAggregator, AlertManagerApiClient, AlertState, AlertStateStore, CONFIG, EscalationConfig, EscalationTimeline (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (6): DeadLetterTask, NotificationQueue, NotificationTask, sleep(), MemoryCache, RedisService

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (32): assertCapacity(), createInTransaction(), createPendingPromoClaim(), isRetryable(), makeRequestNo(), PendingPromoClaimInput, PendingPromoClaimResult, startOfShanghaiDay() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (29): applyMarketplaceShopTheme(), canEditMarketplaceShop(), Change, defaultShopFields(), findSeller(), getEffectiveMarketplaceVerificationStatus(), getMarketplaceShop(), getMarketplaceShopHistory() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): activeUsersGauge, apiLatencyHistogram, authAttempts, cacheHitRatio, dbConnectionPool, dbQueryDuration, httpRequestDurationMicroseconds, httpRequestsTotal (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (13): decrypt(), encrypt(), getConfig(), getEncryptionKeyBuffer(), setConfig(), compatibleChatUrl(), ModerationResult, ModerationResultSchema (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (21): deleteMailRecipientGroup(), deleteMailSchedule(), deleteMailTemplate(), importMailLibrary(), listMailLibrary(), MailHistoryRecord, MailRecipientGroupRecord, MailScheduleRecord (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (10): analyzeTable(), assertSqlIdent(), createCustomIndex(), dropIndex(), getIndexes(), optimizeDatabaseIndexes(), PrismaModel, QueryInfo (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (19): announcementCreateSchema, announcementFields, announcementIdSchema, AnnouncementRecord, announcementRecordSchema, announcementStatusSchema, announcementToneSchema, announcementUpdateSchema (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (17): IssueMarketplaceDownloadInput, buildMarketplaceEvidenceId(), buildMarketplaceListingSnapshot(), buildMarketplacePolicySnapshot(), buildMarketplaceVersionId(), hashDeliveryReference(), hmacEvidenceValue(), MARKETPLACE_POLICY_SNAPSHOT (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (16): grantSubscriptionAccess(), applyExperience(), ApplyXpResult, baseServerLimit(), enrichUserWithLevel(), getEffectivePermissions(), getEffectiveServerLimit(), getLevelGrantedPermissions() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (16): buildPaypalOrderPayload(), capturePaypalOrder(), createPaypalOrder(), getPaypalAccessToken(), parseAmountFen(), parsePaypalCapture(), PaypalAmount, PaypalCaptureResponse (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (10): authCache, CacheEntry, cacheGet(), CacheOptions, cacheSet(), LRUCacheEntry, memoryCache, serverCache (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (6): HookService, MotiaHook, PluginLoader, repairPrismaUserIfMissing(), SyncMeta, syncPrismaUserFromSuperTokens()

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (16): buildHupijiaoNotifyReplayKey(), buildPayProNotifyReplayKey(), buildQianFuNotifyReplayKey(), buildQiuPayNotifyReplayKey(), buildTpayNotifyReplayKey(), buildXpayNotifyReplayKey(), buildXpayTenantNotifyReplayKey(), extractRequestClientIp() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (12): buildServerFacets(), normalizeFacetValue(), parseFacetValues(), replaceServerFacets(), SERVER_FACET_KIND, ServerFacetClient, ServerFacetInput, ServerFacetKind (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (12): buildPromoBindingChallenge(), decoratePromoBinding(), fetchProofPage(), findFirst(), PLATFORM_CODES, PLATFORM_HOSTS, PromoBindingRecord, PromoBindingVerificationDb (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (9): cleanupExpiredPayments(), cleanupExpiredUnverified(), cleanupKnownUserDependencies(), CleanupVictim, deleteVictimSafely(), isForeignKeyConstraintError(), PAYMENT_ORDER_TIMEOUT_MINUTES, getPaymentExpiredBefore() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (10): conflict(), forbidden(), isUniqueConstraintError(), MarketplaceAppealDecision, MarketplaceAppealTargetType, notFound(), reviewMarketplaceAppeal(), ReviewMarketplaceAppealInput (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (11): buildMinecraftWikiUrl(), CustomerChatMessage, normalizeWikiQuery(), normalizeWikiResults(), parseOpenAiSseEvent(), resolveProviders(), searchMinecraftWiki(), shouldSearchWiki() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (11): Alert, AlertState, AlertStatus, EscalationConfig, EscalationRecord, EscalationTimeline, NotificationPayload, ServiceStatus (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.21
Nodes (5): AppEventService, EVENTS, eventService, DEFAULT_ROLE_UPGRADE_PERMISSIONS, LISTING_PLAN_CANONICAL

### Community 26 - "Community 26"
Cohesion: 0.27
Nodes (9): fulfillMarketplaceOrder(), FulfillMarketplaceOrderInput, isRetryableTransactionError(), MarketplaceMutationContext, openMarketplaceDispute(), OpenMarketplaceDisputeInput, resolveMarketplaceDispute(), ResolveMarketplaceDisputeInput (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (4): ActivityService, cacheDelete(), invalidateCache(), clearPublicServersCache()

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (3): cleanupAllCaches(), stopAllCacheCleanup(), TTLCache

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (10): evaluatePaymentGuardrails(), EXTERNAL_PAYMENT_METHODS, ExternalPaymentMethod, isExternalPaymentMethod(), PaymentGuardrailConfig, PaymentGuardrailInput, PaymentGuardrailUsage, PaymentGuardrailViolation (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (7): ENV_DEV_SECRET, getDevAuthPassword(), getDevAuthSecret(), getDevAuthUsername(), isDevAuthBypassEnabled(), readRequiredDevAuthValue(), _verifyDevAuthToken()

### Community 32 - "Community 32"
Cohesion: 0.28
Nodes (7): GitHubIdentityConflictError, GitHubIdentityProfile, isUniqueConstraintError(), normalizeProfile(), PrismaLike, ResolveUsername, upsertGitHubIdentity()

### Community 33 - "Community 33"
Cohesion: 0.39
Nodes (6): calculateLogHash(), HMAC_SECRET, logAction(), logBatchActions(), logDataChange(), verifyAuditChain()

### Community 34 - "Community 34"
Cohesion: 0.54
Nodes (7): getConfig(), sendPhoneLoginCode(), sendSmsCode(), sendViaAliyun(), sendViaTencent(), sendViaTwilio(), SmsSendOptions

### Community 35 - "Community 35"
Cohesion: 0.36
Nodes (7): buildVmqCallbackSign(), buildVmqOrderParams(), md5(), verifyVmqCallback(), VmqCallback, VmqOrderInput, VmqPaymentType

### Community 36 - "Community 36"
Cohesion: 0.43
Nodes (5): createMemoryPressureMonitor(), MonitorOptions, parseHeapThresholdPercent(), parseThresholdMb(), startMemoryPressureMonitor()

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (5): completePaymentWithSideEffectsInTransaction(), PaymentCompletionInput, PaymentCompletionResult, PaymentCompletionStatus, syncMarketplaceOrders()

### Community 38 - "Community 38"
Cohesion: 0.43
Nodes (6): bindPromoPlatformAccount(), findUnique(), isUniqueConflict(), PromoBindingDb, PromoBindingInput, upsert()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (3): cacheClear(), clearAllCaches(), getCacheStats()

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (3): extractProbeMetrics(), lastWriteAt, tryRecordServerStatusHistory()

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (3): PaymentMethod, PaymentProvider, PaymentProviderSelectionInput

## Knowledge Gaps
- **185 isolated node(s):** `CustomerChatMessage`, `WikiResult`, `announcementToneSchema`, `announcementStatusSchema`, `nullableDateTime` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisService` connect `Community 3` to `Community 1`, `Community 5`, `Community 8`, `Community 13`, `Community 15`, `Community 16`, `Community 27`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `MetricsService` connect `Community 7` to `Community 3`, `Community 6`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `LRUCache` connect `Community 29` to `Community 28`, `Community 15`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `CustomerChatMessage`, `WikiResult`, `announcementToneSchema` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0858843537414966 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05410628019323672 - nodes in this community are weakly interconnected._