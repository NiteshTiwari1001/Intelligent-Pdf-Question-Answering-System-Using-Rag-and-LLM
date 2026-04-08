import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    sessionId: null,
    currentDocumentId: null,
    currentDocumentName: null,
    sessions: [],
    messages: [],
    isLoading: false,
    selectedSource: null,
  },
  reducers: {
    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },
    setCurrentDocument: (state, action) => {
      state.currentDocumentId = action.payload.documentId;
      state.currentDocumentName = action.payload.documentName;
    },
    setSessions: (state, action) => {
      state.sessions = action.payload;
    },
    addSession: (state, action) => {
      state.sessions.unshift(action.payload);
    },
    removeSession: (state, action) => {
      state.sessions = state.sessions.filter(s => s.sessionId !== action.payload);
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setSelectedSource: (state, action) => {
      state.selectedSource = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
    },
    newChat: (state) => {
      state.messages = [];
      state.sessionId = null;
      state.currentDocumentId = null;
      state.currentDocumentName = null;
    },
  },
});

export const chatReducer = chatSlice.reducer;
export const chatActions = chatSlice.actions;
