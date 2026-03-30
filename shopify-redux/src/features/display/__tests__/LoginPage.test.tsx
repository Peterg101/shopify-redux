import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { LoginPage } from '../LoginPage'
import { Routes, Route } from 'react-router-dom'

// Wrap LoginPage in Routes since it uses useNavigate
const LoginPageWithRoutes = () => (
  <Routes>
    <Route path="*" element={<LoginPage />} />
  </Routes>
)

describe('LoginPage', () => {
  it('renders FITD branding', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })
    expect(screen.getByText('FITD')).toBeInTheDocument()
    expect(screen.getByText('Distributed Manufacturing Marketplace')).toBeInTheDocument()
  })

  it('shows sign-in tab by default with email and password fields', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    // The "Sign In" button (not the tab)
    const buttons = screen.getAllByRole('button')
    const signInButton = buttons.find(b => b.textContent === 'Sign In')
    expect(signInButton).toBeInTheDocument()
  })

  it('switches to register tab with username and confirm password fields', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })
    fireEvent.click(screen.getByRole('tab', { name: /register/i }))
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    const registerButton = buttons.find(b => b.textContent === 'Register')
    expect(registerButton).toBeInTheDocument()
  })

  it('shows Google and GitHub sign-in buttons', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument()
    expect(screen.getByText(/continue with github/i)).toBeInTheDocument()
  })

  it('Sign In button is enabled when email and password fields are filled', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })
    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    const buttons = screen.getAllByRole('button')
    const signInButton = buttons.find(b => b.textContent === 'Sign In')
    expect(signInButton).toBeInTheDocument()
    expect(signInButton).not.toBeDisabled()
  })

  it('switches back to Sign In tab after visiting Register tab', () => {
    renderWithProviders(<LoginPageWithRoutes />, { route: '/login' })

    // Switch to Register tab
    fireEvent.click(screen.getByRole('tab', { name: /register/i }))
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()

    // Switch back to Sign In tab
    fireEvent.click(screen.getByRole('tab', { name: /sign in/i }))

    // Should show sign-in fields again
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()

    // Register-only fields should not be present
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
  })
})
