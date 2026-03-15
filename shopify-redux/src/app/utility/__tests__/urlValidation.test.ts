import { isValidRedirectUrl, safeRedirect } from '../urlValidation'

describe('urlValidation', () => {
  // ── isValidRedirectUrl ───────────────────────────────────────────────
  describe('isValidRedirectUrl', () => {
    // Default test environment (NODE_ENV = 'test') behaves like production
    describe('in test/production environment', () => {
      it('accepts https URLs', () => {
        expect(isValidRedirectUrl('https://example.com')).toBe(true)
      })

      it('accepts https URLs with paths', () => {
        expect(isValidRedirectUrl('https://example.com/checkout?session=abc')).toBe(true)
      })

      it('rejects http URLs', () => {
        expect(isValidRedirectUrl('http://example.com')).toBe(false)
      })

      it('rejects javascript: protocol', () => {
        expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false)
      })

      it('rejects data: protocol', () => {
        expect(isValidRedirectUrl('data:text/html,<h1>hi</h1>')).toBe(false)
      })

      it('rejects ftp: protocol', () => {
        expect(isValidRedirectUrl('ftp://files.example.com')).toBe(false)
      })

      it('rejects malformed URLs', () => {
        expect(isValidRedirectUrl('not-a-url')).toBe(false)
      })

      it('rejects empty string', () => {
        expect(isValidRedirectUrl('')).toBe(false)
      })

      it('rejects URL with only protocol', () => {
        expect(isValidRedirectUrl('https://')).toBe(false)
      })
    })

    describe('in development environment', () => {
      const originalEnv = process.env.NODE_ENV

      beforeEach(() => {
        process.env.NODE_ENV = 'development'
      })

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('accepts https URLs', () => {
        expect(isValidRedirectUrl('https://example.com')).toBe(true)
      })

      it('accepts http URLs', () => {
        expect(isValidRedirectUrl('http://localhost:3000')).toBe(true)
      })

      it('accepts http with standard domain', () => {
        expect(isValidRedirectUrl('http://example.com')).toBe(true)
      })

      it('still rejects javascript: protocol', () => {
        expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false)
      })

      it('still rejects malformed URLs', () => {
        expect(isValidRedirectUrl('not-a-url')).toBe(false)
      })
    })
  })

  // ── safeRedirect ─────────────────────────────────────────────────────
  describe('safeRedirect', () => {
    const originalLocation = window.location

    beforeEach(() => {
      // Replace window.location with a writable mock
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      })
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      })
      jest.restoreAllMocks()
    })

    it('sets window.location.href for valid https URL', () => {
      safeRedirect('https://stripe.com/checkout')
      expect(window.location.href).toBe('https://stripe.com/checkout')
    })

    it('does NOT set window.location.href for invalid URL', () => {
      safeRedirect('javascript:alert(1)')
      expect(window.location.href).toBe('')
    })

    it('logs an error for invalid URL', () => {
      safeRedirect('javascript:alert(1)')
      expect(console.error).toHaveBeenCalledWith(
        'Blocked redirect to unsafe URL:',
        'javascript:alert(1)'
      )
    })

    it('does NOT set window.location.href for http in test/production', () => {
      safeRedirect('http://example.com')
      expect(window.location.href).toBe('')
    })

    it('logs an error for http in test/production', () => {
      safeRedirect('http://example.com')
      expect(console.error).toHaveBeenCalledWith(
        'Blocked redirect to unsafe URL:',
        'http://example.com'
      )
    })

    it('does NOT set window.location.href for empty string', () => {
      safeRedirect('')
      expect(window.location.href).toBe('')
    })
  })
})
