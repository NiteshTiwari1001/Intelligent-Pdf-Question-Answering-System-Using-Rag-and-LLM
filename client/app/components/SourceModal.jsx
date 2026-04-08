'use client';

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Copy, Check } from 'lucide-react';
import { chatActions } from '../../store/chatSlice';
import { cn } from '../../lib/utils';

export default function SourceModal() {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state) => state.chat.selectedSource);
  const [copied, setCopied] = React.useState(false);

  const handleClose = () => {
    dispatch(chatActions.setSelectedSource(null));
  };

  const handleCopy = () => {
    if (selectedSource) {
      navigator.clipboard.writeText(selectedSource.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return React.createElement(AnimatePresence, null,
    selectedSource && React.createElement(motion.div, {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      onClick: handleClose,
      className: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'
    },
      React.createElement(motion.div, {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.9, opacity: 0 },
        onClick: (e) => e.stopPropagation(),
        className: cn(
          'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl',
          'w-full max-w-2xl max-h-[80vh] overflow-hidden',
          'border-2 border-gray-200 dark:border-gray-700'
        )
      },
        // Header
        React.createElement('div', {
          className: cn(
            'flex items-center justify-between p-6',
            'bg-gradient-to-r from-violet-500 to-purple-600',
            'text-white'
          )
        },
          React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement(FileText, { className: 'w-6 h-6' }),
            React.createElement('div', null,
              React.createElement('h2', { 
                className: 'text-xl font-bold' 
              }, 'Source Reference'),
              React.createElement('p', { 
                className: 'text-sm text-violet-100' 
              }, selectedSource.filename)
            )
          ),
          React.createElement('button', {
            onClick: handleClose,
            className: cn(
              'p-2 rounded-lg hover:bg-white/20',
              'transition-colors duration-200'
            )
          },
            React.createElement(X, { className: 'w-5 h-5' })
          )
        ),

        // Content
        React.createElement('div', { 
          className: 'p-6 overflow-y-auto max-h-[calc(80vh-200px)]' 
        },
          // Metadata
          React.createElement('div', { 
            className: 'flex items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700' 
          },
            React.createElement('div', { 
              className: cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                'bg-violet-100 dark:bg-violet-900/30',
                'text-violet-700 dark:text-violet-300'
              )
            }, `Page ${selectedSource.page}`),
            React.createElement('div', { 
              className: cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                'bg-green-100 dark:bg-green-900/30',
                'text-green-700 dark:text-green-300'
              )
            }, `Relevance: ${(selectedSource.score * 100).toFixed(0)}%`)
          ),

          // Text content
          React.createElement('div', { 
            className: cn(
              'p-4 rounded-lg',
              'bg-gray-50 dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-700'
            )
          },
            React.createElement('p', { 
              className: 'text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap' 
            }, selectedSource.text)
          )
        ),

        // Footer
        React.createElement('div', { 
          className: 'p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50' 
        },
          React.createElement('button', {
            onClick: handleCopy,
            className: cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-violet-600 hover:bg-violet-700',
              'text-white font-medium',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )
          },
            copied 
              ? React.createElement(React.Fragment, null,
                  React.createElement(Check, { className: 'w-4 h-4' }),
                  'Copied!'
                )
              : React.createElement(React.Fragment, null,
                  React.createElement(Copy, { className: 'w-4 h-4' }),
                  'Copy Text'
                )
          )
        )
      )
    )
  );
}
