import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, lazy, useMemo, type ComponentType } from "react";
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from "./store/authStore";
import { useUIStore, applyAccent } from "./store/uiStore";
import { useMobile } from "./hooks/useMobile";
import MobileLayout from "./components/mobile/MobileLayout";
import MobileWrapperPage from "./components/mobile/MobileWrapperPage";

// Components
import Navbar from "./components/Navbar";
import AdminLayout from "./components/admin/AdminLayout";
import GlobalProgress from "./components/GlobalProgress";
import AnnouncementBanner from "./components/AnnouncementBanner";
import Footer from "./components/Footer";
import GlobalSettingsPanel from "./components/GlobalSettingsPanel";

// Pages
const Home = lazy(() => import("./pages/Home"));
const ServerList = lazy(() => import("./pages/ServerList"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Payment = lazy(() => import("./pages/Payment"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));
const ServerEditor = lazy(() => import("./pages/ServerEditor"));
const TicketList = lazy(() => import("./pages/TicketList"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReview = lazy(() => import("./pages/admin/AdminReview"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminAuditStats = lazy(() => import("./pages/admin/AdminAuditStats"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminPortSecurity = lazy(() => import("./pages/admin/AdminPortSecurity"));
const AdminPaymentConfig = lazy(() => import("./pages/admin/AdminPaymentConfig"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const UserPublicProfile = lazy(() => import("./pages/UserPublicProfile"));
const SearchPage = lazy(() => import("./pages/Search"));
const OAuthSelection = lazy(() => import("./pages/auth/OAuthSelection"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const MobileHome = lazy(() => import("./pages/MobileHome"));
const PromotionLanding = lazy(() => import("./pages/PromotionLanding"));
const ResourceCenter = lazy(() => import("./pages/ResourceCenter"));
const Team = lazy(() => import("./pages/Team"));
const ServerPortal = lazy(() => import("./pages/ServerPortal"));
const MarketplaceShop = lazy(() => import("./pages/MarketplaceShop"));
const MarketplaceDetail = lazy(() => import("./pages/MarketplaceDetail"));
const MarketplaceManage = lazy(() => import("./pages/MarketplaceManage"));
const AdminPromoTasks = lazy(() => import("./pages/admin/AdminPromoTasks"));
const AdminPromoClaims = lazy(() => import("./pages/admin/AdminPromoClaims"));

// Mobile components
const MobileTicketList = lazy(() => import("./components/mobile/MobileTicketList"));
const MobileServerDetail = lazy(() => import("./components/mobile/MobileServerDetail"));
const MobileUserCenter = lazy(() => import("./components/mobile/MobileUserCenter"));
const MobileAdminDashboard = lazy(() => import("./components/mobile/MobileAdminDashboard"));
const MobileEditor = lazy(() => import("./components/mobile/MobileEditor"));
const MobileSettings = lazy(() => import("./components/mobile/MobileSettings"));
const MobileNotifications = lazy(() => import("./components/mobile/MobileNotifications"));
const MobileSearch = lazy(() => import("./components/mobile/MobileSearch"));
const MobilePayment = lazy(() => import("./components/mobile/MobilePayment"));
const MobileMessages = lazy(() => import("./components/mobile/MobileMessages"));
const MobileTicketCreate = lazy(() => import("./components/mobile/MobileTicketCreate"));
const MobileTicketDetail = lazy(() => import("./components/mobile/MobileTicketDetail"));

const queryClient = new QueryClient();

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
  const { isMobile } = useMobile(768);

  const { data: backendReady = true } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then((r) => r.ok),
    staleTime: 15_000,
    retry: 1,
  });

  const LoadingState = () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">INITIALIZING_SESSION...</p>
        {!backendReady && (
          <p className="max-w-sm text-xs leading-6 text-zinc-400">
            后端当前不可用，正在使用降级模式加载页面。
          </p>
        )}
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
    if (user?.role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  const RedirectIfAuthed = ({ children }: { children: React.ReactNode }) => {
    if (isLoading) return <LoadingState />;
    if (isAuthenticated) return <Navigate to="/" replace />;
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
  const mobileRoutes = useMemo(
    <>
      <Route path="/mobile" element={<MobileWrapperPage><MobileHome /></MobileWrapperPage>} />
      <Route path="/servers" element={<MobileWrapperPage title="发现"><ServerList /></MobileWrapperPage>} />
      <Route path="/server/:id" element={<MobileWrapperPage title="服务器详情"><MobileServerDetail /></MobileWrapperPage>} />
      <Route path="/search" element={<MobileWrapperPage title="搜索"><MobileSearch /></MobileWrapperPage>} />
      <Route path="/messages" element={<MobileWrapperPage title="消息"><MobileMessages /></MobileWrapperPage>} />
      <Route path="/editor" element={<MobileWrapperPage title="发布"><MobileEditor /></MobileWrapperPage>} />
      <Route path="/payment" element={<MobileWrapperPage title="支付"><MobilePayment /></MobileWrapperPage>} />
      <Route path="/me" element={<MobileWrapperPage title="我的"><MobileUserCenter /></MobileWrapperPage>} />
      <Route path="/me/settings" element={<MobileWrapperPage title="设置"><MobileSettings /></MobileWrapperPage>} />
      <Route path="/me/notifications" element={<MobileWrapperPage title="通知"><MobileNotifications /></MobileWrapperPage>} />
      <Route path="/tickets" element={<MobileWrapperPage title="工单"><MobileTicketList /></MobileWrapperPage>} />
      <Route path="/tickets/:id" element={<MobileWrapperPage title="工单详情"><MobileTicketDetail /></MobileWrapperPage>} />
      <Route path="/tickets/new" element={<MobileWrapperPage title="新建工单"><MobileTicketCreate /></MobileWrapperPage>} />
      <Route path="/dashboard" element={<MobileWrapperPage title="仪表盘"><MobileAdminDashboard /></MobileWrapperPage>} />
      <Route path="/" element={<Navigate to="/mobile" replace />} />
    </>,
    []
  );

  // ─── Desktop routes ─────────────────────────────────────────────
  const desktopRoutes = (
    <>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/servers" element={<ServerList />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/server/:id" element={<ServerDetail />} />
      <Route path="/user/:id" element={<UserPublicProfile />} />
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/login/oauth" element={<RedirectIfAuthed><OAuthSelection /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
      <Route path="/reset-password" element={<RedirectIfAuthed><ResetPassword /></RedirectIfAuthed>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/promotion" element={<PromotionLanding />} />
      <Route path="/promotion/tasks" element={<RequireAuth><AdminPromoTasks /></RequireAuth>} />
      <Route path="/promotion/claims" element={<RequireAuth><AdminPromoClaims /></RequireAuth>} />
      <Route path="/rules" element={<Navigate to="/team" replace />} />
      <Route path="/resources" element={<ResourceCenter />} />
      <Route path="/team" element={<Team />} />
      <Route path="/portal/:uuid" element={<ServerPortal />} />
      <Route path="/shop/:id" element={<MarketplaceShop />} />
      <Route path="/marketplace/products/:id" element={<MarketplaceDetail />} />
      <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
      <Route path="/seller/shop" element={<RequireAuth><MarketplaceManage /></RequireAuth>} />
      <Route path="/seller/marketplace" element={<RequireAuth><MarketplaceManage /></RequireAuth>} />
      <Route path="/marketplace/shop" element={<MarketplaceShop />} />
      <Route path="/marketplace/manage" element={<RequireAuth><MarketplaceManage /></RequireAuth>} />

      {/* Auth Routes */}
      <Route path="/verify-code" element={<RequireAuth><VerifyEmail /></RequireAuth>} />
      
      {/* Payment Results */}
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/fail" element={<PaymentFail />} />

      {/* Locked/Gated Routes */}
      <Route path="/payment" element={<Payment />} />
      <Route path="/editor" element={<RequireEmailVerified><ServerEditor /></RequireEmailVerified>} />
      <Route path="/dashboard/*" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/tickets" element={<RequireAuth><TicketList /></RequireAuth>} />
      <Route path="/tickets/:id" element={<RequireAuth><TicketDetail /></RequireAuth>} />
      <Route path="/me" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/me/edit" element={<RequireAuth><ProfileEdit /></RequireAuth>} />

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
      <Route path="/admin-qianfu" element={<RequireAdmin><AdminLayout><AdminPaymentConfig /></AdminLayout></RequireAdmin>} />

      {/* Redirect mobile path on desktop */}
      <Route path="/mobile" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<Navigate to="/tickets" replace />} />
      <Route path="/me/settings" element={<Navigate to="/me/edit" replace />} />
      <Route path="/me/notifications" element={<Navigate to="/" replace />} />
      <Route path="/tickets/new" element={<Navigate to="/tickets" replace />} />
      <Route path="/dashboard" element={<Navigate to="/dashboard/*" replace />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <GlobalProgress />
        <AnnouncementBanner />
        <GlobalSettingsPanel />
        <div className="min-h-screen flex flex-col">
          {/* Desktop-only header — hidden on mobile */}
          <div className="hidden md:block">
            <Navbar />
          </div>

          {/* Mobile header — hidden on desktop */}
          <div className="block md:hidden bg-white border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">千服</span>
              <div className="flex items-center gap-2">
                <a href="/me/settings" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100">
                  <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </a>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="flex-grow">
            <Suspense fallback={<LoadingState />}>
              <Routes>
                {isMobile ? mobileRoutes : desktopRoutes}
              </Routes>
            </Suspense>
          </div>

          {/* Desktop-only footer — hidden on mobile */}
          <div className="hidden md:block">
            <Footer />
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
