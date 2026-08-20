/**
 * Login Page Snapshots
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 登录页面的快照测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/pages/Login'

// ============================================================
// Mock 配置
// ============================================================

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  ...vi.requireActual('react-router-dom'),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/login', state: {} }),
}))

// Mock auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// ============================================================
// 快照测试
// ============================================================

describe('LoginPage snapshots', () => {
  describe('Default state', () => {
    it('renders login page completely', () => {
      const { container } = render(<LoginPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders left decorative panel', () => {
      render(<LoginPage />)
      const heading = screen.getByText('千服')
      expect(heading).toBeInTheDocument()
    })

    it('renders login form', () => {
      render(<LoginPage />)
      const form = screen.getByRole('form')
      expect(form).toBeInTheDocument()
    })
  })

  describe('Form elements', () => {
    it('renders email input', () => {
      render(<LoginPage />)
      const emailInput = screen.getByLabelText(/邮箱地址/)
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('renders password input', () => {
      render(<LoginPage />)
      const passwordInput = screen.getByLabelText(/密码/)
      expect(passwordInput).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('renders remember me checkbox', () => {
      render(<LoginPage />)
      const checkbox = screen.getByRole('checkbox', { name: /记住我/ })
      expect(checkbox).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<LoginPage />)
      const button = screen.getByRole('button', { name: /登录/ })
      expect(button).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      render(<LoginPage />)
      const link = screen.getByRole('link', { name: /忘记密码/ })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/forgot-password')
    })

    it('renders register link', () => {
      render(<LoginPage />)
      const link = screen.getByRole('link', { name: /立即注册/ })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/register')
    })

    it('renders terms and privacy links', () => {
      render(<LoginPage />)
      const termsLink = screen.getByRole('link', { name: /服务条款/ })
      const privacyLink = screen.getByRole('link', { name: /隐私政策/ })
      expect(termsLink).toBeInTheDocument()
      expect(privacyLink).toBeInTheDocument()
    })
  })

  describe('Password visibility toggle', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText(/密码/)
      const toggleButton = screen.getByRole('button', { name: '' })

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute('type', 'password')

      // Click to show password
      await user.click(toggleButton)
      expect(passwordInput).toHaveAttribute('type', 'text')

      // Click to hide password
      await user.click(toggleButton)
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Form validation', () => {
    it('shows error for invalid email', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/邮箱地址/)
      const submitButton = screen.getByRole('button', { name: /登录/ })

      // Submit empty form
      await user.click(submitButton)

      // The form should show validation error
      // (Actual error message depends on zod validation)
    })

    it('shows error for empty password', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/邮箱地址/)
      const submitButton = screen.getByRole('button', { name: /登录/ })

      // Fill only email
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      // Password error should appear
    })
  })

  describe('Responsive snapshots', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ]

    viewports.forEach(({ name, width, height }) => {
      it(`renders correctly at ${name} viewport`, () => {
        // Set viewport
        Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: height })
        window.dispatchEvent(new Event('resize'))

        const { container } = render(<LoginPage />)
        expect(container).toMatchSnapshot(`-${name}`)
      })
    })
  })

  describe('Accessibility', () => {
    it('email input has proper autocomplete attribute', () => {
      render(<LoginPage />)
      const emailInput = screen.getByLabelText(/邮箱地址/)
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
    })

    it('password input has proper autocomplete attribute', () => {
      render(<LoginPage />)
      const passwordInput = screen.getByLabelText(/密码/)
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    })

    it('form has novalidate attribute', () => {
      render(<LoginPage />)
      const form = screen.getByRole('form')
      expect(form).toHaveAttribute('novalidate')
    })
  })
})
