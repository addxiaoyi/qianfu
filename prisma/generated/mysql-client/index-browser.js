
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password_hash: 'password_hash',
  supertokens_user_id: 'supertokens_user_id',
  supabase_id: 'supabase_id',
  username: 'username',
  display_name: 'display_name',
  avatar_url: 'avatar_url',
  role: 'role',
  created_at: 'created_at',
  updated_at: 'updated_at',
  password_changed_at: 'password_changed_at',
  email_verified: 'email_verified',
  verification_token: 'verification_token',
  token_expiry: 'token_expiry',
  last_login_at: 'last_login_at',
  login_count: 'login_count',
  email_cipher: 'email_cipher',
  preferences: 'preferences',
  bio_html: 'bio_html',
  permissions: 'permissions',
  reset_token: 'reset_token',
  reset_token_expiry: 'reset_token_expiry',
  experience_points: 'experience_points',
  last_checkin_at: 'last_checkin_at',
  last_code_send_at: 'last_code_send_at',
  login_lockout_at: 'login_lockout_at',
  phone: 'phone'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  token: 'token',
  expires_at: 'expires_at',
  user_agent: 'user_agent',
  ip_address: 'ip_address',
  is_revoked: 'is_revoked',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  title: 'title',
  content: 'content',
  type: 'type',
  is_read: 'is_read',
  created_at: 'created_at'
};

exports.Prisma.WalletScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  balance: 'balance',
  currency: 'currency',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.TransactionScalarFieldEnum = {
  id: 'id',
  wallet_id: 'wallet_id',
  amount: 'amount',
  type: 'type',
  status: 'status',
  description: 'description',
  metadata: 'metadata',
  signature: 'signature',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UserBioVersionScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  version: 'version',
  content_html: 'content_html',
  editor_id: 'editor_id',
  created_at: 'created_at'
};

exports.Prisma.ServerScalarFieldEnum = {
  id: 'id',
  owner_id: 'owner_id',
  name: 'name',
  name_en: 'name_en',
  thumbnail: 'thumbnail',
  summary: 'summary',
  summary_en: 'summary_en',
  content_html: 'content_html',
  ip: 'ip',
  group_number: 'group_number',
  tags: 'tags',
  link: 'link',
  activity: 'activity',
  synced_at: 'synced_at',
  review_status: 'review_status',
  review_notes: 'review_notes',
  reviewed_by: 'reviewed_by',
  reviewed_at: 'reviewed_at',
  listing_plan: 'listing_plan',
  listing_started_at: 'listing_started_at',
  listing_expires_at: 'listing_expires_at',
  listing_price_paid: 'listing_price_paid',
  created_at: 'created_at',
  updated_at: 'updated_at',
  platform: 'platform',
  category: 'category',
  online_mode: 'online_mode',
  supported_versions: 'supported_versions',
  network_env: 'network_env',
  like_count: 'like_count',
  comment_count: 'comment_count'
};

exports.Prisma.ServerStatusHistoryScalarFieldEnum = {
  id: 'id',
  server_id: 'server_id',
  sampled_at: 'sampled_at',
  online: 'online',
  players_online: 'players_online',
  players_max: 'players_max',
  latency_ms: 'latency_ms',
  version_raw: 'version_raw'
};

