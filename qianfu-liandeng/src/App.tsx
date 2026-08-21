import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { Suspense, useEffect, lazy, useState } from "react";
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from "./store/authStore";
import { useUIStore, applyAccent } from "./store/uiStore";
// Components
import GlobalProgress from "@/components/ui/GlobalProgress";
import ToastViewport from "@/components/ui/ToastViewport";
import GlobalSettingsPanel from "@/components/form/GlobalSettingsPanel";
import SeoHead from "@/components/ui/SeoHead";
import RouteExperience from "@/components/layout/RouteExperience";
import EntryAnimationGate from "@/components/entry/EntryAnimationGate";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { PrefetchProvider } from "./hooks/useRoutePrefetch";

// Route and shell boundaries
const Navbar = lazy(() => import("@/components/layout/Navbar"));
const Footer = lazy(() => import("@/components/layout/Footer"));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const MobileWrapperPage = lazy(() => import("@/components/mobile/MobileWrapperPage"));
const AnnouncementBanner = lazy(() => import("@/components/business/AnnouncementBanner"));
const DynamicBranding = lazy(() => import("@/components/business/DynamicBranding"));

// Pages
const Home = lazy(() => import("./pages/Home"));
const ServerList = lazy(() => import("./pages/ServerList"));
const News = lazy(() => import("./pages/News"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const OAuthCallback = lazy(() => import("./pages/auth/OAuthCallback"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));
const ServerEditor = lazy(() => import("./pages/ServerEditor"));
const TicketList = lazy(() => import("./pages/TicketList"));
const TicketCreate = lazy(() => import("./pages/TicketCreate"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const MyServers = lazy(() => import("./pages/MyServers"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const MyServerFavorites = lazy(() => import("./pages/MyServerFavorites"));
const ProfileTags = lazy(() => import("./pages/ProfileTags"));
const NewsSubmission = lazy(() => import("./pages/NewsSubmission"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReview = lazy(() => import("./pages/admin/AdminReview"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminAuditStats = lazy(() => import("./pages/admin/AdminAuditStats"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminPortSecurity = lazy(() => import("./pages/admin/AdminPortSecurity"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminMailConfig = lazy(() => import("./pages/admin/AdminMailConfig"));
const AdminAiConfig = lazy(() => import("./pages/admin/AdminAiConfig"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminFreeDomains = lazy(() => import("./pages/admin/AdminFreeDomains"));
const UserPublicProfile = lazy(() => import("./pages/UserPublicProfile"));
const SearchPage = lazy(() => import("./pages/Search"));
const OAuthSelection = lazy(() => import("./pages/auth/OAuthSelection"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ComplianceCenter = lazy(() => import("./pages/ComplianceCenter"));
const CompliancePolicy = lazy(() => import("./pages/CompliancePolicy"));
const MobileHome = lazy(() => import("./pages/MobileHome"));
const ResourceCenter = lazy(() => import("./pages/ResourceCenter"));
const Team = lazy(() => import("./pages/Team"));
const LevelRules = lazy(() => import("./pages/LevelRules"));
const ServerPortal = lazy(() => import("./pages/ServerPortal"));
const CommercialFeatureDisabled = lazy(() => import("./pages/CommercialFeatureDisabled"));

// Mobile components
const MobileTicketList = lazy(() => import("./components/mobile/MobileTicketList"));
const MobileServerDetail = lazy(() => import("./components/mobile/MobileServerDetail"));
const MobileUserCenter = lazy(() => import("./components/mobile/MobileUserCenter"));
const MobileEditor = lazy(() => import("./components/mobile/MobileEditor"));
const MobileSettings = lazy(() => import("./components/mobile/MobileSettings"));
const MobileNotifications = lazy(() => import("./components/mobile/MobileNotifications"));
const MobileSearch = lazy(() => import("./components/mobile/MobileSearch"));
const MobileMessages = lazy(() => import("./components/mobile/MobileMessages"));
const MobileTicketCreate = lazy(() => import("./components/mobile/MobileTicketCreate"));
const MobileTicketDetail = lazy(() => import("./components/mobile/MobileTicketDetail"));

const compliancePolicyRoutes = [
  { path: '/acceptable-use', title: '可接受使用政策' },
  { path: '/minor-protection', title: '未成年人保护规则' },
  { path: '/cookies-and-services', title: 'Cookie 与第三方服务清单' },
  { path: '/prohibited-items', title: '平台禁止内容清单' },
  { path: '/ip-complaints', title: '知识产权投诉规则' },
  { path: '/reporting-rules', title: '举报与内容处置规则' },
] as const;

const detectInitialMobileShell = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const forceMobileByUrl =
    window.location.pathname.startsWith('/mobile') ||
    window.location.hash.startsWith('#/mobile') ||
    new URLSearchParams(window.location.search).get('mobile') === '1';

  const isNarrowViewport = window.matchMedia('(max-width: 767.98px)').matches;
  return forceMobileByUrl || isNarrowViewport;
};

function App() {
  const { hydrateFromSession, isAuthenticated, isLoading, user } = useAuthStore(
    useShallow((state) => ({
      hydrateFromSession: state.hydrateFromSession,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
    }))
  );
  const accent = useUIStore((state) => state.accent);
  const [isMobileShell] = useState(detectInitialMobileShell);

  const {
    backendReady,
    isLoading: backendHealthLoading,
    isError: backendHealthError,
  } = useBackendHealth();

  const LoadingState = () => (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-7xl items-center justify-center px-4 py-12" role="status" aria-live="polite">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[14px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="relative h-8 w-8" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-black" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-900">正在加载页面</p>
          {!backendReady && (
            <p className="text-xs leading-5 text-zinc-500">
              服务连接较慢，页面会在数据就绪后自动更新。
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    if (isLoading) return <LoadingState />;
    if (!backendReady && !isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  const RequireEmailVerified = ({ children }: { children: React.ReactNode }) => {
    if (isLoading) return <LoadingState />;
    if (!backendReady && !isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    const email = user?.email ?? '';
    if (!user?.email_verified) {
      return <Navigate to={`/verify-code?email=${encodeURIComponent(email)}`} replace />;
    }
    return <>{children}</>;
  };

  const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
    if (isLoading) return <LoadingState />;
    if (!backendReady && !isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    const role = String(user?.role || '').toUpperCase();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return (
        <main className="mx-auto flex min-h-[60dvh] w-full max-w-2xl items-center justify-center px-6 py-16 text-center">
          <div>
            <p className="text-sm font-semibold text-accent">访问受限</p>
            <h1 className="mt-3 text-3xl font-black text-zinc-950">你没有权限访问此页面</h1>
            <p className="mt-4 text-sm leading-7 text-zinc-600">此功能仅对平台管理员开放。</p>
            <Link to="/" className="mt-8 inline-flex rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]">
              返回首页
            </Link>
          </div>
        </main>
      );
    }
    return <>{children}</>;
  };

  const RedirectIfAuthed = ({ children }: { children: React.ReactNode }) => {
    if (!isLoading && isAuthenticated && !user?.email_verified) {
      const email = user?.email ?? '';
      return <Navigate to={`/verify-code?email=${encodeURIComponent(email)}`} replace />;
    }
    if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
  };

  useEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  // Apply persisted accent theme CSS data-attribute on mount and change
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  // ─── Mobile routes shared wrapper ────────────────────────────────
  const mobileRoutes = (
    <>
      <Route path="/mobile" element={<MobileWrapperPage><MobileHome /></MobileWrapperPage>} />
      <Route path="/servers" element={<MobileWrapperPage title="发现"><MobileSearch /></MobileWrapperPage>} />
      <Route path="/news" element={<MobileWrapperPage title="新闻"><News /></MobileWrapperPage>} />
      <Route path="/resources" element={<MobileWrapperPage title="资源中心"><ResourceCenter /></MobileWrapperPage>} />
      <Route path="/team" element={<MobileWrapperPage title="团队"><Team /></MobileWrapperPage>} />
      <Route path="/user/:id" element={<MobileWrapperPage title="用户主页" hideNav><UserPublicProfile /></MobileWrapperPage>} />
      <Route path="/portal/:uuid" element={<MobileWrapperPage title="服务器门户" hideNav><ServerPortal /></MobileWrapperPage>} />
      <Route path="/server/:id" element={<MobileWrapperPage title="服务器详情" hideNav><MobileServerDetail /></MobileWrapperPage>} />
      <Route path="/search" element={<MobileWrapperPage title="搜索"><MobileSearch /></MobileWrapperPage>} />
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/login/oauth" element={<RedirectIfAuthed><OAuthSelection /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
      <Route path="/reset-password" element={<RedirectIfAuthed><ResetPassword /></RedirectIfAuthed>} />
      <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
      <Route path="/verify-code" element={<VerifyEmail />} />
      <Route path="/terms" element={<MobileWrapperPage title="服务条款"><Terms /></MobileWrapperPage>} />
      <Route path="/privacy" element={<MobileWrapperPage title="隐私声明"><Privacy /></MobileWrapperPage>} />
      <Route path="/compliance" element={<MobileWrapperPage title="合规与交易规则"><ComplianceCenter /></MobileWrapperPage>} />
      {compliancePolicyRoutes.map(({ path, title }) => (
        <Route key={path} path={path} element={<MobileWrapperPage title={title}><CompliancePolicy /></MobileWrapperPage>} />
      ))}
      <Route path="/rules" element={<MobileWrapperPage title="规则"><LevelRules /></MobileWrapperPage>} />
      <Route path="/messages" element={<RequireAuth><MobileWrapperPage title="消息"><MobileMessages /></MobileWrapperPage></RequireAuth>} />
      <Route path="/editor" element={<RequireEmailVerified><MobileWrapperPage title="发布" hideNav><MobileEditor /></MobileWrapperPage></RequireEmailVerified>} />
      <Route path="/me" element={<MobileWrapperPage title="我的"><MobileUserCenter /></MobileWrapperPage>} />
      <Route path="/me/edit" element={<RequireAuth><MobileWrapperPage title="编辑资料" hideNav><ProfileEdit /></MobileWrapperPage></RequireAuth>} />
      <Route path="/me/favorites" element={<RequireAuth><MobileWrapperPage title="我的收藏" hideNav><MyServerFavorites /></MobileWrapperPage></RequireAuth>} />
      <Route path="/me/tags" element={<RequireAuth><MobileWrapperPage title="兴趣标签" hideNav><ProfileTags /></MobileWrapperPage></RequireAuth>} />
      <Route path="/me/news-submit" element={<RequireEmailVerified><MobileWrapperPage title="投稿新闻" hideNav><NewsSubmission /></MobileWrapperPage></RequireEmailVerified>} />
      <Route path="/me/settings" element={<RequireAuth><MobileWrapperPage title="设置"><MobileSettings /></MobileWrapperPage></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><MobileWrapperPage title="设置"><MobileSettings /></MobileWrapperPage></RequireAuth>} />
      <Route path="/me/notifications" element={<RequireAuth><MobileWrapperPage title="通知"><MobileNotifications /></MobileWrapperPage></RequireAuth>} />
      <Route path="/tickets" element={<RequireAuth><MobileWrapperPage title="工单"><MobileTicketList /></MobileWrapperPage></RequireAuth>} />
      <Route path="/tickets/:id" element={<RequireAuth><MobileWrapperPage title="工单详情" hideNav><MobileTicketDetail /></MobileWrapperPage></RequireAuth>} />
      <Route path="/tickets/new" element={<RequireEmailVerified><MobileWrapperPage title="新建工单" hideNav><MobileTicketCreate /></MobileWrapperPage></RequireEmailVerified>} />
      <Route path="/dashboard" element={<MobileWrapperPage title="个人中心"><MobileUserCenter /></MobileWrapperPage>} />
      <Route path="/dashboard/servers" element={<RequireAuth><MobileWrapperPage title="我的服务器"><MyServers /></MobileWrapperPage></RequireAuth>} />
      <Route path="/dashboard/billing" element={<CommercialFeatureDisabled />} />
      <Route path="/dashboard/tickets" element={<RequireAuth><Navigate to="/tickets" replace /></RequireAuth>} />
      <Route path="/dashboard/tickets/new" element={<RequireEmailVerified><Navigate to="/tickets/new" replace /></RequireEmailVerified>} />
      <Route path="/dashboard/tickets/:id" element={<RequireAuth><MobileWrapperPage title="工单详情" hideNav><MobileTicketDetail /></MobileWrapperPage></RequireAuth>} />
      <Route path="/dashboard/profile" element={<RequireAuth><Navigate to="/me" replace /></RequireAuth>} />
      <Route path="/payment/*" element={<CommercialFeatureDisabled />} />
      <Route path="/billing/*" element={<CommercialFeatureDisabled />} />
      <Route path="/marketplace/*" element={<CommercialFeatureDisabled />} />
      <Route path="/promotion/*" element={<CommercialFeatureDisabled />} />
      <Route path="/seller/*" element={<CommercialFeatureDisabled />} />
      <Route path="/shop/*" element={<CommercialFeatureDisabled />} />
      <Route path="/admin-qianfu/*" element={<CommercialFeatureDisabled />} />
      <Route path="/admin-promo/*" element={<CommercialFeatureDisabled />} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-review" element={<RequireAdmin><AdminLayout><AdminReview /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-tickets" element={<RequireAdmin><AdminLayout><AdminTickets /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-reports" element={<RequireAdmin><AdminLayout><AdminReports /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-audit" element={<RequireAdmin><AdminLayout><AdminLogs /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-audit-stats" element={<RequireAdmin><AdminLayout><AdminAuditStats /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-moderation" element={<RequireAdmin><AdminLayout><AdminModeration /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-port5555" element={<RequireAdmin><AdminLayout><AdminPortSecurity /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-settings" element={<RequireAdmin><AdminLayout><AdminSettings /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-mail" element={<RequireAdmin><AdminLayout><AdminMailConfig /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-ai" element={<RequireAdmin><AdminLayout><AdminAiConfig /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-announcements" element={<RequireAdmin><AdminLayout><AdminAnnouncements /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-free-domains" element={<RequireAdmin><AdminLayout><AdminFreeDomains /></AdminLayout></RequireAdmin>} />
      <Route path="/" element={<Navigate to="/mobile" replace />} />
      <Route path="*" element={<Navigate to="/mobile" replace />} />
    </>
  );

  // ─── Desktop routes ─────────────────────────────────────────────
  const desktopRoutes = (
    <>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/servers" element={<ServerList />} />
      <Route path="/news" element={<News />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/server/:id" element={<ServerDetail />} />
      <Route path="/user/:id" element={<UserPublicProfile />} />
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/login/oauth" element={<RedirectIfAuthed><OAuthSelection /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
      <Route path="/reset-password" element={<RedirectIfAuthed><ResetPassword /></RedirectIfAuthed>} />
      <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/compliance" element={<ComplianceCenter />} />
      {compliancePolicyRoutes.map(({ path }) => (
        <Route key={path} path={path} element={<CompliancePolicy />} />
      ))}
      <Route path="/rules" element={<LevelRules />} />
      <Route path="/resources" element={<ResourceCenter />} />
      <Route path="/team" element={<Team />} />
      <Route path="/portal/:uuid" element={<ServerPortal />} />

      {/* Auth Routes */}
       <Route path="/verify-code" element={<VerifyEmail />} />
      
      {/* Locked/Gated Routes */}
      <Route path="/editor" element={<RequireEmailVerified><ServerEditor /></RequireEmailVerified>} />
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route path="/tickets" element={<RequireAuth><TicketList /></RequireAuth>} />
      <Route path="/tickets/new" element={<RequireEmailVerified><TicketCreate /></RequireEmailVerified>} />
      <Route path="/tickets/:id" element={<RequireAuth><TicketDetail /></RequireAuth>} />
      <Route path="/me" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/me/edit" element={<RequireAuth><ProfileEdit /></RequireAuth>} />
      <Route path="/me/favorites" element={<RequireAuth><MyServerFavorites /></RequireAuth>} />
      <Route path="/me/tags" element={<RequireAuth><ProfileTags /></RequireAuth>} />
      <Route path="/me/news-submit" element={<RequireEmailVerified><NewsSubmission /></RequireEmailVerified>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
       <Route path="/me/settings" element={<RequireAuth><Settings /></RequireAuth>} />
       <Route path="/payment/*" element={<CommercialFeatureDisabled />} />
       <Route path="/billing/*" element={<CommercialFeatureDisabled />} />
       <Route path="/marketplace/*" element={<CommercialFeatureDisabled />} />
       <Route path="/promotion/*" element={<CommercialFeatureDisabled />} />
       <Route path="/seller/*" element={<CommercialFeatureDisabled />} />
       <Route path="/shop/*" element={<CommercialFeatureDisabled />} />
       <Route path="/admin-qianfu/*" element={<CommercialFeatureDisabled />} />
       <Route path="/admin-promo/*" element={<CommercialFeatureDisabled />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-review" element={<RequireAdmin><AdminLayout><AdminReview /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-tickets" element={<RequireAdmin><AdminLayout><AdminTickets /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-reports" element={<RequireAdmin><AdminLayout><AdminReports /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-audit" element={<RequireAdmin><AdminLayout><AdminLogs /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-audit-stats" element={<RequireAdmin><AdminLayout><AdminAuditStats /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-moderation" element={<RequireAdmin><AdminLayout><AdminModeration /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-port5555" element={<RequireAdmin><AdminLayout><AdminPortSecurity /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-settings" element={<RequireAdmin><AdminLayout><AdminSettings /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-mail" element={<RequireAdmin><AdminLayout><AdminMailConfig /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-ai" element={<RequireAdmin><AdminLayout><AdminAiConfig /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-announcements" element={<RequireAdmin><AdminLayout><AdminAnnouncements /></AdminLayout></RequireAdmin>} />
      <Route path="/admin-free-domains" element={<RequireAdmin><AdminLayout><AdminFreeDomains /></AdminLayout></RequireAdmin>} />

      {/* Redirect mobile path on desktop */}
      <Route path="/mobile" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<RequireAuth><div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6"><MobileMessages /></div></RequireAuth>} />
      <Route path="/me/notifications" element={<RequireAuth><div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6"><MobileNotifications /></div></RequireAuth>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </>
  );

  return (
    <EntryAnimationGate>
      <Router>
        <PrefetchProvider>
        <SeoHead />
        <RouteExperience />
        <Suspense fallback={null}>
          <DynamicBranding />
          <AnnouncementBanner />
        </Suspense>
        <GlobalProgress />
        <ToastViewport />
        <GlobalSettingsPanel />
        <div className="min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[300] rounded-lg bg-black px-4 py-3 text-sm font-bold text-white focus:not-sr-only"
        >
          跳到主要内容
        </a>
        {/* Desktop-only header — do not fetch the desktop shell for mobile visitors. */}
        {!isMobileShell ? (
          <div className="hidden md:block">
            <Suspense fallback={<div className="h-16 border-b border-zinc-100 bg-white" aria-hidden="true" />}>
              <Navbar />
            </Suspense>
          </div>
        ) : null}

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="flex-grow">
          <Suspense fallback={<LoadingState />}>
            <Routes>
              {isMobileShell ? mobileRoutes : desktopRoutes}
            </Routes>
          </Suspense>
        </main>

        {/* Desktop-only footer — do not fetch the desktop shell for mobile visitors. */}
        {!isMobileShell ? (
          <div className="hidden md:block">
            <Suspense fallback={null}>
              <Footer
                backendReady={backendReady}
                backendHealthLoading={backendHealthLoading}
                backendHealthError={backendHealthError}
              />
            </Suspense>
          </div>
        ) : null}
        </div>
        </PrefetchProvider>
      </Router>
    </EntryAnimationGate>
  );
}

export default App;
