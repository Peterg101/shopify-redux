import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ResetPasswordPage } from '../ResetPasswordPage'

test('renders password fields and submit button', () => {
  renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=valid-token' })
  expect(screen.getByLabelText('New Password')).toBeInTheDocument()
  expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
})

test('shows error for mismatched passwords', async () => {
  renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=valid-token' })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Password123!' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Different456!' } })
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
  await waitFor(() => {
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })
})

test('shows error for short password', async () => {
  renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=valid-token' })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'short' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
  await waitFor(() => {
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })
})

test('shows error for missing token', async () => {
  renderWithProviders(<ResetPasswordPage />, { route: '/reset-password' })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'ValidPass123!' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'ValidPass123!' } })
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
  await waitFor(() => {
    expect(screen.getByText(/invalid or missing reset token/i)).toBeInTheDocument()
  })
})

test('shows Back to Login link', () => {
  renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=valid-token' })
  expect(screen.getByText(/back to login/i)).toBeInTheDocument()
})