exports.Prisma.ServerCommentScalarFieldEnum = {
  id: 'id',
  server_id: 'server_id',
  user_id: 'user_id',
  body: 'body',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ServerLikeScalarFieldEnum = {
  id: 'id',
  server_id: 'server_id',
  user_id: 'user_id',
  created_at: 'created_at'
};

exports.Prisma.ServerStatusScalarFieldEnum = {
  id: 'id',
  serverId: 'serverId',
  online: 'online',
  host: 'host',
  port: 'port',
  versionNameRaw: 'versionNameRaw',
  versionProtocol: 'versionProtocol',
  playersOnline: 'playersOnline',
  playersMax: 'playersMax',
  playersList: 'playersList',
  motdRaw: 'motdRaw',
  motdClean: 'motdClean',
  motdHtml: 'motdHtml',
  favicon: 'favicon',
  srvRecord: 'srvRecord',
  lastUpdated: 'lastUpdated',
  createdAt: 'createdAt'
};

exports.Prisma.SystemConfigScalarFieldEnum = {
  key: 'key',
  value: 'value',
  is_secret: 'is_secret',
  description: 'description',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.TeamMemberScalarFieldEnum = {
  id: 'id',
  qq: 'qq',
  name: 'name',
  name_en: 'name_en',
  role: 'role',
  role_en: 'role_en',
  description: 'description',
  description_en: 'description_en',
  avatar_url: 'avatar_url',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.AllianceGroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  name_en: 'name_en',
  link: 'link',
  description: 'description',
  description_en: 'description_en',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ResourceLinkScalarFieldEnum = {
  id: 'id',
  title: 'title',
  title_en: 'title_en',
  url: 'url',
  description: 'description',
  description_en: 'description_en',
  category: 'category',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ServerVersionScalarFieldEnum = {
  id: 'id',
  server_id: 'server_id',
  version: 'version',
  name: 'name',
  summary: 'summary',
  content_html: 'content_html',
  tags: 'tags',
  ip: 'ip',
  editor_id: 'editor_id',
  created_at: 'created_at'
};

exports.Prisma.ReviewHistoryScalarFieldEnum = {
  id: 'id',
  reviewer_id: 'reviewer_id',
  server_id: 'server_id',
  action: 'action',
  notes: 'notes',
  created_at: 'created_at'
};

exports.Prisma.PermissionHistoryScalarFieldEnum = {
  id: 'id',
  admin_id: 'admin_id',
  user_id: 'user_id',
  action: 'action',
  permission: 'permission',
  created_at: 'created_at'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  action: 'action',
  target: 'target',
  details: 'details',
  ip_address: 'ip_address',
  method: 'method',
  endpoint: 'endpoint',
  user_agent: 'user_agent',
  session_id: 'session_id',
  rechecked_at: 'rechecked_at',
  recheck_status: 'recheck_status',
  rechecked_by: 'rechecked_by',
  hash: 'hash',
  previous_hash: 'previous_hash',
  created_at: 'created_at'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  key_hash: 'key_hash',
  user_id: 'user_id',
  permissions: 'permissions',
  expires_at: 'expires_at',
  last_used_at: 'last_used_at',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ModerationLogScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  action: 'action',
  content_type: 'content_type',
  content: 'content',
  reason: 'reason',
  created_at: 'created_at'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  title: 'title',
  description: 'description',
  category: 'category',
  status: 'status',
  priority: 'priority',
  payment_id: 'payment_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.TicketMessageScalarFieldEnum = {
  id: 'id',
  ticket_id: 'ticket_id',
  sender_id: 'sender_id',
  content: 'content',
  is_ai: 'is_ai',
  created_at: 'created_at'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  plan_id: 'plan_id',
  payment_method: 'payment_method',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.IntroPageScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  title: 'title',
  content_md: 'content_md',
  content_html: 'content_html',
  status: 'status',
  version: 'version',
  hash: 'hash',
  seo_title: 'seo_title',
  seo_description: 'seo_description',
  editor_lock_user: 'editor_lock_user',
  lock_expires_at: 'lock_expires_at',
  last_published_at: 'last_published_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.IntroPageVersionScalarFieldEnum = {
  id: 'id',
  page_id: 'page_id',
  version: 'version',
  title: 'title',
  content_md: 'content_md',
  content_html: 'content_html',
  author_id: 'author_id',
  hash: 'hash',
  created_at: 'created_at'
};

exports.Prisma.ReportScalarFieldEnum = {
  id: 'id',
  reporter_id: 'reporter_id',
  target_type: 'target_type',
  target_id: 'target_id',
  reason: 'reason',
  description: 'description',
  status: 'status',
  resolution_notes: 'resolution_notes',
  handler_id: 'handler_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.MarketplaceProductScalarFieldEnum = {
  id: 'id',
  title: 'title',
  category: 'category',
  description: 'description',
  price: 'price',
  sales: 'sales',
  rating: 'rating',
  review_count: 'review_count',
  author_name: 'author_name',
  cover_url: 'cover_url',
  download_url: 'download_url',
  created_at: 'created_at',
  updated_at: 'updated_at',
  creator_id: 'creator_id'
};

exports.Prisma.MarketplaceOrderScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  buyer_id: 'buyer_id',
  buyer_name: 'buyer_name',
  quantity: 'quantity',
  total_price: 'total_price',
  status: 'status',
  payment_status: 'payment_status',
  fulfillment_status: 'fulfillment_status',
  delivery_url: 'delivery_url',
  payment_id: 'payment_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.MarketplaceReviewScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  user_id: 'user_id',
  rating: 'rating',
  content: 'content',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.MarketplaceFavoriteScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  user_id: 'user_id',
  created_at: 'created_at'
};

exports.Prisma.MarketplaceFulfillmentLogScalarFieldEnum = {
  id: 'id',
  order_id: 'order_id',
  status: 'status',
  note: 'note',
  created_at: 'created_at',
  userId: 'userId'
};

exports.Prisma.MarketplaceShopConfigVersionScalarFieldEnum = {
  id: 'id',
  owner_id: 'owner_id',
  product_id: 'product_id',
  banner_url: 'banner_url',
  avatar_url: 'avatar_url',
  announcement_title: 'announcement_title',
  announcement_text: 'announcement_text',
  bio: 'bio',
  shop_name: 'shop_name',
  theme: 'theme',
  visit_count: 'visit_count',
  click_count: 'click_count',
  is_active: 'is_active',
  created_at: 'created_at'
};

exports.Prisma.PromoPlatformBindingScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  platform: 'platform',
  platform_user_id: 'platform_user_id',
  platform_username: 'platform_username',
  binding_status: 'binding_status',
  bind_source: 'bind_source',
  verified_at: 'verified_at',
  last_verify_at: 'last_verify_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.PromoTaskScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  platform: 'platform',
  target_type: 'target_type',
  target_id: 'target_id',
  target_url: 'target_url',
  cover_url: 'cover_url',
  reward_amount: 'reward_amount',
  reward_type: 'reward_type',
  rule_config: 'rule_config',
  claim_limit_per_user: 'claim_limit_per_user',
  total_limit: 'total_limit',
  daily_limit: 'daily_limit',
  need_audit: 'need_audit',
  auto_verify: 'auto_verify',
  status: 'status',
  start_at: 'start_at',
  end_at: 'end_at',
  rule_version: 'rule_version',
  created_by: 'created_by',
  published_by: 'published_by',
  published_at: 'published_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.PromoClaimRecordScalarFieldEnum = {
  id: 'id',
  task_id: 'task_id',
  user_id: 'user_id',
  platform_user_id: 'platform_user_id',
  claim_status: 'claim_status',
  reward_status: 'reward_status',
  verify_result: 'verify_result',
  verify_detail: 'verify_detail',
  proof_data: 'proof_data',
  claim_request_no: 'claim_request_no',
  claim_at: 'claim_at',
  verified_at: 'verified_at',
  rewarding_at: 'rewarding_at',
  rewarded_at: 'rewarded_at',
  failed_reason: 'failed_reason',
  audit_by: 'audit_by',
  audit_note: 'audit_note',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.PromoVerifyLogScalarFieldEnum = {
  id: 'id',
  claim_id: 'claim_id',
  task_id: 'task_id',
  user_id: 'user_id',
  platform_user_id: 'platform_user_id',
  verify_status: 'verify_status',
  request_data: 'request_data',
  response_data: 'response_data',
  error_message: 'error_message',
  source: 'source',
  created_at: 'created_at'
};

exports.Prisma.PromoWalletTransactionScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  change_amount: 'change_amount',
  direction: 'direction',
  change_type: 'change_type',
  ref_type: 'ref_type',
  ref_id: 'ref_id',
  before_balance: 'before_balance',
  after_balance: 'after_balance',
  remark: 'remark',
  created_by: 'created_by',
  created_at: 'created_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  Notification: 'Notification',
  Wallet: 'Wallet',
  Transaction: 'Transaction',
  UserBioVersion: 'UserBioVersion',
  Server: 'Server',
  ServerStatusHistory: 'ServerStatusHistory',
  ServerComment: 'ServerComment',
  ServerLike: 'ServerLike',
  ServerStatus: 'ServerStatus',
  SystemConfig: 'SystemConfig',
  TeamMember: 'TeamMember',
  AllianceGroup: 'AllianceGroup',
  ResourceLink: 'ResourceLink',
  ServerVersion: 'ServerVersion',
  ReviewHistory: 'ReviewHistory',
  PermissionHistory: 'PermissionHistory',
  AuditLog: 'AuditLog',
  ApiKey: 'ApiKey',
  ModerationLog: 'ModerationLog',
  Ticket: 'Ticket',
  TicketMessage: 'TicketMessage',
  Payment: 'Payment',
  IntroPage: 'IntroPage',
  IntroPageVersion: 'IntroPageVersion',
  Report: 'Report',
  MarketplaceProduct: 'MarketplaceProduct',
  MarketplaceOrder: 'MarketplaceOrder',
  MarketplaceReview: 'MarketplaceReview',
  MarketplaceFavorite: 'MarketplaceFavorite',
  MarketplaceFulfillmentLog: 'MarketplaceFulfillmentLog',
  MarketplaceShopConfigVersion: 'MarketplaceShopConfigVersion',
  PromoPlatformBinding: 'PromoPlatformBinding',
  PromoTask: 'PromoTask',
  PromoClaimRecord: 'PromoClaimRecord',
  PromoVerifyLog: 'PromoVerifyLog',
  PromoWalletTransaction: 'PromoWalletTransaction'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
