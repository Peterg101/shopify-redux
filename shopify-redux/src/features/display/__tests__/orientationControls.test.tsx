import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { OrientationControls } from '../OrientationControls'

describe('OrientationControls', () => {
  it('renders three rotation sliders', () => {
    renderWithProviders(<OrientationControls />)
    expect(screen.getByLabelText('X axis rotation')).toBeInTheDocument()
    expect(screen.getByLabelText('Y axis rotation')).toBeInTheDocument()
    expect(screen.getByLabelText('Z axis rotation')).toBeInTheDocument()
  })

  it('renders axis labels with initial 0° values', () => {
    renderWithProviders(<OrientationControls />)
    expect(screen.getByText('X: 0°')).toBeInTheDocument()
    expect(screen.getByText('Y: 0°')).toBeInTheDocument()
    expect(screen.getByText('Z: 0°')).toBeInTheDocument()
  })
})
