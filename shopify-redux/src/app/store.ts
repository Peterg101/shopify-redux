import type { Action, ThunkAction } from "@reduxjs/toolkit";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import {setupListeners} from "@reduxjs/toolkit/query"
import { userInterfaceSlice } from "../services/userInterfaceSlice";
import {dataSlice} from "../services/dataSlice";
import { meshyApi } from "../services/meshyApi";
import { authApi } from "../services/authApi";

const rootReducer = combineSlices({
  [userInterfaceSlice.reducerPath]: userInterfaceSlice.reducer,
  [dataSlice.reducerPath]: dataSlice.reducer,
  [meshyApi.reducerPath]: meshyApi.reducer,
  [authApi.reducerPath]: authApi.reducer
})

export type RootState = ReturnType<typeof rootReducer>

export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => {
      return getDefaultMiddleware().concat(meshyApi.middleware).concat(authApi.middleware)
    },
    preloadedState
  })

  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()
export const rootInitialState = store.getState() as RootState

export type AppStore = typeof store
export type AppDispatch = AppStore["dispatch"]
export type AppThunk<ThunkReturnType = void> = ThunkAction<
ThunkReturnType, 
RootState, 
unknown, 
Action>