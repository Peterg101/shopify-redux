import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import ModelThumbnail from '../ModelThumbnail'

// Mock fetchFileUtils
const mockFetchFile = jest.fn()
const mockExtractFileInfo = jest.fn()
const mockFetchCadFile = jest.fn()
jest.mock('../../../services/fetchFileUtils', () => ({
  fetchFile: (...args: any[]) => mockFetchFile(...args),
  extractFileInfo: (...args: any[]) => mockExtractFileInfo(...args),
  fetchCadFile: (...args: any[]) => mockFetchCadFile(...args),
  isCadFileType: (ft: string) => ['glb', 'step', 'gltf'].includes(ft),
}))

// Mock react-three/fiber Canvas to avoid WebGL in tests
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="three-canvas">{children}</div>
  ),
  useThree: () => ({
    camera: { position: { set: jest.fn() }, lookAt: jest.fn() },
    invalidate: jest.fn(),
  }),
}))

// Mock ThumbnailScene
jest.mock('../ThumbnailScene', () => () => <div data-testid="thumbnail-scene" />)

// jsdom doesn't have URL.revokeObjectURL
global.URL.revokeObjectURL = jest.fn()

describe('ModelThumbnail', () => {
  const defaultProps = {
    taskId: 'test-task-123',
    fileType: 'model/stl',
    colour: '#FF0000',
    name: 'test-model.stl',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    mockFetchFile.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProviders(<ModelThumbnail {...defaultProps} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders 3D canvas after successful file load', async () => {
    const fakeFileResponse = { file_data: btoa('fake-stl-data') }
    mockFetchFile.mockResolvedValue(fakeFileResponse)
    mockExtractFileInfo.mockReturnValue({
      file: new File([], 'test.stl'),
      fileBlob: new Blob(),
      fileUrl: 'blob:http://localhost/fake-blob-url',
    })

    renderWithProviders(<ModelThumbnail {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument()
    })

    expect(mockFetchFile).toHaveBeenCalledWith('test-task-123')
    expect(mockExtractFileInfo).toHaveBeenCalledWith(fakeFileResponse, 'test-model.stl')
  })

  it('shows ViewInArIcon fallback on fetch error', async () => {
    mockFetchFile.mockRejectedValue(new Error('Network error'))

    renderWithProviders(<ModelThumbnail {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('ViewInArIcon')).toBeInTheDocument()
    })
  })
})
