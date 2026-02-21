import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ToolBar } from '../toolBar'

describe('ToolBar', () => {
  it('renders cost display', () => {
    renderWithProviders(<ToolBar />)
    // Default totalCost selector should return 0 for initial state
    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('renders file name input', () => {
    renderWithProviders(<ToolBar />)
    expect(screen.getByLabelText('File Name')).toBeInTheDocument()
  })

  it('renders pound sign for cost', () => {
    renderWithProviders(<ToolBar />)
    expect(screen.getByText('£')).toBeInTheDocument()
  })
})
