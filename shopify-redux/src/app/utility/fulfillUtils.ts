export const getScarcityColor = (remaining: number, total: number): string => {
  const ratio = remaining / total
  if (ratio <= 0.25 || remaining <= 3) return '#FF5252'
  if (ratio <= 0.5) return '#FF9100'
  return '#00E5FF'
}
