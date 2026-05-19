/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';

export interface PostsState {
  items: any[];
  loading: boolean;
  error: string | null;
}

const initialState: PostsState = {
  items: [],
  loading: false,
  error: null,
};

/**
 * Async Thunk للحصول على قائمة البوستات من الـ API
 */
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/posts');
      return response.data; 
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Failed to fetch posts';
      return rejectWithValue(errorMessage);
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<any[]>) => {
      state.items = action.payload;
      state.loading = false;
      state.error = null;
    },
    addPost: (state, action: PayloadAction<any>) => {
      state.items.unshift(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    deletePost: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((post) => post.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchPosts.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.loading = false;
          state.items = Array.isArray(action.payload)
            ? action.payload
            : action.payload.posts || [];
          state.error = null;
        }
      )
      .addCase(
        fetchPosts.rejected,
        (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        }
      );
  },
});

export const { setPosts, addPost, setLoading, setError, deletePost } =
  postsSlice.actions;
export default postsSlice.reducer;