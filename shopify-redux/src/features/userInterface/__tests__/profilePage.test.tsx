import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ProfilePage } from '../profilePage'
import { createMockSessionData } from '../../../test-utils/mockData'

const defaultUiState = {
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  basketItems: [],
  drawerWidth: 400,
  selectedComponent: '',
  meshyLoading: false,
  meshyLoadedPercentage: 0,
  meshyPending: false,
  meshyQueueItems: 0,
  isLoggedIn: true,
  totalBasketValue: 0,
  claimedOrder: null as any,
  updateClaimedOrder: null as any,
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
}

describe('ProfilePage', () => {
  it('renders username and email', () => {
    const sessionData = createMockSessionData({
      user: { user_id: 'u1', username: 'janesmith', email: 'jane@example.com' },
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('janesmith')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('renders stat cards for basket, orders, and claims', () => {
    const sessionData = createMockSessionData({
      basket_items: [
        { task_id: 't1', user_id: 'u1', name: 'Item', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selected_file: 'f.stl', quantity: 2, selectedFileType: 'stl', price: 10 },
      ],
      orders: [],
      claims: [],
    })

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Basket Items')).toBeInTheDocument()
    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('Active Claims')).toBeInTheDocument()
  })

  it('renders the logout button', () => {
    const sessionData = createMockSessionData()

    renderWithProviders(<ProfilePage />, {
      preloadedState: {
        userInterfaceState: {
          ...defaultUiState,
          userInformation: sessionData,
        },
      },
    })

    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })
})
