import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import authReducer from './authSlice';
import cadReducer from './cadSlice';
import cadChatReducer from './cadChatSlice';

const persistConfig = {
  key: 'fitd-mobile',
  storage: AsyncStorage,
  whitelist: ['auth'], // Only persist auth — NOT api cache or cad state
};

const rootReducer = combineReducers({
  auth: authReducer,
  cadState: cadReducer,
  cadChatState: cadChatReducer,
  [api.reducerPath]: api.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
