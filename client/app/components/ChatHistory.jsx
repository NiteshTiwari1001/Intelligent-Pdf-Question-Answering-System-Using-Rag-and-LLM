'use client';

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Trash2, FileText, Clock } from 'lucide-react';
import { getChatSessions, deleteChatSession, getSessionMessages } from '../../lib/api';
import { chatActions } from '../../store/chatSlice';
import { formatDate } from '../../lib/utils';

export default function ChatHistory() {
  const dispatch = useDispatch();
  const { sessions, sessionId: currentSessionId } = useSelector((state) => state.chat);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const sessionsData = await getChatSessions();
      dispatch(chatActions.setSessions(sessionsData));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleSelectSession = async (session) => {
    try {
      dispatch(chatActions.setSessionId(session.sessionId));
      dispatch(chatActions.setCurrentDocument({
        documentId: session.documentId,
        documentName: session.documentName
      }));
      
      // Load messages for this session
      const messages = await getSessionMessages(session.sessionId);
      dispatch(chatActions.setMessages(messages));
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      dispatch(chatActions.removeSession(sessionId));
      if (currentSessionId === sessionId) {
        dispatch(chatActions.newChat());
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Chat History
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        <AnimatePresence>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No chat history yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Start a chat with a document
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <motion.div
                key={session.sessionId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => handleSelectSession(session)}
                className={`
                  group relative px-3 py-2 rounded-lg cursor-pointer
                  transition-all duration-200
                  ${currentSessionId === session.sessionId
                    ? 'bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {session.documentName}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(session.lastActivity)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteSession(e, session.sessionId)}
                    className="
                      opacity-0 group-hover:opacity-100
                      p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30
                      transition-opacity
                    "
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
