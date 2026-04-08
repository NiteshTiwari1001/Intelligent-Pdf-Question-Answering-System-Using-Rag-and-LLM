import { createSlice } from '@reduxjs/toolkit';

const documentsSlice = createSlice({
  name: 'documents',
  initialState: {
    list: [],
    isUploading: false,
    uploadError: null,
  },
  reducers: {
    setDocuments: (state, action) => {
      state.list = action.payload;
    },
    addDocument: (state, action) => {
      state.list.unshift(action.payload);
    },
    removeDocument: (state, action) => {
      state.list = state.list.filter(doc => doc._id !== action.payload);
    },
    setUploading: (state, action) => {
      state.isUploading = action.payload;
    },
    setUploadError: (state, action) => {
      state.uploadError = action.payload;
    },
  },
});

export const documentsReducer = documentsSlice.reducer;
export const documentsActions = documentsSlice.actions;
