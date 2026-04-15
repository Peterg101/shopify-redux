import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ToolBar } from '../toolBar'

describe('ToolBar', () => {
  it('renders cost display', () => {
    renderWithProviders(<ToolBar />)
    // Default totalCost selector should return 0 for initial state
    expect(screen.getByText(/0\.00/)).toBeInTheDocument()
  })

  it('renders file name input', () => {
    renderWithProviders(<ToolBar />)
    expect(screen.getByLabelText('File Name')).toBeInTheDocument()
  })

  it('renders clear button with text', () => {
    renderWithProviders(<ToolBar />)
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('clear button click resets data state', () => {
    const { store } = renderWithProviders(<ToolBar />, {
      preloadedState: {
        dataState: {
          taskId: '',
          modelColour: 'red',
          selectedFile: 'some-file.stl',
          selectedFileType: 'stl',
          printTechnique: 'FDM',
          printMaterial: 'PLA Basic',
          processId: null,
          materialId: null,
          processFamily: null,
          modelVolume: 100,
          multiplierValue: 2,
          maxScale: 10,
          minScale: 0.1,
          fileNameBoxValue: 'my-part.stl',
          modelDimensions: { position: { x: 0, y: 0, z: 0 } },
          fileDisplay: true,
          autoScaleOnLoad: false,
          xFlip: 0,
          yFlip: 0,
          zFlip: 0,
          materialCost: 0.00005,
          qaLevel: 'standard' as const,
          toleranceMm: undefined,
          surfaceFinish: undefined,
        },
      },
    })

    // Verify the preloaded state took effect
    expect(store.getState().dataState.fileNameBoxValue).toBe('my-part.stl')

    fireEvent.click(screen.getByText('Clear'))

    // After clear, the data state should be reset to initial values
    const resetState = store.getState().dataState
    expect(resetState.fileNameBoxValue).toBe('')
    expect(resetState.modelColour).toBe('white')
    expect(resetState.selectedFile).toBe('')
    expect(resetState.modelVolume).toBe(0)
    expect(resetState.multiplierValue).toBe(1)
  })

  it('file name input reflects Redux state', () => {
    renderWithProviders(<ToolBar />, {
      preloadedState: {
        dataState: {
          taskId: '',
          modelColour: 'white',
          selectedFile: '',
          selectedFileType: '',
          printTechnique: 'FDM',
          printMaterial: 'PLA Basic',
          processId: null,
          materialId: null,
          processFamily: null,
          modelVolume: 0,
          multiplierValue: 1,
          maxScale: 10,
          minScale: 0.1,
          fileNameBoxValue: 'my-model.stl',
          modelDimensions: { position: { x: 0, y: 0, z: 0 } },
          fileDisplay: false,
          autoScaleOnLoad: false,
          xFlip: 0,
          yFlip: 0,
          zFlip: 0,
          materialCost: 0.00005,
          qaLevel: 'standard' as const,
          toleranceMm: undefined,
          surfaceFinish: undefined,
        },
      },
    })

    const input = screen.getByLabelText('File Name') as HTMLInputElement
    expect(input.value).toBe('my-model.stl')
  })
})
