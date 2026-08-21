# OPTIMIZATION-25: GraphQL Client - Apollo

## 状态
- **状态**: 已完成
- **优先级**: 高
- **完成日期**: 2026-07-06

## 目标
将现有的REST API客户端替换为Apollo GraphQL客户端，利用GraphQL的类型安全、查询优化、缓存管理等特性提升前端数据获取能力。

## 背景

当前项目使用基于fetch的REST API客户端 (`src/lib/api-client.ts`)，存在以下问题：
- 每个API端点需要单独的手写类型定义
- 无法利用GraphQL的字段级类型安全
- 缺乏统一的缓存管理
- 请求去重和取消需要手动实现
- 无法利用Fragment colocation和data masking

## 方案概述

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Components                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │  Fragments  │  │  useSuspenseQuery()     │  │
│  │ (Root Query)│  │(Colocated)  │  │  useMutation()          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Apollo Client (v4.x)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  InMemoryCache  │  HttpLink  │  AuthLink  │  ErrorLink  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GraphQL Endpoint                            │
│                    /api/graphql (或外部服务)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 核心优势

| 特性 | REST (当前) | GraphQL + Apollo |
|------|-------------|------------------|
| 类型安全 | 手动定义 | 自动生成 (codegen) |
| 缓存 | 无 | 标准化缓存 + 手动策略 |
| 请求去重 | 无 | 自动 |
| 乐观更新 | 手动 | 内置支持 |
| 字段追踪 | 无 | Fragment colocation |
| 数据隔离 | 无 | Data masking |
| 实时订阅 | 无 | WebSocket支持 |

## 实施步骤

### 1. 安装依赖

```bash
npm install @apollo/client graphql rxjs
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-document-nodes
```

### 2. Apollo客户端配置

创建 `src/graphql/client.ts`:

```typescript
import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";

// GraphQL端点
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || "/api/graphql";

// 认证链接 - 从localStorage获取token
const authLink = new SetContextLink(({ headers }) => {
  const token = localStorage.getItem("accessToken");
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// 错误处理链接
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // 处理认证错误
      if (message.includes("Unauthorized") || message.includes("JWT")) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// 重试链接
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 5,
    retryIf: (error) => !!error,
  },
});

// HTTP链接
const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
  credentials: "include",
});

// 创建Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, retryLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // 列表分页缓存策略
          users: {
            keyArgs: false,
            merge(existing = [], incoming, { args }) {
              if (args?.offset === 0) {
                return incoming;
              }
              return [...existing, ...incoming];
            },
          },
          servers: {
            keyArgs: ["filter"],
            merge(existing, incoming, { args }) {
              if (args?.offset === 0) return incoming;
              return [...(existing || []), ...incoming];
            },
          },
        },
      },
      // 特殊类型的keyFields配置
      User: { keyFields: ["id"] },
      Server: { keyFields: ["id"] },
      Video: { keyFields: ["id"] },
    },
  }),
  // 开发环境启用DevTools
  devtools: {
    enabled: import.meta.env.DEV,
  },
  clientAwareness: {
    name: "qianfu-web",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0",
  },
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-first",
      errorPolicy: "all",
    },
    query: {
      fetchPolicy: "cache-first",
      errorPolicy: "all",
    },
    mutate: {
      errorPolicy: "all",
    },
  },
});
```

### 3. Provider配置

创建 `src/graphql/provider.tsx`:

```typescript
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "./client";

interface GraphQLProviderProps {
  children: React.ReactNode;
}

export function GraphQLProvider({ children }: GraphQLProviderProps) {
  return (
    <ApolloProvider client={apolloClient}>
      {children}
    </ApolloProvider>
  );
}
```

### 4. GraphQL代码生成配置

创建 `codegen.yml`:

```yaml
schema: ./schema.graphql
documents: ./src/graphql/operations/**/*.graphql
generates:
  ./src/graphql/generated/types.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-document-nodes
    config:
      withComponent: false
      withHOC: false
      withHooks: true
      enumsAsTypes: true
      avoidOptionals: true
      nonOptionalTypename: true
```

### 5. 定义GraphQL查询操作

创建 `src/graphql/operations/user.graphql`:

```graphql
fragment UserBasicFields on User {
  id
  name
  email
  avatar
  role
  createdAt
}

fragment UserFullFields on User {
  ...UserBasicFields
  bio
  preferences
  lastLoginAt
}

query GetCurrentUser {
  currentUser {
    ...UserFullFields
  }
}

query GetUser($id: ID!) {
  user(id: $id) {
    ...UserFullFields
  }
}

query ListUsers($offset: Int, $limit: Int, $filter: UserFilter) {
  users(offset: $offset, limit: $limit, filter: $filter) {
    total
    items {
      ...UserBasicFields
    }
  }
}
```

创建 `src/graphql/operations/server.graphql`:

```graphql
fragment ServerBasicFields on Server {
  id
  name
  description
  status
  owner {
    id
    name
    avatar
  }
  tags
  createdAt
  updatedAt
}

fragment ServerDetailFields on Server {
  ...ServerBasicFields
  config
  metrics {
    cpu
    memory
    disk
  }
  favorites
}

query GetServer($id: ID!) {
  server(id: $id) {
    ...ServerDetailFields
  }
}

query ListServers($offset: Int, $limit: Int, $filter: ServerFilter) {
  servers(offset: $offset, limit: $limit, filter: $filter) {
    total
    items {
      ...ServerBasicFields
    }
  }
}

query GetFavoriteServers {
  favoriteServers {
    ...ServerBasicFields
  }
}
```

### 6. React Hooks封装

创建 `src/graphql/hooks/useQuery.ts`:

```typescript
import { useQuery, useSuspenseQuery } from "@apollo/client/react";
import type { DocumentNode } from "graphql";

// 标准查询Hook (非Suspense)
export function useGraphQLQuery<TData, TVariables>(
  document: DocumentNode,
  options?: {
    variables?: TVariables;
    fetchPolicy?: "cache-first" | "cache-and-network" | "network-only" | "no-cache";
    skip?: boolean;
    onCompleted?: (data: TData) => void;
    onError?: (error: Error) => void;
  }
) {
  const { loading, error, data, refetch, fetchMore } = useQuery(document, {
    ...options,
    errorPolicy: "all",
  });

  return {
    loading,
    error,
    data,
    refetch,
    fetchMore,
    isEmpty: !loading && (!data || Object.keys(data).length === 0),
  };
}

// Suspense查询Hook (推荐)
export function useSuspenseGraphQLQuery<TData, TVariables>(
  document: DocumentNode,
  options?: {
    variables?: TVariables;
    fetchPolicy?: "cache-first" | "cache-and-network" | "network-only";
    skip?: boolean;
  }
) {
  return useSuspenseQuery(document, {
    ...options,
    errorPolicy: "all",
  });
}
```

创建 `src/graphql/hooks/useMutation.ts`:

```typescript
import { useMutation } from "@apollo/client/react";
import type { DocumentNode, MutationHookOptions } from "@apollo/client";

export interface UseGraphQLMutationResult<TData, TVariables> {
  mutate: (variables?: TVariables) => Promise<{ data?: TData; errors?: Error[] }>;
  loading: boolean;
  error: Error | undefined;
  data: TData | undefined;
  reset: () => void;
}

export function useGraphQLMutation<TData, TVariables>(
  document: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
): UseGraphQLMutationResult<TData, TVariables> {
  const [mutateFunction, { loading, error, data, reset }] = useMutation(document, {
    ...options,
    errorPolicy: "all",
  });

  const mutate = async (variables?: TVariables) => {
    try {
      const result = await mutateFunction(variables);
      return { 
        data: result.data, 
        errors: result.errors 
      };
    } catch (err) {
      throw err;
    }
  };

  return {
    mutate,
    loading,
    error,
    data,
    reset,
  };
}
```

### 7. 示例：组件使用

**用户详情页 (使用Suspense)**:

```tsx
// src/pages/UserProfile.tsx
import { Suspense } from "react";
import { GetUserDocument } from "@/graphql/generated/types";
import { useSuspenseGraphQLQuery } from "@/graphql/hooks/useQuery";

function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseGraphQLQuery(GetUserDocument, {
    variables: { id: userId },
    fetchPolicy: "cache-first",
  });

  return (
    <div className="user-profile">
      <img src={data.user.avatar} alt={data.user.name} />
      <h1>{data.user.name}</h1>
      <p>{data.user.bio}</p>
      <span className="role-badge">{data.user.role}</span>
    </div>
  );
}

export function UserProfilePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<UserProfileSkeleton />}>
      <UserProfile userId={params.id} />
    </Suspense>
  );
}
```

