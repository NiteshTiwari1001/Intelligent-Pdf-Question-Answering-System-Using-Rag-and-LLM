import { configureStore } from '@reduxjs/toolkit';
import { documentsReducer } from './documentsSlice';
import { chatReducer } from './chatSlice';

const store = configureStore({
  reducer: {
    documents: documentsReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
