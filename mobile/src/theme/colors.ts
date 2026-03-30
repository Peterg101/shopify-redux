// FITD Dark Cyber-Industrial Theme — matches web app
export const colors = {
  // Backgrounds (layered depth)
  bgBase: '#0A0E14',
  bgSurface: '#131920',
  bgElevated: '#1a2230',
  bgInput: '#0f1419',

  // Cyan accent family
  cyan: '#00E5FF',
  cyanDark: '#00B8D4',
  cyanSubtle: 'rgba(0, 229, 255, 0.12)',
  cyanHover: 'rgba(0, 229, 255, 0.3)',
  cyanGlow: 'rgba(0, 229, 255, 0.08)',
  cyanHighlight: 'rgba(0, 229, 255, 0.04)',

  // Text
  textPrimary: '#E4E8EE',
  textSecondary: '#8899AA',
  textDisabled: '#667788',

  // Semantic
  success: '#69F0AE',
  warning: '#FF9100',
  error: '#FF5252',
  neonGreen: '#76FF03',
} as const;

export const statusColors = {
  pending: '#8899AA',
  in_progress: '#00E5FF',
  printing: '#76FF03',
  qa_check: '#FF9100',
  shipped: '#448AFF',
  delivered: '#B388FF',
  accepted: '#69F0AE',
  disputed: '#FF5252',
  cancelled: '#FF5252',
} as const;
