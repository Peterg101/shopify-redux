import {
  recalculateTotalCost,
  calculateTotalBasketValue,
  visibleOrders,
  validateData,
  getPrice,
  extractFileType,
  degreesToRadians,
  getMidPoint,
  calculateMaxScaling,
  calculateMinScaling,
  getLongestAxis,
  getShortestAxis,
} from '../utils'
import { BasketInformation, Order, UserInformation, PricingConfig } from '../interfaces'
import * as THREE from 'three'
import pricingConfig from '../../../config/pricingConfig.json'

const config: PricingConfig = pricingConfig

describe('recalculateTotalCost', () => {
  it('returns 0 when any input is 0', () => {
    expect(recalculateTotalCost({ modelVolume: 0, materialCost: 0.05, multiplierValue: 1 })).toBe(0)
    expect(recalculateTotalCost({ modelVolume: 100, materialCost: 0, multiplierValue: 1 })).toBe(0)
    expect(recalculateTotalCost({ modelVolume: 100, materialCost: 0.05, multiplierValue: 0 })).toBe(0)
  })

  it('returns at least the base cost floor for small prints', () => {
    const result = recalculateTotalCost({ modelVolume: 1, materialCost: 0.00005, multiplierValue: 1 })
    expect(result).toBeGreaterThanOrEqual(10)
  })

  it('calculates cost with sublinear volume scaling', () => {
    const small = recalculateTotalCost({ modelVolume: 100, materialCost: 0.05, multiplierValue: 1 })
    const large = recalculateTotalCost({ modelVolume: 1000, materialCost: 0.05, multiplierValue: 1 })
    // Large should be more, but less than 10x due to sublinear scaling
    expect(large).toBeGreaterThan(small)
    expect(large).toBeLessThan(small * 10)
  })
})

describe('calculateTotalBasketValue', () => {
  it('returns 0 for empty basket', () => {
    expect(calculateTotalBasketValue([])).toBe(0)
  })

  it('sums quantity * price for each item', () => {
    const items: BasketInformation[] = [
      { task_id: '1', user_id: 'u1', name: 'A', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'a.stl', quantity: 2, selectedFileType: 'stl', price: 10 },
      { task_id: '2', user_id: 'u1', name: 'B', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'b.stl', quantity: 3, selectedFileType: 'stl', price: 5 },
    ]
    expect(calculateTotalBasketValue(items)).toBe(35) // (2*10) + (3*5)
  })
})

describe('visibleOrders', () => {
  const user: UserInformation = { user_id: 'user-1', username: 'test', email: 'test@test.com' }

  it('filters out fully claimed orders', () => {
    const orders: Order[] = [
      { order_id: '1', user_id: 'u2', name: 'A', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'a', selectedFileType: 'stl', price: 10, quantity: 2, quantity_claimed: 2, created_at: '', is_collaborative: true, status: 'open', claims: [] },
    ]
    expect(visibleOrders(user, orders)).toHaveLength(0)
  })

  it('filters out orders already claimed by user', () => {
    const orders: Order[] = [
      { order_id: '1', user_id: 'u2', name: 'A', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'a', selectedFileType: 'stl', price: 10, quantity: 2, quantity_claimed: 1, created_at: '', is_collaborative: true, status: 'open', claims: [{ id: 'c1', order_id: '1', claimant_user_id: 'user-1', order: {} as Order, quantity: 1, status: 'pending', created_at: '', updated_at: '' }] },
    ]
    expect(visibleOrders(user, orders)).toHaveLength(0)
  })

  it('returns orders that are claimable', () => {
    const orders: Order[] = [
      { order_id: '1', user_id: 'u2', name: 'A', material: 'PLA', technique: 'FDM', sizing: 1, colour: 'white', selectedFile: 'a', selectedFileType: 'stl', price: 10, quantity: 2, quantity_claimed: 0, created_at: '', is_collaborative: true, status: 'open', claims: [] },
    ]
    expect(visibleOrders(user, orders)).toHaveLength(1)
  })
})

describe('validateData', () => {
  it('returns empty array when all fields valid', () => {
    const data = { name: 'test', age: 25 }
    const schema = { name: (v: any) => typeof v === 'string' && v.length > 0, age: (v: any) => v > 0 }
    expect(validateData(data, schema)).toEqual([])
  })

  it('returns keys of invalid fields', () => {
    const data = { name: '', age: -1 }
    const schema = { name: (v: any) => typeof v === 'string' && v.length > 0, age: (v: any) => v > 0 }
    expect(validateData(data, schema)).toEqual(['name', 'age'])
  })
})

describe('getPrice', () => {
  it('returns price for known material', () => {
    expect(getPrice('PLA Basic', config)).toBe(0.00005)
  })

  it('returns null for unknown material', () => {
    expect(getPrice('Unknown Material', config)).toBeNull()
  })
})

describe('extractFileType', () => {
  it('extracts stl extension', () => {
    const file = new File([], 'model.stl')
    expect(extractFileType(file)).toBe('stl')
  })

  it('extracts obj extension case-insensitive', () => {
    const file = new File([], 'model.OBJ')
    expect(extractFileType(file)).toBe('obj')
  })

  it('returns empty string for no extension', () => {
    const file = new File([], 'noext')
    expect(extractFileType(file)).toBe('')
  })
})

describe('degreesToRadians', () => {
  it('converts 180 degrees to PI', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI)
  })

  it('converts 90 degrees to PI/2', () => {
    expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2)
  })

  it('converts 0 degrees to 0', () => {
    expect(degreesToRadians(0)).toBe(0)
  })
})

describe('getMidPoint', () => {
  it('returns midpoint of two numbers', () => {
    expect(getMidPoint(0, 10)).toBe(5)
  })

  it('handles equal values', () => {
    expect(getMidPoint(5, 5)).toBe(5)
  })
})

describe('scaling functions', () => {
  it('calculateMaxScaling returns correct max scale', () => {
    const dims = new THREE.Vector3(50, 25, 10)
    const result = calculateMaxScaling(dims)
    // 250 / 50 = 5
    expect(result).toBe(5)
  })

  it('calculateMinScaling returns correct min scale', () => {
    const dims = new THREE.Vector3(50, 25, 10)
    const result = calculateMinScaling(dims)
    // 0.5 / 10 = 0.05
    expect(result).toBe(0.05)
  })

  it('getLongestAxis returns max component', () => {
    expect(getLongestAxis(new THREE.Vector3(1, 5, 3))).toBe(5)
  })

  it('getShortestAxis returns min component', () => {
    expect(getShortestAxis(new THREE.Vector3(1, 5, 3))).toBe(1)
  })
})
