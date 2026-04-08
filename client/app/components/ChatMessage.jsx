'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bot, Copy, Check } from 'lucide-react';
import SourceViewer from './SourceViewer';
import { cn } from '../../lib/utils';

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return React.createElement(motion.div, {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
    className: cn(
      'flex gap-4 group',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )
  },
    React.createElement('div', { 
      className: cn(
        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-cyan-600' 
          : 'bg-gradient-to-br from-violet-500 to-purple-600'
      )
    },
      isUser 
        ? React.createElement(User, { className: 'w-5 h-5 text-white' })
        : React.createElement(Bot, { className: 'w-5 h-5 text-white' })
    ),

    React.createElement('div', { 
      className: cn(
        'flex-1 space-y-2 max-w-3xl',
        isUser ? 'items-end' : 'items-start'
      )
    },
      React.createElement('div', { 
        className: cn(
          'relative px-5 py-3 rounded-2xl shadow-sm',
          isUser 
            ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white ml-12'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white mr-12'
        )
      },
        React.createElement('p', { 
          className: 'text-sm leading-relaxed whitespace-pre-wrap break-words' 
        }, message.message),

        !isUser && React.createElement(motion.button, {
          onClick: copyToClipboard,
          whileHover: { scale: 1.1 },
          whileTap: { scale: 0.9 },
          className: cn(
            'absolute -right-10 top-2 p-2 rounded-lg',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-gray-100 dark:hover:bg-gray-700'
          )
        },
          copied 
            ? React.createElement(Check, { className: 'w-4 h-4 text-green-500' })
            : React.createElement(Copy, { className: 'w-4 h-4 text-gray-400' })
        )
      ),

      !isUser && message.sources && message.sources.length > 0 && (
        React.createElement(SourceViewer, { sources: message.sources })
      ),

      React.createElement('p', { 
        className: cn(
          'text-xs text-gray-400 dark:text-gray-500 px-1',
          isUser ? 'text-right' : 'text-left'
        )
      }, new Date(message.timestamp).toLocaleTimeString())
    )
  );
}
