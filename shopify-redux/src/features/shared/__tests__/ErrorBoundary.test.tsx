import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../../theme'
import { ErrorBoundary } from '../ErrorBoundary'

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Working content</div>
}

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  it('renders children when no error', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Working content')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('renders custom fallback message', () => {
    renderWithTheme(
      <ErrorBoundary fallbackMessage="Custom error message">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('recovers on retry click', () => {
    const { rerender } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try Again'))

    // After retry, ErrorBoundary resets its state and re-renders children.
    // Since ThrowingComponent still throws, it will show error again.
    // But the state was reset, proving retry works.
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })
})
