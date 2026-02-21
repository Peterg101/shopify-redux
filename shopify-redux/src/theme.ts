import { createTheme } from "@mui/material/styles"

// FITD Dark/Technical Theme
const cyan = "#00E5FF"
const cyanDark = "#00B8D4"
const neonGreen = "#76FF03"
const amber = "#FF9100"
const bgDefault = "#0A0E14"
const bgPaper = "#131920"
const textPrimary = "#E4E8EE"
const textSecondary = "#8899AA"
const borderSubtle = "rgba(0, 229, 255, 0.12)"

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: cyan,
      dark: cyanDark,
      contrastText: "#0A0E14",
    },
    secondary: {
      main: neonGreen,
      contrastText: "#0A0E14",
    },
    warning: {
      main: amber,
    },
    background: {
      default: bgDefault,
      paper: bgPaper,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
    },
    error: {
      main: "#FF5252",
    },
    divider: "rgba(136, 153, 170, 0.15)",
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', Arial, sans-serif",
    h1: {
      fontSize: "2rem",
      fontWeight: 700,
      color: textPrimary,
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 700,
      color: textPrimary,
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 700,
      color: textPrimary,
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 700,
      color: textPrimary,
    },
    body1: {
      fontSize: "1rem",
      color: textPrimary,
    },
    body2: {
      fontSize: "0.875rem",
      color: textSecondary,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: bgDefault,
          color: textPrimary,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-input": {
            color: textPrimary,
          },
          "& .MuiFormLabel-root": {
            color: textSecondary,
          },
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              borderColor: borderSubtle,
              borderRadius: "8px",
            },
            "&:hover fieldset": {
              borderColor: cyan,
            },
            "&.Mui-focused fieldset": {
              borderColor: cyan,
              boxShadow: `0 0 8px ${cyan}40`,
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          transition: "all 0.2s ease-in-out",
          "&.MuiButton-containedPrimary": {
            color: bgDefault,
            backgroundColor: cyan,
            "&:hover": {
              backgroundColor: cyanDark,
              boxShadow: `0 0 16px ${cyan}60`,
            },
          },
          "&.MuiButton-containedSecondary": {
            color: bgDefault,
            backgroundColor: neonGreen,
            "&:hover": {
              backgroundColor: "#64DD17",
              boxShadow: `0 0 16px ${neonGreen}60`,
            },
          },
          "&.MuiButton-outlined": {
            borderColor: borderSubtle,
            color: textPrimary,
            "&:hover": {
              borderColor: cyan,
              boxShadow: `0 0 8px ${cyan}30`,
            },
          },
          "&.Mui-disabled": {
            color: "#445566",
            backgroundColor: "#1a2230",
            borderColor: "#1a2230",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: textSecondary,
          "&.Mui-checked": {
            color: cyan,
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: textSecondary,
          "&.Mui-checked": {
            color: cyan,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          backgroundColor: bgPaper,
          backgroundImage: "none",
          boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.4)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          backgroundColor: bgPaper,
          backgroundImage: "none",
          border: `1px solid ${borderSubtle}`,
          boxShadow: `0 0 12px rgba(0, 229, 255, 0.05)`,
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            borderColor: "rgba(0, 229, 255, 0.25)",
            boxShadow: `0 0 20px rgba(0, 229, 255, 0.1)`,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "12px",
          backgroundColor: bgPaper,
          backgroundImage: "none",
          border: `1px solid ${borderSubtle}`,
          boxShadow: `0 0 24px rgba(0, 229, 255, 0.1)`,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: "transparent",
      },
      styleOverrides: {
        root: {
          boxShadow: `0 1px 0 ${borderSubtle}`,
          borderRadius: "0px",
          backgroundColor: bgPaper,
          backgroundImage: "none",
          color: textPrimary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: bgPaper,
          backgroundImage: "none",
          borderColor: borderSubtle,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: textSecondary,
          "&.Mui-focused": {
            color: cyan,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: borderSubtle,
        },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: cyan,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: cyan,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: textSecondary,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: cyan,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: textSecondary,
          "&.Mui-selected": {
            color: cyan,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: cyan,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: "rgba(0, 229, 255, 0.08)",
            "&:hover": {
              backgroundColor: "rgba(0, 229, 255, 0.12)",
            },
          },
          "&:hover": {
            backgroundColor: "rgba(0, 229, 255, 0.04)",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1a2230",
          color: textPrimary,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(136, 153, 170, 0.1)",
        },
      },
    },
  },
})

// Monospace font for technical data (dimensions, costs, IDs)
export const monoFontFamily = "'Roboto Mono', 'Consolas', 'Courier New', monospace"
