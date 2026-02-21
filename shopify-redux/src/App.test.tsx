import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme'
import { makeStore } from './app/store'
import { FileProvider } from './services/fileProvider'
import { UploadedFilesProvider } from './services/uploadedFilesProvider'

// Mock the entire AppRouter and LoginDialog to avoid deep import chains
// that pull in three.js/R3F which have ESM/canvas issues in jsdom
jest.mock('./features/userInterface/AppRouter', () => ({
  __esModule: true,
  default: () => <div data-testid="app-router">Router</div>,
}))
jest.mock('./features/display/loginDialogue', () => ({
  __esModule: true,
  default: () => <div data-testid="login-dialog">Login</div>,
}))

import App from './App'

test('renders without crashing', () => {
  const store = makeStore()
  const { container } = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <FileProvider>
          <UploadedFilesProvider>
            <App />
          </UploadedFilesProvider>
        </FileProvider>
      </ThemeProvider>
    </Provider>
  )
  expect(container).toBeInTheDocument()
  expect(screen.getByTestId('app-router')).toBeInTheDocument()
})
