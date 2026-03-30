import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_URL } from '../services/config';
import { setTokens, clearTokens, getRefreshToken } from '../services/auth';

interface AuthState {
  isAuthenticated: boolean;
  user: {
    user_id: string;
    username: string;
    email: string;
  } | null;
  stripeOnboarded: boolean;
  hasFulfillerProfile: boolean;
  emailVerified: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  stripeOnboarded: false,
  hasFulfillerProfile: false,
  emailVerified: false,
  isLoading: false,
};

export const loginWithEmail = createAsyncThunk(
  'auth/loginWithEmail',
  async ({ email, password }: { email: string; password: string }) => {
    const res = await fetch(`${API_URL}/auth/mobile/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Login failed');
    }
    const data = await res.json();
    await setTokens(data.token, data.refresh_token);
    return data;
  }
);

export const registerWithEmail = createAsyncThunk(
  'auth/registerWithEmail',
  async ({ username, email, password }: { username: string; email: string; password: string }) => {
    const res = await fetch(`${API_URL}/auth/mobile/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Registration failed');
    }
    const data = await res.json();
    await setTokens(data.token, data.refresh_token);
    return data;
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await clearTokens();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      state.user = action.payload.user;
      state.stripeOnboarded = action.payload.stripe_onboarded;
      state.hasFulfillerProfile = action.payload.has_fulfiller_profile;
      state.emailVerified = action.payload.email_verified;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithEmail.pending, (state) => { state.isLoading = true; })
      .addCase(loginWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.stripeOnboarded = action.payload.stripe_onboarded ?? false;
        state.hasFulfillerProfile = action.payload.has_fulfiller_profile ?? false;
        state.emailVerified = action.payload.email_verified ?? false;
      })
      .addCase(loginWithEmail.rejected, (state) => { state.isLoading = false; })
      .addCase(registerWithEmail.pending, (state) => { state.isLoading = true; })
      .addCase(registerWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.emailVerified = false;
      })
      .addCase(registerWithEmail.rejected, (state) => { state.isLoading = false; })
      .addCase(logout.fulfilled, () => initialState);
  },
});

export const { setSession } = authSlice.actions;
export default authSlice.reducer;
