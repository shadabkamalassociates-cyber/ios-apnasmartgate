import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '../context/AuthContext';

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.loading = false;
    },
  },
});

export const { setAuthUser, setAuthLoading, clearAuth } = authSlice.actions;
export default authSlice.reducer;

