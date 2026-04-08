'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, FileText, Plus } from 'lucide-react';
import { chatActions } from '../../store/chatSlice';
import { sendChatMessage, createChatSession } from '../../lib/api';
import ChatMessage from './ChatMessage';
import { cn } from '../../lib/utils';

export default function ChatInterface() {
  const dispatch = useDispatch();
  const { sessionId, messages, isLoading, currentDocumentId, currentDocumentName } = useSelector((state) => state.chat);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!sessionId && currentDocumentId) {
      initializeSession();
    }
  }, [sessionId, currentDocumentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSession = async () => {
    try {
      if (!currentDocumentId) {
        console.warn('No document selected');
        return;
      }
      const { sessionId: newSessionId } = await createChatSession(currentDocumentId);
      dispatch(chatActions.setSessionId(newSessionId));
      dispatch(chatActions.setMessages([]));
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  const handleNewChat = async () => {
    dispatch(chatActions.newChat());
    await initializeSession();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || !sessionId || isLoading) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    dispatch(chatActions.setLoading(true));
    setIsTyping(true);

    // Add user message optimistically
    const tempUserMsg = {
      id: Date.now(),
      sessionId,
      role: 'user',
      message: userMessage,
      sources: null,
      timestamp: new Date().toISOString(),
    };
    dispatch(chatActions.addMessage(tempUserMsg));

    try {
      const response = await sendChatMessage(userMessage, sessionId);
      
      setIsTyping(false);
      
      // Add assistant response
      const assistantMsg = {
        id: Date.now() + 1,
        sessionId,
        role: 'assistant',
        message: response.answer,
        sources: response.sources,
        timestamp: response.timestamp,
      };
      
      dispatch(chatActions.addMessage(assistantMsg));
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      
      // Extract user-friendly error message from response
      const errorData = error.response?.data;
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      if (errorData?.error) {
        errorMessage = errorData.error;
        
        // Add retry suggestion for temporary errors
        if (errorData?.retryable) {
          errorMessage += ' 🔄 This is temporary - please try again.';
        }
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. The server is taking too long to respond. Please try again.';
      }
      
      // Add error message
      const errorMsg = {
        id: Date.now() + 1,
        sessionId,
        role: 'assistant',
        message: errorMessage,
        sources: null,
        timestamp: new Date().toISOString(),
      };
      dispatch(chatActions.addMessage(errorMsg));
    } finally {
      dispatch(chatActions.setLoading(false));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return React.createElement('div', { 
    className: 'flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950' 
  },
    React.createElement(motion.div, {
      initial: { y: -20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      className: 'px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'
    },
      React.createElement('div', { className: 'flex items-center justify-between' },
        React.createElement('div', { className: 'flex items-center gap-3' },
          React.createElement('div', { 
            className: 'p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg' 
          },
            React.createElement(Sparkles, { className: 'w-5 h-5 text-white' })
          ),
          React.createElement('div', null,
            React.createElement('h2', { 
              className: 'text-lg font-semibold text-gray-900 dark:text-white' 
            }, currentDocumentName || 'AI Research Assistant'),
            React.createElement('p', { 
              className: 'text-sm text-gray-500 dark:text-gray-400' 
            }, currentDocumentName ? `Chatting with: ${currentDocumentName}` : 'No document selected')
          )
        ),
        React.createElement(motion.button, {
          onClick: handleNewChat,
          whileHover: { scale: 1.05 },
          whileTap: { scale: 0.95 },
          className: cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-gradient-to-r from-violet-500 to-purple-600',
            'text-white text-sm font-medium',
            'transition-all duration-200',
            'shadow-lg shadow-violet-500/30',
            'hover:shadow-xl hover:shadow-violet-500/40'
          )
        },
          React.createElement(Plus, { className: 'w-4 h-4' }),
          React.createElement('span', null, 'New Chat')
        )
      )
    ),

    React.createElement('div', { className: 'flex-1 overflow-y-auto px-4 py-6 space-y-6' },
      !currentDocumentId ? (
        React.createElement(motion.div, {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          className: 'flex flex-col items-center justify-center h-full text-center px-4'
        },
          React.createElement('div', { 
            className: 'p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mb-4' 
          },
            React.createElement(FileText, { className: 'w-12 h-12 text-white' })
          ),
          React.createElement('h3', { 
            className: 'text-xl font-semibold text-gray-900 dark:text-white mb-2' 
          }, 'No Document Selected'),
          React.createElement('p', { 
            className: 'text-gray-500 dark:text-gray-400 max-w-md' 
          }, 'Upload a PDF and click "Start Chat" to begin. Each chat is linked to one document to ensure accurate answers.')
        )
      ) : messages.length === 0 ? (
        React.createElement(motion.div, {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          className: 'flex flex-col items-center justify-center h-full text-center px-4'
        },
          React.createElement('div', { 
            className: 'p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mb-4' 
          },
            React.createElement(Sparkles, { className: 'w-12 h-12 text-white' })
          ),
          React.createElement('h3', { 
            className: 'text-xl font-semibold text-gray-900 dark:text-white mb-2' 
          }, 'Start Your Research'),
          React.createElement('p', { 
            className: 'text-gray-500 dark:text-gray-400 max-w-md' 
          }, 'Ask me anything about your document. I\'ll provide accurate answers with source citations.')
        )
      ) : (
        React.createElement(AnimatePresence, { mode: 'popLayout' },
          messages.map((msg, index) =>
            React.createElement(ChatMessage, { key: msg.id || index, message: msg })
          )
        )
      ),

      isTyping && React.createElement(motion.div, {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0 },
        className: 'flex items-center gap-2 text-gray-500 dark:text-gray-400'
      },
        React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }),
        React.createElement('span', { className: 'text-sm' }, 'AI is thinking...')
      ),

      React.createElement('div', { ref: messagesEndRef })
    ),

    React.createElement(motion.div, {
      initial: { y: 20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      className: 'px-4 py-4 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'
    },
      React.createElement('form', { onSubmit: handleSubmit, className: 'max-w-4xl mx-auto' },
        React.createElement('div', { className: 'relative flex items-end gap-2' },
          React.createElement('div', { className: 'flex-1 relative' },
            React.createElement('textarea', {
              ref: inputRef,
              value: input,
              onChange: (e) => setInput(e.target.value),
              onKeyDown: handleKeyDown,
              placeholder: currentDocumentId ? 'Ask a question about your document...' : 'Select a document first...',
              rows: 1,
              disabled: isLoading || !currentDocumentId,
              className: cn(
                'w-full px-4 py-3 pr-12 rounded-2xl resize-none',
                'bg-gray-100 dark:bg-gray-800',
                'border-2 border-transparent',
                'focus:border-violet-500 focus:bg-white dark:focus:bg-gray-900',
                'text-gray-900 dark:text-white',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-32 overflow-y-auto'
              ),
              style: { height: 'auto', minHeight: '48px' },
              onInput: (e) => {
                const target = e.target;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }
            })
          ),
          
          React.createElement(motion.button, {
            type: 'submit',
            disabled: !input.trim() || isLoading || !sessionId,
            whileHover: { scale: 1.05 },
            whileTap: { scale: 0.95 },
            className: cn(
              'p-3 rounded-xl',
              'bg-gradient-to-r from-violet-500 to-purple-600',
              'text-white font-medium',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg shadow-violet-500/50',
              'hover:shadow-xl hover:shadow-violet-500/60'
            )
          },
            isLoading ? (
              React.createElement(Loader2, { className: 'w-5 h-5 animate-spin' })
            ) : (
              React.createElement(Send, { className: 'w-5 h-5' })
            )
          )
        ),
        
        React.createElement('p', { 
          className: 'text-xs text-gray-400 dark:text-gray-500 mt-2 text-center' 
        }, 'Press Enter to send, Shift + Enter for new line')
      )
    )
  );
}
