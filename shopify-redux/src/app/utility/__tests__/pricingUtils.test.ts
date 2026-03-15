import { PricingConfig } from '../interfaces'
import {
  calculate3DPrintCost,
  getPrice,
  getProcessMultiplier,
  recalculateTotalCost,
} from '../pricingUtils'

describe('pricingUtils', () => {
  // ── calculate3DPrintCost ─────────────────────────────────────────────
  describe('calculate3DPrintCost', () => {
    it('returns correct cost with default markup (1.2)', () => {
      // baseCost = (10 * 0.05) + 1.2 = 1.7
      // result  = 1.7 * 1.2 = 2.04
      expect(calculate3DPrintCost(10, 0.05)).toBeCloseTo(2.04)
    })

    it('returns correct cost with custom markup', () => {
      // baseCost = (10 * 0.05) + 2 = 2.5
      // result  = 2.5 * 2 = 5.0
      expect(calculate3DPrintCost(10, 0.05, 2)).toBeCloseTo(5.0)
    })

    it('returns markup squared when volume is zero', () => {
      // baseCost = (0 * 5) + 1.2 = 1.2
      // result  = 1.2 * 1.2 = 1.44
      expect(calculate3DPrintCost(0, 5)).toBeCloseTo(1.44)
    })

    it('handles zero materialCost', () => {
      // baseCost = (100 * 0) + 1.2 = 1.2
      // result  = 1.2 * 1.2 = 1.44
      expect(calculate3DPrintCost(100, 0)).toBeCloseTo(1.44)
    })

    it('handles large volume and material cost', () => {
      // baseCost = (1000 * 10) + 1.2 = 10001.2
      // result  = 10001.2 * 1.2 = 12001.44
      expect(calculate3DPrintCost(1000, 10)).toBeCloseTo(12001.44)
    })

    it('handles zero markup', () => {
      // baseCost = (10 * 5) + 0 = 50
      // result  = 50 * 0 = 0
      expect(calculate3DPrintCost(10, 5, 0)).toBe(0)
    })
  })

  // ── getPrice ─────────────────────────────────────────────────────────
  describe('getPrice', () => {
    const mockPricingConfig: PricingConfig = {
      techniques: ['FDM', 'Resin'],
      materials: {
        FDM: [
          { name: 'PLA', price: 0.04 },
          { name: 'ABS', price: 0.05 },
        ],
        Resin: [
          { name: 'Standard Resin', price: 0.12 },
          { name: 'Tough Resin', price: 0.18 },
        ],
      },
    }

    it('finds a material in FDM and returns its price', () => {
      expect(getPrice('PLA', mockPricingConfig)).toBe(0.04)
    })

    it('finds a material in Resin and returns its price', () => {
      expect(getPrice('Standard Resin', mockPricingConfig)).toBe(0.12)
    })

    it('finds ABS in FDM', () => {
      expect(getPrice('ABS', mockPricingConfig)).toBe(0.05)
    })

    it('returns null when material is not found', () => {
      expect(getPrice('Nylon', mockPricingConfig)).toBeNull()
    })

    it('returns null for empty string material name', () => {
      expect(getPrice('', mockPricingConfig)).toBeNull()
    })

    it('is case-sensitive', () => {
      expect(getPrice('pla', mockPricingConfig)).toBeNull()
    })

    it('handles config with empty material arrays', () => {
      const emptyConfig: PricingConfig = {
        techniques: ['FDM', 'Resin'],
        materials: { FDM: [], Resin: [] },
      }
      expect(getPrice('PLA', emptyConfig)).toBeNull()
    })
  })

  // ── getProcessMultiplier ─────────────────────────────────────────────
  describe('getProcessMultiplier', () => {
    it('returns 1.0 for null', () => {
      expect(getProcessMultiplier(null)).toBe(1.0)
    })

    it('returns 1.0 for 3d_printing', () => {
      expect(getProcessMultiplier('3d_printing')).toBe(1.0)
    })

    it('returns 8.0 for cnc', () => {
      expect(getProcessMultiplier('cnc')).toBe(8.0)
    })

    it('returns 5.0 for sheet_metal', () => {
      expect(getProcessMultiplier('sheet_metal')).toBe(5.0)
    })

    it('returns 6.0 for casting', () => {
      expect(getProcessMultiplier('casting')).toBe(6.0)
    })

    it('returns 15.0 for injection_molding', () => {
      expect(getProcessMultiplier('injection_molding')).toBe(15.0)
    })

    it('returns 1.0 for unknown process family', () => {
      expect(getProcessMultiplier('laser_cutting')).toBe(1.0)
    })

    it('returns 1.0 for empty string', () => {
      expect(getProcessMultiplier('')).toBe(1.0)
    })
  })

  // ── recalculateTotalCost ─────────────────────────────────────────────
  describe('recalculateTotalCost', () => {
    it('returns 0 when modelVolume is 0', () => {
      expect(
        recalculateTotalCost({
          modelVolume: 0,
          materialCost: 5,
          multiplierValue: 1,
        })
      ).toBe(0)
    })

    it('returns 0 when materialCost is 0', () => {
      expect(
        recalculateTotalCost({
          modelVolume: 100,
          materialCost: 0,
          multiplierValue: 1,
        })
      ).toBe(0)
    })

    it('returns 0 when multiplierValue is 0', () => {
      expect(
        recalculateTotalCost({
          modelVolume: 100,
          materialCost: 5,
          multiplierValue: 0,
        })
      ).toBe(0)
    })

    it('returns 0 when a negative value is provided', () => {
      expect(
        recalculateTotalCost({
          modelVolume: -10,
          materialCost: 5,
          multiplierValue: 1,
        })
      ).toBe(0)
    })

    it('calculates correctly for 3d_printing (multiplier 1.0)', () => {
      const result = recalculateTotalCost({
        modelVolume: 100,
        materialCost: 0.05,
        multiplierValue: 1.2,
        processFamily: '3d_printing',
      })
      // volumeFactor = 100^0.8 = 39.8107...
      // cost = 39.8107 * 0.05 * 1.2 * 1.0 = 2.3886...
      // Math.max(10, 2.3886) = 10
      expect(result).toBe(10)
    })

    it('calculates correctly for cnc (multiplier 8.0)', () => {
      const result = recalculateTotalCost({
        modelVolume: 100,
        materialCost: 0.05,
        multiplierValue: 1.2,
        processFamily: 'cnc',
      })
      // volumeFactor = 100^0.8 = 39.8107...
      // cost = 39.8107 * 0.05 * 1.2 * 8.0 = 19.1091...
      // Math.max(10, 19.1091) = 19.1091
      const volumeFactor = Math.pow(100, 0.8)
      const expected = volumeFactor * 0.05 * 1.2 * 8.0
      expect(result).toBeCloseTo(expected)
    })

    it('enforces a base cost floor of 10', () => {
      // Use tiny values so the calculation is below 10
      const result = recalculateTotalCost({
        modelVolume: 1,
        materialCost: 0.01,
        multiplierValue: 1,
        processFamily: '3d_printing',
      })
      // volumeFactor = 1^0.8 = 1
      // cost = 1 * 0.01 * 1 * 1 = 0.01
      // Math.max(10, 0.01) = 10
      expect(result).toBe(10)
    })

    it('defaults processFamily to 1.0 multiplier when null', () => {
      const result = recalculateTotalCost({
        modelVolume: 1000,
        materialCost: 1,
        multiplierValue: 1,
        processFamily: null,
      })
      const volumeFactor = Math.pow(1000, 0.8)
      const expected = Math.max(10, volumeFactor * 1 * 1 * 1.0)
      expect(result).toBeCloseTo(expected)
    })

    it('defaults processFamily to 1.0 multiplier when omitted', () => {
      const result = recalculateTotalCost({
        modelVolume: 1000,
        materialCost: 1,
        multiplierValue: 1,
      })
      const volumeFactor = Math.pow(1000, 0.8)
      const expected = Math.max(10, volumeFactor * 1 * 1 * 1.0)
      expect(result).toBeCloseTo(expected)
    })

    it('calculates correctly for injection_molding (multiplier 15.0)', () => {
      const result = recalculateTotalCost({
        modelVolume: 50,
        materialCost: 2,
        multiplierValue: 1.5,
        processFamily: 'injection_molding',
      })
      const volumeFactor = Math.pow(50, 0.8)
      const expected = volumeFactor * 2 * 1.5 * 15.0
      expect(result).toBeCloseTo(expected)
    })
  })
})
