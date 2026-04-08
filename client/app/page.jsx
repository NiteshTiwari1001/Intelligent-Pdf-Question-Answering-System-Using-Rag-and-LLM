import React from 'react';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';
import SourceModal from './components/SourceModal';
import ChatHistory from './components/ChatHistory';

export default function Home() {
  return (
    <div className="flex min-h-screen w-screen bg-gray-50 dark:bg-gray-950">
      {/* Left Panel - Document Upload */}
      <div className="h-screen w-full md:w-[30%] border-r-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <FileUpload />
      </div>

      {/* Middle Panel - Chat Interface */}
      <div className="hidden md:block h-screen w-full md:w-[45%] border-r-2 border-gray-200 dark:border-gray-800">
        <ChatInterface />
      </div>

      {/* Right Panel - Chat History Sidebar */}
      <div className="hidden lg:block h-screen w-full lg:w-[25%] bg-white dark:bg-gray-900">
        <ChatHistory />
      </div>

      {/* Source Modal - shows when clicking on a reference */}
      <SourceModal />
    </div>
  );
}
