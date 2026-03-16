import {
  createFileBlob,
  extractFileType,
  createBase64Blob,
  downloadBlob,
} from '../fileUtils'

// jsdom does not implement URL.createObjectURL / revokeObjectURL.
// Define stubs on the global so jest.spyOn works in the tests below.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = jest.fn()
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = jest.fn()
}

describe('fileUtils', () => {
  // ── extractFileType ──────────────────────────────────────────────────
  describe('extractFileType', () => {
    it('extracts stl extension', () => {
      const file = new File(['data'], 'model.stl', { type: 'application/octet-stream' })
      expect(extractFileType(file)).toBe('stl')
    })

    it('extracts and lowercases OBJ extension', () => {
      const file = new File(['data'], 'model.OBJ', { type: 'application/octet-stream' })
      expect(extractFileType(file)).toBe('obj')
    })

    it('extracts step extension', () => {
      const file = new File(['data'], 'part.STEP', { type: 'application/octet-stream' })
      expect(extractFileType(file)).toBe('step')
    })

    it('returns empty string when there is no dot', () => {
      const file = new File(['data'], 'noextension', { type: 'application/octet-stream' })
      expect(extractFileType(file)).toBe('')
    })

    it('handles multiple dots in filename (takes last segment)', () => {
      const file = new File(['data'], 'my.model.v2.glb', { type: 'model/gltf-binary' })
      expect(extractFileType(file)).toBe('glb')
    })

    it('handles dot at end of filename', () => {
      const file = new File(['data'], 'file.', { type: 'application/octet-stream' })
      expect(extractFileType(file)).toBe('')
    })
  })

  // ── createBase64Blob ─────────────────────────────────────────────────
  describe('createBase64Blob', () => {
    it('returns a Blob with the correct MIME type', () => {
      // btoa('hello') = 'aGVsbG8='
      const blob = createBase64Blob('aGVsbG8=', 'text/plain')
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/plain')
    })

    it('returns a Blob with correct size', () => {
      // 'hello' = 5 bytes
      const blob = createBase64Blob('aGVsbG8=', 'application/octet-stream')
      expect(blob.size).toBe(5)
    })

    it('handles empty base64 string', () => {
      const blob = createBase64Blob('', 'text/plain')
      expect(blob.size).toBe(0)
      expect(blob.type).toBe('text/plain')
    })

    it('handles binary content MIME type', () => {
      const blob = createBase64Blob('AAAA', 'model/stl')
      expect(blob.type).toBe('model/stl')
    })
  })

  // ── createFileBlob ───────────────────────────────────────────────────
  describe('createFileBlob', () => {
    beforeEach(() => {
      ;(URL.createObjectURL as jest.Mock).mockReturnValue('blob:http://localhost/fake-blob-url')
    })

    afterEach(() => {
      ;(URL.createObjectURL as jest.Mock).mockReset()
    })

    it('calls URL.createObjectURL with the file', () => {
      const file = new File(['data'], 'test.stl')
      createFileBlob(file)
      expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    })

    it('returns the blob URL string', () => {
      const file = new File(['data'], 'test.stl')
      const result = createFileBlob(file)
      expect(result).toBe('blob:http://localhost/fake-blob-url')
    })
  })

  // ── downloadBlob ─────────────────────────────────────────────────────
  describe('downloadBlob', () => {
    let mockCreateElement: jest.SpyInstance
    let mockAppendChild: jest.SpyInstance
    let mockRemoveChild: jest.SpyInstance
    let mockLink: { href: string; download: string; click: jest.Mock }

    beforeEach(() => {
      ;(URL.createObjectURL as jest.Mock).mockReturnValue('blob:http://localhost/download-url')
      ;(URL.revokeObjectURL as jest.Mock).mockImplementation(() => {})

      mockLink = { href: '', download: '', click: jest.fn() }
      mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockLink as unknown as HTMLElement)
      mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
      mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
    })

    afterEach(() => {
      ;(URL.createObjectURL as jest.Mock).mockReset()
      ;(URL.revokeObjectURL as jest.Mock).mockReset()
      mockCreateElement.mockRestore()
      mockAppendChild.mockRestore()
      mockRemoveChild.mockRestore()
    })

    it('creates an object URL from the blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'output.txt')
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    })

    it('creates an anchor element', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'output.txt')
      expect(mockCreateElement).toHaveBeenCalledWith('a')
    })

    it('sets href and download attributes on the link', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'model.stl')
      expect(mockLink.href).toBe('blob:http://localhost/download-url')
      expect(mockLink.download).toBe('model.stl')
    })

    it('appends link to body, clicks it, then removes it', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'output.txt')
      expect(mockAppendChild).toHaveBeenCalled()
      expect(mockLink.click).toHaveBeenCalled()
      expect(mockRemoveChild).toHaveBeenCalled()
    })

    it('revokes the object URL after download', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'output.txt')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/download-url')
    })

    it('calls operations in correct order: create URL, append, click, remove, revoke', () => {
      const callOrder: string[] = []
      ;(URL.createObjectURL as jest.Mock).mockImplementation(() => {
        callOrder.push('createObjectURL')
        return 'blob:http://localhost/download-url'
      })
      mockAppendChild.mockImplementation((node) => {
        callOrder.push('appendChild')
        return node
      })
      mockLink.click.mockImplementation(() => {
        callOrder.push('click')
      })
      mockRemoveChild.mockImplementation((node) => {
        callOrder.push('removeChild')
        return node
      })
      ;(URL.revokeObjectURL as jest.Mock).mockImplementation(() => {
        callOrder.push('revokeObjectURL')
      })

      const blob = new Blob(['test'])
      downloadBlob(blob, 'file.bin')

      expect(callOrder).toEqual([
        'createObjectURL',
        'appendChild',
        'click',
        'removeChild',
        'revokeObjectURL',
      ])
    })
  })
})
