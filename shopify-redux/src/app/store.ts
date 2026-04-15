import type { Action, ThunkAction } from "@reduxjs/toolkit";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import {setupListeners} from "@reduxjs/toolkit/query"
import { userInterfaceSlice } from "../services/userInterfaceSlice";
import {dataSlice} from "../services/dataSlice";
import { cadSlice } from "../services/cadSlice";
import { cadChatSlice } from "../services/cadChatSlice";
import { authApi } from "../services/authApi";
import { basketApi } from "../services/basketItemApi";
import { dbApi } from "../services/dbApi";
import { catalogApi } from "../services/catalogApi";

const rootReducer = combineSlices({
  [userInterfaceSlice.reducerPath]: userInterfaceSlice.reducer,
  [dataSlice.reducerPath]: dataSlice.reducer,
  [cadSlice.reducerPath]: cadSlice.reducer,
  [cadChatSlice.reducerPath]: cadChatSlice.reducer,
  [authApi.reducerPath]: authApi.reducer,
  [basketApi.reducerPath]: basketApi.reducer,
  [dbApi.reducerPath]: dbApi.reducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => {
      return getDefaultMiddleware().concat(authApi.middleware).concat(basketApi.middleware).concat(dbApi.middleware).concat(catalogApi.middleware)
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