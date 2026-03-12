import { PricingConfig } from './interfaces'

export function calculate3DPrintCost(volume: number, materialCost: number, markup: number = 1.2) {
  const baseCost = (volume * materialCost) + markup
  return baseCost * markup
}

export function getPrice(materialName: string, data: PricingConfig): number | null {
  for (const technique of Object.keys(data.materials) as Array<keyof typeof data.materials>) {
    const material = data.materials[technique].find((m) => m.name === materialName)
    if (material) return material.price
  }
  return null
}

const PROCESS_MULTIPLIERS: Record<string, number> = {
  '3d_printing': 1.0,
  'cnc': 8.0,
  'sheet_metal': 5.0,
  'casting': 6.0,
  'injection_molding': 15.0,
}

export function getProcessMultiplier(family: string | null): number {
  if (!family) return 1.0
  return PROCESS_MULTIPLIERS[family] ?? 1.0
}

export function recalculateTotalCost(params: {
  modelVolume: number
  materialCost: number
  multiplierValue: number
  processFamily?: string | null
}): number {
  const { modelVolume, materialCost, multiplierValue, processFamily } = params

  if (![modelVolume, materialCost, multiplierValue].every((v) => v > 0)) return 0

  const volumeFactor = Math.pow(modelVolume, 0.8)
  const baseCost = 10
  const processMultiplier = getProcessMultiplier(processFamily ?? null)

  return Math.max(baseCost, volumeFactor * materialCost * multiplierValue * processMultiplier)
}
