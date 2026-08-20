import swaggerJsdoc from 'swagger-jsdoc';
import { API_DEFAULT_VERSION, SUPPORTED_API_VERSIONS } from '../constants/api.js';
const version = process.env.APP_VERSION || '0.0.0';
const DEFAULT_VERSION = API_DEFAULT_VERSION;
const SUPPORTED_VERSIONS = [...SUPPORTED_API_VERSIONS];
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '千服 API Documentation',
            version,
            description: `API documentation for 千服 (QianFu) - Minecraft server management platform

## API Versioning

Current default version: **${DEFAULT_VERSION}**

Supported versions: ${SUPPORTED_VERSIONS.map(v => `\`${v}\``).join(', ')}

- All API endpoints are prefixed with \`/api/{version}/\` (e.g. \`/api/v1/servers\`)
- Specify version via: URL prefix, \`X-API-Version\` header, or \`?api-version=v1\` query param
- Deprecated versions will include \`Deprecation\` and \`Sunset\` response headers
- See [API Versioning Guide](../docs/API-VERSIONING.md) for migration details`,
            contact: {
                name: '千服 Team',
                email: 'support@qianfu.example',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Development server (v1)',
            },
        ],
        tags: [
            { name: 'User', description: 'User management endpoints' },
            { name: 'Servers', description: 'Server CRUD and management' },
            { name: 'Health', description: 'Health check and monitoring' },
        ],
        components: {
            parameters: {
                ApiVersionHeader: {
                    name: 'X-API-Version',
                    in: 'header',
                    description: 'API version to use (overrides URL prefix)',
                    required: false,
                    schema: {
                        type: 'string',
                        enum: [...SUPPORTED_VERSIONS],
                        default: DEFAULT_VERSION,
                    },
                },
                ApiVersionQuery: {
                    name: 'api-version',
                    in: 'query',
                    description: 'API version to use (lowest priority)',
                    required: false,
                    schema: {
                        type: 'string',
                        enum: [...SUPPORTED_VERSIONS],
                        default: DEFAULT_VERSION,
                    },
                },
            },
            headers: {
                XApiVersion: {
                    description: 'The API version used for this request',
                    schema: {
                        type: 'string',
                        example: 'v1',
                    },
                },
                Deprecation: {
                    description: 'Present when the API version is deprecated',
                    schema: {
                        type: 'string',
                        example: 'true',
                    },
                },
                Sunset: {
                    description: 'Date when the deprecated version will be removed (RFC 8594)',
                    schema: {
                        type: 'string',
                        format: 'date',
                        example: '2027-01-01',
                    },
                },
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from authentication endpoint',
                },
                csrfAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-csrf-token',
                    description: 'CSRF token for state-changing operations',
                },
            },
            schemas: {
                ApiSuccessEnvelope: {
                    type: 'object',
                    description: '统一成功响应包络',
                    required: ['success', 'message', 'data', 'timestamp'],
                    properties: {
                        success: {
                            type: 'boolean',
                            description: '固定为 true',
                            example: true,
                        },
                        message: {
                            type: 'string',
                            description: '业务提示文案',
                            example: 'Ticket created successfully',
                        },
                        data: {
                            description: '业务数据载荷',
                        },
                        requestId: {
                            type: 'string',
                            description: '请求追踪 ID（用于日志排障）',
                            example: 'req_01JABCXYZ',
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: '响应时间（ISO8601）',
                        },
                        meta: {
                            type: 'object',
                            description: '附加元数据（分页、批量统计等）',
                            additionalProperties: true,
                        },
                    },
                },
                ApiErrorPayload: {
                    type: 'object',
                    description: '统一错误体',
                    required: ['message', 'code', 'statusCode'],
                    properties: {
                        message: {
                            type: 'string',
                            description: '可展示的错误文案',
                        },
                        code: {
                            type: 'string',
                            description: '业务错误码（稳定，可用于程序判断）',
                            example: 'VALIDATION_ERROR',
                        },
                        statusCode: {
                            type: 'integer',
                            description: 'HTTP 状态码镜像',
                            example: 400,
                        },
                        requestId: {
                            type: 'string',
                            description: '请求追踪 ID',
                        },
                        details: {
                            description: '结构化错误细节（参数错误、业务错误详情）',
                            nullable: true,
                        },
                    },
                },
                ApiErrorEnvelope: {
                    type: 'object',
                    description: '统一错误响应包络',
                    required: ['success', 'error', 'timestamp'],
                    properties: {
                        success: {
                            type: 'boolean',
                            description: '固定为 false',
                            example: false,
                        },
                        error: {
                            $ref: '#/components/schemas/ApiErrorPayload',
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: '响应时间（ISO8601）',
                        },
                    },
                },
                ValidationIssue: {
                    type: 'object',
                    description: '字段级校验错误细项',
                    required: ['source', 'path', 'message'],
                    properties: {
                        source: {
                            type: 'string',
                            description: '错误来源',
                            enum: ['body', 'query', 'params'],
                        },
                        path: {
                            type: 'string',
                            description: '字段路径',
                            example: 'email',
                        },
                        code: {
                            type: 'string',
                            description: '校验错误类型',
                            example: 'invalid_string',
                        },
                        message: {
                            type: 'string',
                            description: '错误描述',
                        },
                    },
                },
                ValidationErrorEnvelope: {
                    allOf: [
                        { $ref: '#/components/schemas/ApiErrorEnvelope' },
                        {
                            type: 'object',
                            properties: {
                                error: {
                                    allOf: [
                                        { $ref: '#/components/schemas/ApiErrorPayload' },
                                        {
                                            type: 'object',
                                            properties: {
                                                details: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/ValidationIssue',
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
                PaginationMeta: {
                    type: 'object',
                    description: '分页元信息',
                    required: ['total', 'page', 'limit', 'totalPages'],
                    properties: {
                        total: {
                            type: 'integer',
                            description: '总条目数',
                            example: 128,
                        },
                        page: {
                            type: 'integer',
                            description: '当前页',
                            example: 1,
                        },
                        limit: {
                            type: 'integer',
                            description: '每页条数',
                            example: 20,
                        },
                        totalPages: {
                            type: 'integer',
                            description: '总页数',
                            example: 7,
                        },
                    },
                },
                PaginatedResponse: {
                    allOf: [
                        { $ref: '#/components/schemas/ApiSuccessEnvelope' },
                        {
                            type: 'object',
                            properties: {
                                data: {
                                    type: 'array',
                                    description: '分页列表数据',
                                    items: {},
                                },
                                meta: {
                                    $ref: '#/components/schemas/PaginationMeta',
                                },
                            },
                        },
                    ],
                },
                UserProfile: {
                    type: 'object',
                    description: '用户公开档案',
                    properties: {
                        id: { type: 'integer', description: '用户 ID', example: 1024 },
                        username: { type: 'string', description: '用户名', example: 'qianfu_user' },
                        display_name: { type: 'string', description: '显示昵称', example: '千服玩家' },
                        email: { type: 'string', format: 'email', description: '脱敏邮箱（非管理员）' },
                        avatar_url: { type: 'string', format: 'uri', description: '头像 URL' },
                        bio_html: { type: 'string', description: '个人简介（HTML）' },
                        level: { type: 'integer', description: '用户等级', example: 12 },
                        points: { type: 'integer', description: '积分（兼容字段）', example: 1800 },
                        permissions: { type: 'array', description: '权限列表', items: { type: 'string' } },
                        created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                        last_login_at: { type: 'string', format: 'date-time', description: '最近登录时间' },
                    },
                },
                Server: {
                    type: 'object',
                    description: '服务器基础信息',
                    properties: {
                        id: { type: 'integer', description: '服务器 ID', example: 3001 },
                        name: { type: 'string', maxLength: 100, description: '服务器名称' },
                        host: { type: 'string', description: '服务器地址或域名', example: 'play.example.com' },
                        port: { type: 'integer', default: 25565, description: '端口' },
                        version: { type: 'string', description: '游戏版本', example: '1.20.1' },
                        description: { type: 'string', description: '服务器描述' },
                        owner_id: { type: 'integer', description: '所有者用户 ID' },
                        status: { type: 'string', enum: ['online', 'offline', 'unknown'], description: '探测状态' },
                        players: { type: 'integer', description: '在线人数', example: 23 },
                        max_players: { type: 'integer', description: '最大人数', example: 100 },
                        likes: { type: 'integer', description: '点赞数', example: 88 },
                        created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                        updated_at: { type: 'string', format: 'date-time', description: '更新时间' },
                    },
                },
                ApiError: {
                    $ref: '#/components/schemas/ApiErrorEnvelope',
                },
                ValidationError: {
                    $ref: '#/components/schemas/ValidationErrorEnvelope',
                },
            },
            examples: {
                CreateServerRequest: {
                    summary: '创建服务器请求示例',
                    value: {
                        name: 'QianFu Vanilla',
                        host: 'play.example.com',
                        port: 25565,
                        version: '1.20.1',
                        description: '欢迎来到我的世界服务器',
                    },
                },
                CreateServerResponse: {
                    summary: '创建服务器成功响应示例',
                    value: {
                        success: true,
                        message: 'Server created successfully',
                        data: {
                            id: 3001,
                            name: 'QianFu Vanilla',
                            host: 'play.example.com',
                            port: 25565,
                        },
                        requestId: 'req_01JABCXYZ',
                        timestamp: '2026-04-27T09:30:00.000Z',
                    },
                },
                ValidationErrorResponse: {
                    summary: '参数校验失败示例',
                    value: {
                        success: false,
                        error: {
                            message: 'Validation failed',
                            code: 'VALIDATION_ERROR',
                            statusCode: 400,
                            requestId: 'req_01JABCERR',
                            details: [
                                {
                                    source: 'body',
                                    path: 'host',
                                    code: 'invalid_string',
                                    message: 'Invalid host format',
                                },
                            ],
                        },
                        timestamp: '2026-04-27T09:31:00.000Z',
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Authentication required',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiErrorEnvelope' },
                            example: {
                                success: false,
                                error: {
                                    message: 'Authentication required',
                                    code: 'UNAUTHORIZED',
                                    statusCode: 401,
                                },
                                timestamp: '2026-04-27T09:32:00.000Z',
                            },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiErrorEnvelope' },
                            example: {
                                success: false,
                                error: {
                                    message: 'Resource not found',
                                    code: 'NOT_FOUND',
                                    statusCode: 404,
                                },
                                timestamp: '2026-04-27T09:32:00.000Z',
                            },
                        },
                    },
                },
                ValidationFailed: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ValidationErrorEnvelope' },
                            example: {
                                success: false,
                                error: {
                                    message: 'Validation failed',
                                    code: 'VALIDATION_ERROR',
                                    statusCode: 400,
                                    details: [
                                        {
                                            source: 'query',
                                            path: 'page',
                                            code: 'invalid_type',
                                            message: 'Expected number',
                                        },
                                    ],
                                },
                                timestamp: '2026-04-27T09:33:00.000Z',
                            },
                        },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Path to the API docs
    apis: [
        './server/routes/*.ts',
        './server/routes/**/*.ts',
        './server/intelligent-probe/routes/*.ts',
        './server/controllers/*.ts',
    ],
};
export const swaggerSpec = swaggerJsdoc(options);
//# sourceMappingURL=swagger.js.map