/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';

export interface JobsState {
  items: any[];
  loading: boolean;
  error: string | null;
  filters: any;
}

const initialState: JobsState = {
  items: [],
  loading: false,
  error: null,
  filters: {},
};

/**
 * Async Thunk لجلب الوظائف (Jobs) من الـ API
 */
export const fetchJobs = createAsyncThunk(
  'jobs/fetchJobs',
  async (params: { search?: string; types?: string; experience?: string; budget?: string; sort?: string; page?: number } | undefined, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/jobs', { params });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || 'Failed to fetch jobs';
      return rejectWithValue(errorMessage);
    }
  }
);

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    setJobs: (state, action: PayloadAction<any[]>) => {
      state.items = action.payload;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setFilters: (state, action: PayloadAction<any>) => {
      state.filters = action.payload;
    },
    resetFilters: (state) => {
      state.filters = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        // حسب الـ API، لو بيرجع array مباشرة أو object جواه array
        state.items = Array.isArray(action.payload) 
          ? action.payload 
          : action.payload.jobs || [];
        state.error = null;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setJobs, setLoading, setError, setFilters, resetFilters } = jobsSlice.actions;
export default jobsSlice.reducer;