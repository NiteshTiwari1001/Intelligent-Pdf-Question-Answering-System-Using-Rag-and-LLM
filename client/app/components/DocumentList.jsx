'use client';

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, Loader2, Check, X, MessageSquare } from 'lucide-react';
import { getDocuments, deleteDocument, createChatSession } from '../../lib/api';
import { documentsActions } from '../../store/documentsSlice';
import { chatActions } from '../../store/chatSlice';
import { formatFileSize, formatDate } from '../../lib/utils';

export default function DocumentList() {
  const dispatch = useDispatch();
  const documents = useSelector((state) => state.documents.list);
  const [deleting, setDeleting] = React.useState(null);
  const [startingChat, setStartingChat] = React.useState(null);
  const [processingDocs, setProcessingDocs] = React.useState(new Set());

  // Initial load
  useEffect(() => {
    loadDocuments();
  }, []);

  // Track processing documents and poll only for those
  useEffect(() => {
    // Find documents that are currently processing
    const currentProcessing = new Set(
      documents.filter(doc => doc.status === 'processing').map(doc => doc._id)
    );
    
    // If there are processing documents, poll for updates
    if (currentProcessing.size > 0) {
      const pollInterval = setInterval(() => {
        loadDocuments();
      }, 2000);
      
      setProcessingDocs(currentProcessing);
      return () => clearInterval(pollInterval);
    } else {
      setProcessingDocs(new Set());
    }
  }, [documents.map(doc => doc._id + doc.status).join(',')]); // Only re-run when doc IDs or statuses change

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      dispatch(documentsActions.setDocuments(docs));
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDeleting(docId);
    try {
      await deleteDocument(docId);
      dispatch(documentsActions.removeDocument(docId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const handleStartChat = async (doc) => {
    if (doc.status !== 'completed') {
      alert('Please wait for the document to finish processing');
      return;
    }

    setStartingChat(doc._id);
    try {
      const sessionData = await createChatSession(doc._id);
      
      dispatch(chatActions.setSessionId(sessionData.sessionId));
      dispatch(chatActions.setCurrentDocument({
        documentId: doc._id,
        documentName: doc.filename
      }));
      dispatch(chatActions.setMessages([]));
      dispatch(chatActions.addSession({
        sessionId: sessionData.sessionId,
        documentId: doc._id,
        documentName: doc.filename,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setStartingChat(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      processing: {
        icon: React.createElement(Loader2, { className: 'w-3 h-3 animate-spin' }),
        label: 'Processing',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      },
      completed: {
        icon: React.createElement(Check, { className: 'w-3 h-3' }),
        label: 'Ready',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      },
      failed: {
        icon: React.createElement(X, { className: 'w-3 h-3' }),
        label: 'Failed',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      }
    };

    return badges[status] || badges.processing;
  };

  return React.createElement('div', { className: 'mt-6 space-y-2' },
    React.createElement('h3', { className: 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3' },
      'Uploaded Documents'
    ),
    
    documents.length === 0 ? (
      React.createElement('div', { 
        className: 'text-center py-8 text-gray-400 dark:text-gray-500 text-sm' 
      }, 
        'No documents uploaded yet'
      )
    ) : (
      React.createElement(AnimatePresence, { mode: 'popLayout' },
        documents.map((doc) => {
          const statusBadge = getStatusBadge(doc.status);
          
          return React.createElement(motion.div, {
            key: doc._id,
            initial: { opacity: 0, x: -20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: 20 },
            className: 'group p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all'
          },
            React.createElement('div', { className: 'flex items-start justify-between gap-3' },
              React.createElement('div', { className: 'flex items-start gap-3 flex-1 min-w-0' },
                React.createElement('div', { 
                  className: 'p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex-shrink-0' 
                },
                  React.createElement(FileText, { className: 'w-4 h-4 text-violet-600 dark:text-violet-400' })
                ),
                
                React.createElement('div', { className: 'flex-1 min-w-0' },
                  React.createElement('p', { 
                    className: 'text-sm font-medium text-gray-900 dark:text-white truncate',
                    title: doc.filename
                  }, doc.filename),
                  
                  React.createElement('div', { className: 'flex items-center gap-2 mt-1' },
                    React.createElement('span', { className: 'text-xs text-gray-500 dark:text-gray-400' },
                      formatFileSize(doc.fileSize)
                    ),
                    
                    doc.pageCount && React.createElement(React.Fragment, null,
                      React.createElement('span', { className: 'text-xs text-gray-400' }, '•'),
                      React.createElement('span', { className: 'text-xs text-gray-500 dark:text-gray-400' },
                        `${doc.pageCount} pages`
                      )
                    ),
                    
                    doc.chunkCount && React.createElement(React.Fragment, null,
                      React.createElement('span', { className: 'text-xs text-gray-400' }, '•'),
                      React.createElement('span', { className: 'text-xs text-gray-500 dark:text-gray-400' },
                        `${doc.chunkCount} chunks`
                      )
                    ),
                    
                    React.createElement('span', { className: 'text-xs text-gray-400' }, '•'),
                    React.createElement('span', { className: 'text-xs text-gray-500 dark:text-gray-400' },
                      formatDate(doc.uploadDate)
                    ),
                    
                    doc.processingTime && React.createElement(React.Fragment, null,
                      React.createElement('span', { className: 'text-xs text-gray-400' }, '•'),
                      React.createElement('span', { className: 'text-xs text-emerald-600 dark:text-emerald-400 font-medium' },
                        `⚡ ${(doc.processingTime / 1000).toFixed(1)}s`
                      )
                    )
                  ),
                  
                  React.createElement('div', { className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${statusBadge.className}` },
                    statusBadge.icon,
                    React.createElement('span', null, statusBadge.label),
                    doc.status === 'failed' && doc.errorMessage && React.createElement('span', { 
                      className: 'ml-1 text-xs opacity-75',
                      title: doc.errorMessage 
                    }, '(hover for details)')
                  )
                )
              ),
              
              React.createElement('div', { className: 'flex items-center gap-1' },
                doc.status === 'completed' && React.createElement(motion.button, {
                  onClick: () => handleStartChat(doc),
                  disabled: startingChat === doc._id,
                  whileHover: { scale: 1.05 },
                  whileTap: { scale: 0.95 },
                  className: 'px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100'
                },
                  startingChat === doc._id ? (
                    React.createElement(Loader2, { className: 'w-3.5 h-3.5 animate-spin' })
                  ) : (
                    React.createElement(MessageSquare, { className: 'w-3.5 h-3.5' })
                  ),
                  React.createElement('span', null, 'Start Chat')
                ),
                
                React.createElement(motion.button, {
                  onClick: () => handleDelete(doc._id),
                  disabled: deleting === doc._id,
                  whileHover: { scale: 1.1 },
                  whileTap: { scale: 0.9 },
                  className: 'p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100'
                },
                  deleting === doc._id ? (
                    React.createElement(Loader2, { className: 'w-4 h-4 text-red-500 animate-spin' })
                  ) : (
                    React.createElement(Trash2, { className: 'w-4 h-4 text-red-500' })
                  )
                )
              )
            )
          );
        })
      )
    )
  );
}
