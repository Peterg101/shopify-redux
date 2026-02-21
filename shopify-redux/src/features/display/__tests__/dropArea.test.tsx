import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { DropArea } from '../dropArea'

describe('DropArea', () => {
  it('renders upload prompt text', () => {
    renderWithProviders(<DropArea />)
    expect(screen.getByText(/drag/i)).toBeInTheDocument()
    expect(screen.getByText(/3D model file/i)).toBeInTheDocument()
  })

  it('renders cloud upload icon', () => {
    renderWithProviders(<DropArea />)
    expect(screen.getByTestId('CloudUploadIcon')).toBeInTheDocument()
  })

  it('renders a file input', () => {
    const { container } = renderWithProviders(<DropArea />)
    const input = container.querySelector('input[type="file"]') || container.querySelector('input')
    expect(input).toBeInTheDocument()
  })
})
