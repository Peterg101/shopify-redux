import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ProtectedRoute } from '../ProtectedRoute'
import { Routes, Route } from 'react-router-dom'
import { createMockSessionData } from '../../../test-utils/mockData'

const TestRoutes = () => (
  <Routes>
    <Route
      path="/protected"
      element={
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      }
    />
    <Route path="/login" element={<div>Login Page</div>} />
  </Routes>
)

describe('ProtectedRoute', () => {
  it('renders children when isLoggedIn is true', () => {
    renderWithProviders(<TestRoutes />, {
      preloadedState: {
        userInterfaceState: {

          userInformation: createMockSessionData(),
          leftDrawerOpen: false,

          selectedComponent: '',

          claimedOrder: null as any,
          selectedClaim: null,
          fulfillMode: false,
          updateClaimMode: false,
        },
      },
      route: '/protected',
    })
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when isLoggedIn is false', () => {
    renderWithProviders(<TestRoutes />, {
      preloadedState: {
        userInterfaceState: {

          userInformation: null,
          leftDrawerOpen: false,

          selectedComponent: '',

          claimedOrder: null as any,
          selectedClaim: null,
          fulfillMode: false,
          updateClaimMode: false,
        },
      },
      route: '/protected',
    })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
