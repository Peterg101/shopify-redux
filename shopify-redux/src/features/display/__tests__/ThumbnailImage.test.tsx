import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ThumbnailImage } from '../ThumbnailImage'

test('renders img with correct src containing taskId', () => {
  renderWithProviders(<ThumbnailImage taskId="task-123" />)
  const img = screen.getByRole('img', { name: '3D model' })
  expect(img).toBeInTheDocument()
  expect(img.getAttribute('src')).toContain('/thumbnail/task-123')
})

test('shows fallback icon on image error', () => {
  renderWithProviders(<ThumbnailImage taskId="task-123" />)
  const img = screen.getByRole('img', { name: '3D model' })
  fireEvent.error(img)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByTestId('ViewInArIcon')).toBeInTheDocument()
})

test('passes custom alt text', () => {
  renderWithProviders(<ThumbnailImage taskId="task-456" alt="Custom bracket" />)
  const img = screen.getByRole('img', { name: 'Custom bracket' })
  expect(img).toBeInTheDocument()
})
