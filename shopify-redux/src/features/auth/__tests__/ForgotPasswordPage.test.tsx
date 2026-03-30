import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ForgotPasswordPage } from '../ForgotPasswordPage'

test('renders email input and submit button', () => {
  renderWithProviders(<ForgotPasswordPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
})

test('shows error when submitting empty email', async () => {
  renderWithProviders(<ForgotPasswordPage />)
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
  await waitFor(() => {
    expect(screen.getByText(/please enter your email/i)).toBeInTheDocument()
  })
})

test('shows success message after submitting valid email', async () => {
  // The component always shows success (even on API error) to avoid revealing email existence
  renderWithProviders(<ForgotPasswordPage />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
  await waitFor(() => {
    expect(screen.getByText(/you'll receive a password reset link/i)).toBeInTheDocument()
  })
})

test('shows Back to Login link before submit', () => {
  renderWithProviders(<ForgotPasswordPage />)
  expect(screen.getByText(/back to login/i)).toBeInTheDocument()
})

test('shows Back to Login button after successful submit', async () => {
  renderWithProviders(<ForgotPasswordPage />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
  await waitFor(() => {
    expect(screen.getByText(/you'll receive a password reset link/i)).toBeInTheDocument()
  })
  expect(screen.getByText(/back to login/i)).toBeInTheDocument()
})
