import React, { PropsWithChildren } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { makeStore, RootState } from '../app/store'
import { FileProvider } from '../services/fileProvider'
import { UploadedFilesProvider } from '../services/uploadedFilesProvider'

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>
  route?: string
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    route = '/',
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  const store = makeStore(preloadedState)

  function Wrapper({ children }: PropsWithChildren<{}>) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[route]}>
            <FileProvider>
              <UploadedFilesProvider>
                {children}
              </UploadedFilesProvider>
            </FileProvider>
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    )
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
