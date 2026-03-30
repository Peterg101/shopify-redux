import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { VerifyEmailBanner } from '../VerifyEmailBanner'

test('renders nothing when user info is null', () => {
  const { container } = renderWithProviders(<VerifyEmailBanner />)
  expect(container.firstChild).toBeNull()
})

test('renders nothing when email is verified', () => {
  const { container } = renderWithProviders(<VerifyEmailBanner />, {
    preloadedState: {
      userInterfaceState: {
        userInformation: { user_id: 'u1', username: 'test', email: 'test@test.com', email_verified: true },
      } as any,
    },
  })
  expect(container.firstChild).toBeNull()
})

test('shows warning when email is not verified', () => {
  renderWithProviders(<VerifyEmailBanner />, {
    preloadedState: {
      userInterfaceState: {
        userInformation: { user_id: 'u1', username: 'test', email: 'test@test.com', email_verified: false },
      } as any,
    },
  })
  expect(screen.getByText(/verify your email/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
})

test('resend button is initially enabled', () => {
  renderWithProviders(<VerifyEmailBanner />, {
    preloadedState: {
      userInterfaceState: {
        userInformation: { user_id: 'u1', username: 'test', email: 'test@test.com', email_verified: false },
      } as any,
    },
  })
  const button = screen.getByRole('button', { name: /resend/i })
  expect(button).not.toBeDisabled()
})