**服务器列表页 (使用标准查询 + 加载状态)**:

```tsx
// src/pages/ServerList.tsx
import { useState } from "react";
import { ListServersDocument } from "@/graphql/generated/types";
import { useGraphQLQuery } from "@/graphql/hooks/useQuery";

const PAGE_SIZE = 20;

export function ServerListPage() {
  const [page, setPage] = useState(0);
  const { loading, error, data, fetchMore } = useGraphQLQuery(ListServersDocument, {
    variables: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
    fetchPolicy: "cache-first",
  });

  const loadMore = () => {
    setPage((p) => p + 1);
    fetchMore({
      variables: { offset: (page + 1) * PAGE_SIZE },
    });
  };

  if (error) return <ErrorMessage error={error} />;
  if (loading && !data) return <ServerListSkeleton />;

  return (
    <div className="server-list">
      {data?.servers.items.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
      
      {data?.servers.total && data.servers.total > (page + 1) * PAGE_SIZE && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? "加载中..." : "加载更多"}
        </button>
      )}
    </div>
  );
}
```

**表单提交 (使用Mutation)**:

```tsx
// src/pages/ServerCreate.tsx
import { useState } from "react";
import { CreateServerDocument } from "@/graphql/generated/types";
import { useGraphQLMutation } from "@/graphql/hooks/useMutation";

export function ServerCreateForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const { mutate, loading, error, data } = useGraphQLMutation(
    CreateServerDocument,
    {
      onCompleted: (data) => {
        console.log("服务器创建成功:", data.createServer);
        // 可选：重定向到详情页
        // router.push(`/servers/${data.createServer.id}`);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate({
      variables: {
        input: { name, description },
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="服务器名称"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="描述"
      />
      <button type="submit" disabled={loading}>
        {loading ? "创建中..." : "创建服务器"}
      </button>
      {error && <p className="error">错误: {error.message}</p>}
    </form>
  );
}
```

### 8. 乐观更新示例

```typescript
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

// 开启/关闭收藏服务器
const TOGGLE_FAVORITE = gql`
  mutation ToggleFavorite($serverId: ID!) {
    toggleFavorite(serverId: $serverId) {
      id
      favorites
    }
  }
`;

export function useToggleFavorite() {
  const [toggleFavorite, { loading }] = useMutation(TOGGLE_FAVORITE, {
    // 乐观更新：立即更新UI
    optimisticResponse: {
      toggleFavorite: {
        __typename: "Server",
        id: "", // 将在执行时替换
        favorites: true,
      },
    },
    // 更新缓存
    update(cache, { data }) {
      const server = data?.toggleFavorite;
      if (server) {
        cache.modify({
          id: cache.identify({ __typename: "Server", id: server.id }),
          fields: {
            favorites: (favorites) => !favorites,
          },
        });
      }
    },
  });

  return { toggleFavorite, loading };
}
```

## 性能优化

### 1. 请求去重

Apollo Client自动去重相同的请求，多个组件同时请求相同数据时只会发送一个网络请求。

### 2. 缓存策略

```typescript
// 按数据类型配置缓存策略
const cache = new InMemoryCache({
  typePolicies: {
    // 用户数据 - 长期缓存
    User: {
      keyFields: ["id"],
      fields: {
        // 5分钟缓存
        ttl: 5 * 60 * 1000,
      },
    },
    // 服务器配置 - 短期缓存
    ServerConfig: {
      keyFields: ["serverId"],
      fields: {
        ttl: 60 * 1000, // 1分钟缓存
      },
    },
    // 指标数据 - 禁用缓存，实时数据
    ServerMetrics: {
      keyFields: ["serverId"],
      fields: {
        // 禁用缓存
        read() {
          return null;
        },
      },
    },
  },
});
```

### 3. 批量请求

```typescript
import { ApolloLink, Observable } from "@apollo/client";
import { batchLink } from "@apollo/client/link/batch-http";

// 批量多个请求在单个请求中发送
const batchMiddleware = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    const key = operation.operationName;
    // 实现请求批处理逻辑
    // ...
  });
});

const client = new ApolloClient({
  link: from([
    errorLink,
    batchLink({
      batchMax: 5,
      batchInterval: 20,
    }),
    httpLink,
  ]),
  cache,
});
```

