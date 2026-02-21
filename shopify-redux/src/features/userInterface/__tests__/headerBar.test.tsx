import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { HeaderBar } from '../headerBar'

describe('HeaderBar', () => {
  it('renders the FITD title', () => {
    renderWithProviders(<HeaderBar />, { route: '/generate' })
    expect(screen.getByText('FITD')).toBeInTheDocument()
  })

  it('renders Generate and Fulfill navigation links', () => {
    renderWithProviders(<HeaderBar />, { route: '/generate' })
    expect(screen.getByText('Generate')).toBeInTheDocument()
    expect(screen.getByText('Fulfill')).toBeInTheDocument()
  })

  it('renders navigation links with correct hrefs', () => {
    renderWithProviders(<HeaderBar />, { route: '/fulfill' })
    const generateLink = screen.getByText('Generate').closest('a')
    const fulfillLink = screen.getByText('Fulfill').closest('a')
    expect(generateLink).toHaveAttribute('href', '/generate')
    expect(fulfillLink).toHaveAttribute('href', '/fulfill')
  })
})
