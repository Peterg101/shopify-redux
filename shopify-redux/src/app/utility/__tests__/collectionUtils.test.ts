import { UUID } from 'crypto'
import {
  removeItemByUUID,
  findItemFromUUID,
  deleteFileAndBasketItemFromArray,
  combineBasketItem,
  generateUuid,
} from '../collectionUtils'
import { BasketItem, UploadedFile } from '../interfaces'

// Helper to create a mock UploadedFile (the File object is stubbed)
function makeUploadedFile(id: string): UploadedFile {
  return {
    id: id as UUID,
    file: new File(['content'], 'test.stl', { type: 'application/octet-stream' }),
  }
}

// Helper to create a mock BasketItem
function makeBasketItem(id: string, name: string = 'Test Part'): BasketItem {
  return {
    id: id as BasketItem['id'],
    name,
    material: 'PLA',
    technique: 'FDM',
    sizing: 1.0,
    colour: '#FFFFFF',
    selectedFile: 'test.stl',
    selectedFileType: 'stl',
  }
}

describe('collectionUtils', () => {
  // ── removeItemByUUID ─────────────────────────────────────────────────
  describe('removeItemByUUID', () => {
    it('removes the item matching the UUID', () => {
      const items = [
        { id: 'aaa' as UUID },
        { id: 'bbb' as UUID },
        { id: 'ccc' as UUID },
      ]
      const result = removeItemByUUID('bbb' as UUID, items)
      expect(result).toHaveLength(2)
      expect(result.map((i) => i.id)).toEqual(['aaa', 'ccc'])
    })

    it('leaves all items when UUID does not match', () => {
      const items = [{ id: 'aaa' as UUID }, { id: 'bbb' as UUID }]
      const result = removeItemByUUID('zzz' as UUID, items)
      expect(result).toHaveLength(2)
    })

    it('returns empty array when given empty array', () => {
      const result = removeItemByUUID('aaa' as UUID, [])
      expect(result).toEqual([])
    })

    it('does not mutate the original array', () => {
      const items = [{ id: 'aaa' as UUID }, { id: 'bbb' as UUID }]
      const original = [...items]
      removeItemByUUID('aaa' as UUID, items)
      expect(items).toEqual(original)
    })
  })

  // ── findItemFromUUID ─────────────────────────────────────────────────
  describe('findItemFromUUID', () => {
    it('finds and returns the matching item', () => {
      const items = [
        { id: 'aaa' as UUID, extra: 1 },
        { id: 'bbb' as UUID, extra: 2 },
      ]
      const found = findItemFromUUID('bbb' as UUID, items)
      expect(found).toBeDefined()
      expect(found!.extra).toBe(2)
    })

    it('returns undefined when no match', () => {
      const items = [{ id: 'aaa' as UUID }]
      expect(findItemFromUUID('zzz' as UUID, items)).toBeUndefined()
    })

    it('returns undefined for empty list', () => {
      expect(findItemFromUUID('aaa' as UUID, [])).toBeUndefined()
    })
  })

  // ── deleteFileAndBasketItemFromArray ──────────────────────────────────
  describe('deleteFileAndBasketItemFromArray', () => {
    it('removes matching items from both arrays', () => {
      const targetId = 'target-id' as UUID
      const uploadedFiles = [makeUploadedFile('target-id'), makeUploadedFile('other-id')]
      const basketItems = [makeBasketItem('target-id'), makeBasketItem('other-id')]

      const { newUploadedFiles, newBasketItems } = deleteFileAndBasketItemFromArray(
        targetId,
        uploadedFiles,
        basketItems
      )

      expect(newUploadedFiles).toHaveLength(1)
      expect(newUploadedFiles[0].id).toBe('other-id')
      expect(newBasketItems).toHaveLength(1)
      expect(newBasketItems[0].id).toBe('other-id')
    })

    it('returns unchanged arrays when UUID not found', () => {
      const uploadedFiles = [makeUploadedFile('aaa')]
      const basketItems = [makeBasketItem('aaa')]

      const { newUploadedFiles, newBasketItems } = deleteFileAndBasketItemFromArray(
        'zzz' as UUID,
        uploadedFiles,
        basketItems
      )

      expect(newUploadedFiles).toHaveLength(1)
      expect(newBasketItems).toHaveLength(1)
    })

    it('handles empty arrays', () => {
      const { newUploadedFiles, newBasketItems } = deleteFileAndBasketItemFromArray(
        'aaa' as UUID,
        [],
        []
      )
      expect(newUploadedFiles).toEqual([])
      expect(newBasketItems).toEqual([])
    })
  })

  // ── combineBasketItem ────────────────────────────────────────────────
  describe('combineBasketItem', () => {
    it('combines matching file and basket item into FileAndItem', () => {
      const id = 'match-id' as UUID
      const uploadedFiles = [makeUploadedFile('match-id'), makeUploadedFile('other')]
      const basketItems = [makeBasketItem('match-id', 'Widget'), makeBasketItem('other')]

      const result = combineBasketItem(id, uploadedFiles, basketItems)

      expect(result.uploadedFile.id).toBe('match-id')
      expect(result.basketItem.id).toBe('match-id')
      expect(result.basketItem.name).toBe('Widget')
    })

    it('returns object with undefined fields when UUID not found', () => {
      const result = combineBasketItem('missing' as UUID, [], [])
      expect(result.uploadedFile).toBeUndefined()
      expect(result.basketItem).toBeUndefined()
    })
  })

  // ── generateUuid ─────────────────────────────────────────────────────
  describe('generateUuid', () => {
    it('returns a string matching UUID format', () => {
      const uuid = generateUuid()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      expect(uuid).toMatch(uuidRegex)
    })

    it('returns unique values on successive calls', () => {
      const a = generateUuid()
      const b = generateUuid()
      expect(a).not.toBe(b)
    })

    it('returns a string type', () => {
      expect(typeof generateUuid()).toBe('string')
    })
  })
})
