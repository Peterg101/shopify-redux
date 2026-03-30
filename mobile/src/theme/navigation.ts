import { DarkTheme, type Theme } from '@react-navigation/native';
import { colors } from './colors';

export const fitdNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.cyan,
    background: colors.bgBase,
    card: colors.bgSurface,
    text: colors.textPrimary,
    border: colors.cyanSubtle,
    notification: colors.error,
  },
};
