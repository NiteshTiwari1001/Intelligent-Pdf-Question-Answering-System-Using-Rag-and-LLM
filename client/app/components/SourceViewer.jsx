'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import SourceCitation from './SourceCitation';
import { cn } from '../../lib/utils';

export default function SourceViewer({ sources }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return React.createElement('div', { 
    className: 'mt-3 space-y-2' 
  },
    React.createElement(motion.button, {
      onClick: () => setIsExpanded(!isExpanded),
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
      className: cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-violet-50 dark:bg-violet-950/30',
        'text-violet-700 dark:text-violet-300',
        'hover:bg-violet-100 dark:hover:bg-violet-950/50',
        'transition-colors duration-200',
        'text-sm font-medium w-full justify-between'
      )
    },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement(FileText, { className: 'w-4 h-4' }),
        React.createElement('span', null, `${sources.length} Source${sources.length > 1 ? 's' : ''}`)
      ),
      isExpanded 
        ? React.createElement(ChevronUp, { className: 'w-4 h-4' })
        : React.createElement(ChevronDown, { className: 'w-4 h-4' })
    ),

    React.createElement(AnimatePresence, null,
      isExpanded && React.createElement(motion.div, {
        initial: { height: 0, opacity: 0 },
        animate: { height: 'auto', opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.3 },
        className: 'space-y-2 overflow-hidden'
      },
        sources.map((source, index) =>
          React.createElement(SourceCitation, { 
            key: `${source.filename}-${source.page}-${index}`,
            source: source, 
            index: index 
          })
        )
      )
    )
  );
}
