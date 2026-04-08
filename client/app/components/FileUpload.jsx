'use client';

import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { uploadPDF, getDocuments } from '../../lib/api';
import { documentsActions } from '../../store/documentsSlice';
import DocumentList from './DocumentList';

export default function FileUpload() {
  const dispatch = useDispatch();
  const isUploading = useSelector((state) => state.documents.isUploading);
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFile = useCallback(async (file) => {
    if (file.type !== 'application/pdf') {
      setErrorMessage('Please upload a PDF file');
      setUploadStatus('error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File size must be less than 50MB');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    dispatch(documentsActions.setUploading(true));
    setErrorMessage('');

    try {
      const result = await uploadPDF(file);
      setUploadedFile(result.filename);
      setUploadStatus('success');
      
      // Refresh documents list
      const docs = await getDocuments();
      dispatch(documentsActions.setDocuments(docs));
      
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadedFile(null);
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrorMessage('Upload failed. Please try again.');
      setUploadStatus('error');
    } finally {
      dispatch(documentsActions.setUploading(false));
    }
  }, [dispatch]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    };
    input.click();
  };

  return React.createElement('div', { className: 'h-full flex flex-col' },
    React.createElement(motion.div, {
      initial: { y: -20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      className: 'px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'
    },
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('div', { 
          className: 'p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg' 
        },
          React.createElement(FileText, { className: 'w-5 h-5 text-white' })
        ),
        React.createElement('div', null,
          React.createElement('h2', { 
            className: 'text-lg font-semibold text-gray-900 dark:text-white' 
          }, 'Document Library'),
          React.createElement('p', { 
            className: 'text-sm text-gray-500 dark:text-gray-400' 
          }, 'Upload and manage your PDFs')
        )
      )
    ),

    React.createElement('div', { className: 'flex-1 p-6 overflow-y-auto' },
      React.createElement(motion.div, {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { delay: 0.1 },
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onClick: handleClick,
        className: `
          relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer mb-6
          ${isDragging
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 scale-105'
            : 'border-gray-300 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-600'
          }
          ${uploadStatus === 'uploading' ? 'pointer-events-none opacity-60' : ''}
        `
      },
        React.createElement('div', { 
          className: 'flex flex-col items-center justify-center text-center space-y-4' 
        },
          React.createElement(AnimatePresence, { mode: 'wait' },
            uploadStatus === 'idle' && React.createElement(motion.div, {
              key: 'idle',
              initial: { scale: 0 },
              animate: { scale: 1 },
              exit: { scale: 0 },
              className: 'p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl'
            },
              React.createElement(Upload, { className: 'w-12 h-12 text-white' })
            ),

            uploadStatus === 'uploading' && React.createElement(motion.div, {
              key: 'uploading',
              initial: { scale: 0 },
              animate: { scale: 1, rotate: 360 },
              exit: { scale: 0 },
              transition: { rotate: { duration: 2, repeat: Infinity, ease: 'linear' } },
              className: 'p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl'
            },
              React.createElement(Loader2, { className: 'w-12 h-12 text-white' })
            ),

            uploadStatus === 'success' && React.createElement(motion.div, {
              key: 'success',
              initial: { scale: 0 },
              animate: { scale: 1 },
              exit: { scale: 0 },
              className: 'p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl'
            },
              React.createElement(Check, { className: 'w-12 h-12 text-white' })
            ),

            uploadStatus === 'error' && React.createElement(motion.div, {
              key: 'error',
              initial: { scale: 0 },
              animate: { scale: 1 },
              exit: { scale: 0 },
              className: 'p-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl'
            },
              React.createElement(AlertCircle, { className: 'w-12 h-12 text-white' })
            )
          ),

          React.createElement('div', { className: 'space-y-2' },
            uploadStatus === 'idle' && React.createElement(React.Fragment, null,
              React.createElement('h3', { 
                className: 'text-lg font-semibold text-gray-900 dark:text-white' 
              }, 'Upload PDF Document'),
              React.createElement('p', { 
                className: 'text-sm text-gray-500 dark:text-gray-400' 
              }, 'Drag & drop or click to browse'),
              React.createElement('p', { 
                className: 'text-xs text-gray-400 dark:text-gray-500' 
              }, 'Maximum file size: 50MB')
            ),

            uploadStatus === 'uploading' && React.createElement(React.Fragment, null,
              React.createElement('h3', { 
                className: 'text-lg font-semibold text-gray-900 dark:text-white' 
              }, 'Processing Document'),
              React.createElement('p', { 
                className: 'text-sm text-gray-500 dark:text-gray-400' 
              }, 'Please wait while we analyze your PDF...')
            ),

            uploadStatus === 'success' && uploadedFile && React.createElement(React.Fragment, null,
              React.createElement('h3', { 
                className: 'text-lg font-semibold text-green-600 dark:text-green-400' 
              }, 'Upload Successful!'),
              React.createElement('p', { 
                className: 'text-sm text-gray-500 dark:text-gray-400' 
              }, uploadedFile)
            ),

            uploadStatus === 'error' && React.createElement(React.Fragment, null,
              React.createElement('h3', { 
                className: 'text-lg font-semibold text-red-600 dark:text-red-400' 
              }, 'Upload Failed'),
              React.createElement('p', { 
                className: 'text-sm text-gray-500 dark:text-gray-400' 
              }, errorMessage)
            )
          )
        )
      ),

      React.createElement(DocumentList)
    )
  );
}
