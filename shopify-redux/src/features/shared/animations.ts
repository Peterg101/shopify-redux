import { Theme } from '@mui/material/styles'

export const colorOscillationStyle = (theme: Theme) => ({
  animation: 'oscillateColorAndJiggle 0.5s linear infinite',
  '@keyframes oscillateColorAndJiggle': {
    '0%': {
      color: theme.palette.primary.main,
      transform: 'rotate(0deg) translateX(0)',
    },
    '25%': {
      color: theme.palette.secondary.main,
      transform: 'rotate(5deg) translateX(5px)',
    },
    '50%': {
      color: theme.palette.primary.main,
      transform: 'rotate(0deg) translateX(0)',
    },
    '75%': {
      color: theme.palette.secondary.main,
      transform: 'rotate(-5deg) translateX(-5px)',
    },
    '100%': {
      color: theme.palette.primary.main,
      transform: 'rotate(0deg) translateX(0)',
    },
  },
})
