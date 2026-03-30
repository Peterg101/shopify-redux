import { screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { VerifyEmailPage } from '../VerifyEmailPage'

test('shows loading spinner initially with valid token', () => {
  renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=test-token' })
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()
})

test('shows error when no token provided', async () => {
  renderWithProviders(<VerifyEmailPage />, { route: '/verify-email' })
  await waitFor(() => {
    expect(screen.getByText(/no verification token provided/i)).toBeInTheDocument()
  })
})

test('shows resend button on error', async () => {
  renderWithProviders(<VerifyEmailPage />, { route: '/verify-email' })
  await waitFor(() => {
    expect(screen.getByText(/no verification token provided/i)).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
})

test('shows Email Verification heading', () => {
  renderWithProviders(<VerifyEmailPage />, { route: '/verify-email?token=test-token' })
  expect(screen.getByText('Email Verification')).toBeInTheDocument()
})
