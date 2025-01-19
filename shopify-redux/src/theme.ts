import { createTheme } from "@mui/material/styles"

// Define your custom theme
export const theme = createTheme({
  palette: {
    primary: {
      main: "#DCDCDC", // Primary color: Light grey
      contrastText: "#333", // White text color for primary buttons
    },
    secondary: {
      main: "#CF581D", // Secondary color: Orange
      contrastText: "#fff", // White text color for secondary buttons
    },
    background: {
      default: "#f5f5f5", // Background color: Light grey
      paper: "#fff", // Paper color: White
    },
    text: {
      primary: "#333", // Primary text color: Dark grey
      secondary: "#333", // Secondary text color: Medium grey
    },
    error: {
      main: "#d32f2f", // Error color: Red
    },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif", // Font family
    h1: {
      fontSize: "2rem",
      fontWeight: 700,
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 700,
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 700,
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 700,
    },
    body1: {
      fontSize: "1rem",
      color: "#333",
    },
    button: {
      textTransform: "none", // Prevent text from being uppercased
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-input": {
            color: "#333", // Text color
          },
          "& .MuiFormLabel-root": {
            color: "#333", // Label color
          },
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              borderColor: "#DCDCDC", // Border color
              borderRadius: "8px", // Rounded edges
            },
            "&:hover fieldset": {
              borderColor: "#CF581D", // Border color on hover (orange)
            },
            "&.Mui-focused fieldset": {
              borderColor: "#CF581D", // Border color when focused (orange)
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px", // Rounded edges for buttons
          "&.MuiButton-containedPrimary": {
            color: "#fff", // White text color for primary contained button
            backgroundColor: "#CF581D", // Orange background for primary contained button
            "&:hover": {
              backgroundColor: "#C94E1C", // Darker orange on hover
            },
          },
          "&.MuiButton-containedSecondary": {
            color: "#fff", // White text color for secondary contained button
            backgroundColor: "#CF581D", // Orange background color for secondary contained button
            "&:hover": {
              backgroundColor: "#C94E1C", // Darker orange on hover
            },
          },
          "&.Mui-disabled": {
            color: "#B0B0B0", // Grey text color for disabled state
            backgroundColor: "#D0D0D0", // Grey background for disabled state
            borderColor: "#D0D0D0", // Grey border for disabled state
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#CF581D", // Checkbox color
          "&.Mui-checked": {
            color: "#CF581D", // Checked checkbox color
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: "#CF581D", // Radio button color
          "&.Mui-checked": {
            color: "#CF581D", // Checked radio button color
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: "8px", // Rounded edges
          boxShadow:
            "0px 4px 6px rgba(0, 0, 0, 0.1), 0px 1px 3px rgba(0, 0, 0, 0.08)", // Raised shadow
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "8px", // Rounded edges
          boxShadow:
            "0px 4px 6px rgba(0, 0, 0, 0.1), 0px 1px 3px rgba(0, 0, 0, 0.08)", // Raised shadow
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "8px", // Rounded edges
          boxShadow:
            "0px 4px 6px rgba(0, 0, 0, 0.1), 0px 1px 3px rgba(0, 0, 0, 0.08)", // Raised shadow
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)", // Raised shadow for AppBar
          borderRadius: "0px", // No rounded edges
          backgroundColor: "#DCDCDC", // Background color of the AppBar
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#333", // Default label color
          "&.Mui-focused": {
            color: "#CF581D", // Orange label color when focused
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "#DCDCDC", // Light grey border color
        },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#CF581D", // Orange border color on hover
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#CF581D", // Orange border color when focused
          },
        },
      },
    },
  },
})
