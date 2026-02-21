import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { SettingsMenu } from '../settingsMenu'

describe('SettingsMenu', () => {
  it('renders three sliders with correct aria-labels', () => {
    renderWithProviders(<SettingsMenu />)
    expect(screen.getByLabelText('X axis rotation')).toBeInTheDocument()
    expect(screen.getByLabelText('Y axis rotation')).toBeInTheDocument()
    expect(screen.getByLabelText('Z axis rotation')).toBeInTheDocument()
  })

  it('displays rotation labels', () => {
    renderWithProviders(<SettingsMenu />)
    expect(screen.getByText(/X Rotation: 0°/)).toBeInTheDocument()
    expect(screen.getByText(/Y Rotation: 0°/)).toBeInTheDocument()
    expect(screen.getByText(/Z Rotation: 0°/)).toBeInTheDocument()
  })
})
