import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('personal filing feature closure', () => {
  it('does not expose commercial frontend routes or navigation', () => {
    const app = read('qianfu-liandeng/src/App.tsx')
    const navbar = read('qianfu-liandeng/src/components/layout/Navbar.tsx')
    const adminLayout = read('qianfu-liandeng/src/components/layout/AdminLayout.tsx')
    const mobileHome = read('qianfu-liandeng/src/pages/MobileHome.tsx')
    const branding = read('qianfu-liandeng/src/components/business/DynamicBranding.tsx')

    expect(app).toContain('CommercialFeatureDisabled')
    expect(app).toMatch(/<Route path="\/payment\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).toMatch(/<Route path="\/marketplace\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).toMatch(/<Route path="\/seller\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).toMatch(/<Route path="\/promotion\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(navbar).not.toContain("path: '/promotion'")
    expect(navbar).not.toContain('/marketplace/')
    expect(navbar).not.toContain('/payment')
    expect(read('qianfu-liandeng/src/components/ui/admin/AdminSidebar.tsx')).not.toContain('/admin-qianfu')
    expect(adminLayout).not.toMatch(/推广任务|领取审核|支付配置|推广、支付/)
    expect(mobileHome).not.toMatch(/\/marketplace\/|\/promotion/)
    expect(branding).not.toContain("label: '¥'")
  })

  it('routes retired commercial deep links to an explicit closure page', () => {
    const app = read('qianfu-liandeng/src/App.tsx')
    const dashboard = read('qianfu-liandeng/src/pages/Dashboard.tsx')

    expect(app).toContain('CommercialFeatureDisabled')
    for (const route of ['/payment/*', '/billing/*', '/marketplace/*', '/promotion/*', '/seller/*', '/shop/*']) {
      expect(app).toContain(`path="${route}"`)
    }
    expect(dashboard).toContain('path="billing/*"')
    expect(dashboard).toMatch(/path="billing\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).toMatch(/path="\/admin-qianfu\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).toMatch(/path="\/admin-promo\/\*" element={<CommercialFeatureDisabled \/>} \/>/)
    expect(app).not.toMatch(/path="\/admin-qianfu\/\*" element={<RequireAdmin>/)
    expect(app).not.toMatch(/path="\/admin-promo\/\*" element={<RequireAdmin>/)
  })

  it('does not register payment, wallet, or promotion API routers', () => {
    const routes = read('server/routes/index.ts')
    const serverEntry = read('server/index.ts')
    const userController = read('server/controllers/userController.ts')

    expect(routes).not.toContain("app.use(`${V1}/payment`")
    expect(routes).not.toContain("app.use(`${V1}/wallet`")
    expect(routes).not.toContain("app.use(`${V1}/promo`")
    expect(routes).not.toContain("app.use(`${V1}/admin/payment-projects`")
    expect(routes).not.toContain("app.use(`${V1}/payment/xpay-bridge`")
    expect(routes).not.toContain("app.use(`${V1}/payment/personal-qr`")
    expect(serverEntry).not.toContain('initPaymentHandlers')
    expect(userController).not.toContain('getWalletBalanceBreakdown')
    expect(userController).not.toMatch(/withdrawable_balance|non_withdrawable_balance|currency: wallet/)
  })

  it('keeps commercial API paths fail-closed in personal filing mode', () => {
    const routes = read('server/routes/index.ts')
    const middleware = read('server/middleware/personalFilingDisabled.ts')
    const policy = read('server/config/productionEnvPolicy.ts')

    expect(middleware).toContain('PERSONAL_FILING_DISABLED')
    expect(routes).toContain('commercialFeatureClosure')
    expect(read('server/middleware/commercialFeatureClosure.ts')).toContain('personalFilingDisabled')
    expect(policy).toContain("QIANFU_ENABLED must be false in personal filing mode")
    const closure = read('server/middleware/commercialFeatureClosure.ts')
    expect(closure).toContain("'/api/marketplace'")
    expect(closure).toContain("'/api/v1/marketplace'")
  })

  it('closes the standalone payment service in personal filing mode', () => {
    const app = read('services/payment-service/src/app.ts')
    const middleware = read('services/payment-service/src/middleware/personalFilingClosure.ts')
    const ecosystem = read('ecosystem.microservices.config.js')

    expect(app).toContain('personalFilingClosure')
    expect(app).toContain("app.use('/api/payments', personalFilingClosure")
    expect(app).toContain("app.use('/api/webhooks', personalFilingClosure")
    expect(middleware).toContain('PERSONAL_FILING_DISABLED')
    expect(ecosystem).not.toContain('qianfu-payment-service')
  })

  it('fails closed before database payment configuration can be used', () => {
    const payment = read('server/controllers/paymentController.ts')
    const projects = read('server/controllers/paymentProjectController.ts')

    expect(payment).toContain("assertCommercialFeatureEnabled('支付')")
    expect(projects).toContain("assertCommercialFeatureEnabled('支付配置')")
  })

  it('closes billing deep links in the mobile route table', () => {
    const app = read('qianfu-liandeng/src/App.tsx')

    expect(app).toMatch(/<Route path="\/dashboard\/billing" element={<CommercialFeatureDisabled \/>} \/>/)
  })

  it('does not define the standalone payment service in the production microservice set', () => {
    const ecosystem = read('ecosystem.microservices.config.js')
    const nginx = read('deploy/nginx.microservices.conf')
    const prometheus = read('deploy/prometheus.yml')

    expect(ecosystem).not.toContain('"name": "qianfu-payment-service"')
    expect(nginx).not.toContain('payment_service')
    expect(prometheus).not.toContain("job_name: 'payment-service'")
  })

  it('ships a public negative smoke check for the disabled commercial surface', () => {
    const smoke = read('scripts/verify-personal-filing-closure.mjs')

    expect(smoke).toContain('PERSONAL_FILING_DISABLED')
    for (const path of [
      '/api/payment',
      '/api/v1/payment',
      '/api/wallet',
      '/api/v1/wallet',
      '/api/promo',
      '/api/v1/promo',
      '/api/qianfu',
      '/api/v1/qianfu',
      '/api/marketplace',
      '/api/v1/marketplace',
      '/api/admin/payment-projects',
      '/api/v1/admin/payment-projects',
      '/api/payment/xpay-bridge',
      '/api/v1/payment/xpay-bridge',
      '/api/payment/personal-qr',
      '/api/v1/payment/personal-qr',
    ]) {
      expect(smoke).toContain(path)
    }
    expect(smoke).toContain('response.status !== 403')
  })

  it('keeps dynamic SEO output free of retired commercial surfaces', () => {
    const seo = read('server/controllers/seoController.ts')

    expect(seo).toContain("process.env.PERSONAL_FILING_MODE === 'true'")
    expect(seo).toContain('commercialFeaturesEnabled')
    expect(seo).toContain('commercialFeaturesEnabled\n    ? await prisma.marketplaceProduct.findMany')
    expect(seo).toContain('commercialFeaturesEnabled ? products.map')
    expect(seo).not.toContain("'/promotion',")
    expect(seo).toContain('本站不提供支付、钱包、商城或推广交易功能')
  })

  it('repairs persisted legacy announcements during the personal filing release', () => {
    const migration = read('prisma/migrations/20260812130000_personal_filing_announcement_cleanup/migration.postgresql.sql')
    const publisher = read('scripts/linux/publish-baota-release.sh')

    expect(publisher).toContain('20260812130000_personal_filing_announcement_cleanup/migration.postgresql.sql')
    expect(migration).toContain('PUBLIC_ANNOUNCEMENT:')
    expect(migration).toContain('个人备案模式')
    expect(migration).toContain('不提供支付、钱包、商城或推广交易服务')
  })

  it('does not allow marketplace order creation or paid listing plans', () => {
    const controller = read('server/core/controller/QianFuController.ts')
    const editor = read('qianfu-liandeng/src/pages/ServerEditor.tsx')

    expect(controller).not.toMatch(/router\.post\('\/marketplace\/orders'/)
    expect(editor).not.toContain('basic-monthly')
    expect(editor).not.toContain('pro-quarterly')
    expect(editor).not.toContain('vip-yearly')
    expect(editor).not.toContain('钱包余额')
  })

  it('keeps account surfaces free of wallet, billing, and promotion actions', () => {
    const dashboard = read('qianfu-liandeng/src/pages/Dashboard.tsx')
    const mobileCenter = read('qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx')
    const resources = read('qianfu-liandeng/src/pages/ResourceCenter.tsx')

    for (const source of [dashboard, mobileCenter, resources]) {
      expect(source).not.toMatch(/\/wallet(?:[/'"`]|$)/)
      expect(source).not.toMatch(/\/payment(?:[/'"`]|$)/)
      expect(source).not.toMatch(/\/dashboard\/billing(?:[/'"`]|$)/)
      expect(source).not.toMatch(/\/promotion(?:[/'"`]|$)/)
      expect(source).not.toContain('marketplace')
      expect(source).not.toContain('充值')
      expect(source).not.toContain('余额')
    }
  })

  it('keeps retired commercial page modules as explicit closure pages', () => {
    for (const file of [
      'qianfu-liandeng/src/pages/Billing.tsx',
      'qianfu-liandeng/src/pages/PaymentSuccess.tsx',
      'qianfu-liandeng/src/pages/PromotionOverview.tsx',
    ]) {
      const source = read(file)
      expect(source).toContain("from './CommercialFeatureDisabled'")
      expect(source).toContain('<CommercialFeatureDisabled />')
      expect(source).not.toMatch(/充值|支付已确认|奖励结算|推广任务|商城订单/)
    }
  })

  it('makes check-in an XP-only action without wallet settlement', () => {
    const controller = read('server/controllers/userLevelController.ts')

    expect(controller).not.toContain('creditCheckinRewardInTransaction')
    expect(controller).not.toContain('gainedBalance')
    expect(controller).not.toContain('walletBalance')
  })

  it('does not describe disabled commercial capabilities as active legal services', () => {
    const terms = read('qianfu-liandeng/src/pages/Terms.tsx')
    const register = read('qianfu-liandeng/src/pages/Register.tsx')
    const tickets = read('qianfu-liandeng/src/pages/TicketList.tsx')
    const compliance = read('qianfu-liandeng/src/pages/ComplianceCenter.tsx')
    const policies = read('qianfu-liandeng/src/pages/CompliancePolicy.tsx')
    const privacy = read('qianfu-liandeng/src/pages/Privacy.tsx')
    const seo = read('qianfu-liandeng/src/components/ui/SeoHead.tsx')
    const publicDocs = `${read('qianfu-liandeng/public/ai-plugin.json')}\n${read('qianfu-liandeng/public/llms.txt')}`
    const sitemap = read('qianfu-liandeng/public/sitemap.xml')

    expect(terms).not.toMatch(/LegalSection id="(?:payment|marketplace|wallet|promotion)"/)
    expect(terms).toContain('平台不提供交易')

    for (const source of [register, tickets]) {
      expect(source).not.toContain('充值')
      expect(source).not.toContain('支付')
      expect(source).not.toContain('钱包')
      expect(source).not.toContain('商城')
      expect(source).not.toContain('推广服务')
    }

    expect(compliance).not.toMatch(/交易规则中心|支付|订单|钱包|收费|退款政策/)
    expect(policies).not.toMatch(/\/digital-delivery|\/merchant-agreement|\/marketplace-rules|\/wallet-rules|\/pricing-disclosure/)
    expect(privacy).not.toMatch(/玩家市场|支付|订阅|订单|商品|退款|账单/)
    expect(seo).not.toMatch(/\/payment|\/promotion|\/marketplace|\/seller|\/wallet|退款政策|支付中心|推广中心/)
    expect(publicDocs).not.toMatch(/支付|充值|钱包|商城|推广|交易|billing|payment|marketplace|promotion/i)
    expect(sitemap).not.toMatch(/marketplace|promotion|payment|refund|pricing/i)
  })

  it('removes retired commercial translation keys', () => {
    const translations = read('qianfu-liandeng/src/store/uiStore.ts')

    expect(translations).not.toMatch(/'nav\.promotion'|'admin\.treasury'|'dash\.menu\.billing'/)
    expect(translations).not.toMatch(/'dash\.financial[^']*'|'payment\.fail[^']*'|'profile\.(wallet|billing|order)[^']*'/)
  })
})
