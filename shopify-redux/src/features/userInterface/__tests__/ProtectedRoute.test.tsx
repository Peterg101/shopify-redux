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
          isLoggedIn: true,
          userInformation: createMockSessionData(),
          leftDrawerOpen: false,
          drawerWidth: 400,
          selectedComponent: '',
          meshyLoading: false,
          meshyLoadedPercentage: 0,
          meshyPending: false,
          meshyQueueItems: 0,
          totalBasketValue: 0,
          claimedOrder: null as any,
          updateClaimedOrder: null,
          meshyGenerationSettings: {
            ai_model: 'meshy-5',
            art_style: 'realistic',
            negative_prompt: 'low quality, low resolution, low poly, ugly',
            topology: 'triangle' as const,
            target_polycount: 30000,
            symmetry_mode: 'auto' as const,
            enable_pbr: true,
            should_remesh: true,
            should_texture: true,
            texture_prompt: '',
          },
          meshyPreviewTaskId: null,
          meshyRefining: false,
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
          isLoggedIn: false,
          userInformation: null,
          leftDrawerOpen: false,
          drawerWidth: 400,
          selectedComponent: '',
          meshyLoading: false,
          meshyLoadedPercentage: 0,
          meshyPending: false,
          meshyQueueItems: 0,
          totalBasketValue: 0,
          claimedOrder: null as any,
          updateClaimedOrder: null,
          meshyGenerationSettings: {
            ai_model: 'meshy-5',
            art_style: 'realistic',
            negative_prompt: 'low quality, low resolution, low poly, ugly',
            topology: 'triangle' as const,
            target_polycount: 30000,
            symmetry_mode: 'auto' as const,
            enable_pbr: true,
            should_remesh: true,
            should_texture: true,
            texture_prompt: '',
          },
          meshyPreviewTaskId: null,
          meshyRefining: false,
        },
      },
      route: '/protected',
    })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
