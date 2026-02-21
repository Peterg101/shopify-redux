import { createWebsocketConnection } from '../meshyWebsocket'

// Mock the dispatch function
const mockDispatch = jest.fn()
const mockSetActualFile = jest.fn()

// Mock fetchFileUtils - use lazy evaluation to avoid out-of-scope variable issues
const mockFetchFile = jest.fn()
const mockExtractFileInfo = jest.fn()
jest.mock('../fetchFileUtils', () => ({
  fetchFile: (...args: any[]) => mockFetchFile(...args),
  extractFileInfo: (...args: any[]) => mockExtractFileInfo(...args),
}))

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readyState = 1
  close = jest.fn()

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  simulateClose(wasClean = true) {
    this.onclose?.({ wasClean } as CloseEvent)
  }
}

let mockWs: MockWebSocket

beforeEach(() => {
  jest.clearAllMocks()
  mockWs = new MockWebSocket()
  ;(global as any).WebSocket = jest.fn(() => mockWs)
  mockFetchFile.mockResolvedValue({ file_data: 'base64data' })
  mockExtractFileInfo.mockReturnValue({
    file: new File([''], 'test.obj'),
    fileUrl: 'blob:http://test',
  })
})

afterEach(() => {
  delete (global as any).WebSocket
})

describe('createWebsocketConnection', () => {
  it('creates a WebSocket connection with the correct URL', () => {
    process.env.REACT_APP_MESHY_WEBSOCKET = 'ws://localhost:8000'
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8000/ws/port-123')
  })

  it('dispatches percentage updates for valid messages', () => {
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)
    mockWs.simulateMessage('50,task-1,model.obj')

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('setMeshyLoadedPercentage'),
      })
    )
  })

  it('ignores malformed messages with wrong part count', () => {
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)

    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
    mockWs.simulateMessage('invalid-message')
    expect(consoleWarn).toHaveBeenCalledWith(
      'Unexpected WebSocket message format:',
      'invalid-message'
    )
    consoleWarn.mockRestore()
  })

  it('ignores messages with non-numeric percentage', () => {
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)

    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
    mockWs.simulateMessage('abc,task-1,file.obj')
    expect(consoleWarn).toHaveBeenCalledWith(
      'Invalid WebSocket message data:',
      'abc,task-1,file.obj'
    )
    consoleWarn.mockRestore()
  })

  it('ignores empty data messages', () => {
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)
    const dispatchCountBefore = mockDispatch.mock.calls.length
    mockWs.simulateMessage('')
    expect(mockDispatch.mock.calls.length).toBe(dispatchCountBefore)
  })

  it('closes WebSocket on 100% completion', async () => {
    createWebsocketConnection('port-123', mockDispatch, mockSetActualFile)
    mockWs.simulateMessage('100,task-1,model.obj')

    // Allow async operations to complete
    await new Promise((r) => setTimeout(r, 50))

    expect(mockWs.close).toHaveBeenCalled()
  })
})
