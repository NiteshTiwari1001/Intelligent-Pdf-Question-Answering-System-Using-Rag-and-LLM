'use client';

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { chatActions } from '../../store/chatSlice';
import { cn } from '../../lib/utils';

export default function SourceCitation({ source, index }) {
  const dispatch = useDispatch();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    dispatch(chatActions.setSelectedSource(source));
  };

  return React.createElement(motion.div, {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: index * 0.1 },
    whileHover: { x: 4 },
    onHoverStart: () => setIsHovered(true),
    onHoverEnd: () => setIsHovered(false),
    onClick: handleClick,
    className: cn(
      'group relative p-3 rounded-lg cursor-pointer',
      'bg-white dark:bg-gray-800',
      'border-2 border-gray-200 dark:border-gray-700',
      'hover:border-violet-300 dark:hover:border-violet-600',
      'transition-all duration-200',
      'shadow-sm hover:shadow-md'
    )
  },
    React.createElement('div', { className: 'flex items-start gap-3' },
      React.createElement('div', { 
        className: cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
          'bg-gradient-to-br from-violet-500 to-purple-600',
          'text-white font-bold text-xs'
        )
      }, index + 1),

      React.createElement('div', { className: 'flex-1 min-w-0' },
        React.createElement('div', { className: 'flex items-center gap-2 mb-1' },
          React.createElement(FileText, { className: 'w-4 h-4 text-gray-400' }),
          React.createElement('p', { 
            className: 'text-sm font-medium text-gray-900 dark:text-white truncate' 
          }, source.filename)
        ),

        React.createElement('p', { 
          className: 'text-xs text-gray-500 dark:text-gray-400 mb-2' 
        }, `Page ${source.page} • Relevance: ${(source.score * 100).toFixed(0)}%`),

        React.createElement('p', { 
          className: 'text-sm text-gray-700 dark:text-gray-300 line-clamp-2' 
        }, source.text)
      ),

      React.createElement(motion.div, {
        initial: { opacity: 0, scale: 0.8 },
        animate: { 
          opacity: isHovered ? 1 : 0, 
          scale: isHovered ? 1 : 0.8 
        },
        className: 'flex-shrink-0'
      },
        React.createElement(ExternalLink, { 
          className: 'w-4 h-4 text-violet-500' 
        })
      )
    ),

    React.createElement(motion.div, {
      initial: { scaleX: 0 },
      animate: { scaleX: isHovered ? 1 : 0 },
      transition: { duration: 0.2 },
      className: cn(
        'absolute bottom-0 left-0 right-0 h-0.5',
        'bg-gradient-to-r from-violet-500 to-purple-600',
        'origin-left'
      )
    })
  );
}