## 错误处理

### 分层错误处理

```typescript
// 1. 链接级错误处理
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  // GraphQL错误
  if (graphQLErrors) {
    for (const { message, extensions } of graphQLErrors) {
      const code = extensions?.code as string;
      
      switch (code) {
        case "UNAUTHENTICATED":
          // JWT过期
          handleAuthError();
          break;
        case "FORBIDDEN":
          // 权限不足
          handlePermissionError(message);
          break;
        case "VALIDATION_ERROR":
          // 验证错误
          handleValidationError(extensions?.details);
          break;
        default:
          // 其他GraphQL错误
          console.error(`[GraphQL Error]: ${message}`);
      }
    }
  }
  
  // 网络错误
  if (networkError) {
    if (networkError.statusCode === 0) {
      // 网络断开
      handleNetworkError();
    }
  }
});

// 2. 组件级错误处理
function ServerList() {
  const { loading, error, data } = useQuery(LIST_SERVERS);
  
  if (error) {
    if (error.graphQLErrors?.some(e => e.extensions?.code === "RATE_LIMITED")) {
      return <RateLimitMessage />;
    }
    return <ErrorFallback error={error} />;
  }
  
  // ...
}
```

## 测试策略

### 单元测试

```typescript
import { MockedProvider } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import { GetUserDocument } from "@/graphql/generated/types";
import { UserProfile } from "./UserProfile";

const mocks = [
  {
    request: {
      query: GetUserDocument,
      variables: { id: "1" },
    },
    result: {
      data: {
        user: {
          id: "1",
          name: "张三",
          email: "zhangsan@example.com",
        },
      },
    },
  },
];

describe("UserProfile", () => {
  it("renders user data", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename>
        <UserProfile userId="1" />
      </MockedProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText("张三")).toBeInTheDocument();
    });
  });
});
```

### 集成测试

```typescript
import { MockLink, InMemoryCache } from "@apollo/client/testing";
import { ApolloClient } from "@apollo/client";

// 创建测试客户端
function createTestClient(mocks: MockedResponse[]) {
  const link = new MockLink(mocks);
  const cache = new InMemoryCache();
  
  return new ApolloClient({ link, cache });
}
```

## 迁移步骤

### Phase 1: 基础设施 (第1天)
1. 安装Apollo依赖
2. 配置Apollo Client
3. 配置GraphQL代码生成器
4. 创建Provider

### Phase 2: 核心查询 (第2-3天)
1. 定义User相关GraphQL查询
2. 迁移用户相关页面
3. 定义Server相关GraphQL查询
4. 迁移服务器列表页面

### Phase 3: 高级特性 (第4-5天)
1. 实现Mutation
2. 添加乐观更新
3. 配置缓存策略
4. 实现错误处理

### Phase 4: 测试与优化 (第6-7天)
1. 编写单元测试
2. 编写集成测试
3. 性能优化
4. 文档更新

## 注意事项

### SSR兼容性
如果后续需要SSR支持，需要：
1. 使用`@apollo/client/react/ssr`中的`getApolloClient`和`initializeApollo`
2. 序列化缓存到HTML进行脱水/注水
3. 使用`<HydrationContext>`包裹客户端

### 包体积
Apollo Client + GraphQL基础包约100KB (gzip)，可通过以下方式优化：
- 启用Tree-shaking (`import { ApolloClient } from "@apollo/client/core"`)
- 只导入需要的缓存策略

### 与现有REST API共存
迁移期间可以共存：
```typescript
// 在需要的地方使用GraphQL
const { data } = useGraphQLQuery(GET_SERVER, { variables: { id } });

// 在其他地方继续使用REST API
const { data } = useApi("/servers/" + id);
```

## 相关文档

- [Apollo Client 官方文档](https://www.apollographql.com/docs/react/)
- [GraphQL Code Generator](https://www.graphql-code-generator.com/)
- [OPTIMIZATION-51: Login Zod](./OPTIMIZATION-51-LOGIN-ZOD.md)
- [OPTIMIZATION-52: Register Zod](./OPTIMIZATION-52-REGISTER-ZOD.md)

## 变更记录

| 日期 | 描述 | 作者 |
|------|------|------|
| 2026-07-06 | 初始文档创建 | Claude |
