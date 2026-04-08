import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Upload PDF
export const uploadPDF = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);
  
  const response = await api.post('/upload/pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

// Get all documents
export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data.documents;
};

// Delete document
export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

// Create or get chat session
export const createChatSession = async (documentId) => {
  const response = await api.post('/chat/session', { documentId });
  return response.data;
};

// Get all chat sessions
export const getChatSessions = async () => {
  const response = await api.get('/chat/sessions');
  return response.data.sessions;
};

// Get messages for a session
export const getSessionMessages = async (sessionId) => {
  const response = await api.get(`/chat/session/${sessionId}/messages`);
  return response.data.messages;
};

// Delete a chat session
export const deleteChatSession = async (sessionId) => {
  const response = await api.delete(`/chat/session/${sessionId}`);
  return response.data;
};

// Send chat message
export const sendChatMessage = async (query, sessionId) => {
  const response = await api.post('/chat', { query, sessionId });
  return response.data;
};

// Update session title
export const updateSessionTitle = async (sessionId, title) => {
  const response = await api.patch(`/chat/session/${sessionId}/title`, { title });
  return response.data;
};

export { api };
