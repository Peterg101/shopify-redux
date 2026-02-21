import { PricingConfig } from './interfaces'

export function calculate3DPrintCost(volume: number, materialCost: number, markup: number = 1.2) {
  const baseCost = (volume * materialCost) + markup
  return baseCost * markup
}

export function getPrice(materialName: string, data: PricingConfig): number | null {
  for (const technique in data.materials) {
    const material = data.materials[technique].find((m) => m.name === materialName)
    if (material) return material.price
  }
  return null
}

export function recalculateTotalCost(params: {
  modelVolume: number
  materialCost: number
  multiplierValue: number
}): number {
  const { modelVolume, materialCost, multiplierValue } = params

  if (![modelVolume, materialCost, multiplierValue].every((v) => v > 0)) return 0

  const volumeFactor = Math.pow(modelVolume, 0.8)
  const baseCost = 10

  return Math.max(baseCost, volumeFactor * materialCost * multiplierValue)
}
