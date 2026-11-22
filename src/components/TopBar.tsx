'use client';

import React from 'react';
import { PlusCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface TopBarProps {
  showApiOption: boolean;
  onOpenApiSettings: () => void;
  onNewQuiz: () => void;
  activeView: 'studio' | 'quiz' | 'results';
  hasActiveQuiz: boolean;
  onGoToActiveQuiz?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  showApiOption,
  onOpenApiSettings,
  onNewQuiz,
  activeView,
  hasActiveQuiz,
  onGoToActiveQuiz,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#CBD5E1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNewQuiz}
            className="flex items-center gap-2.5 text-left focus:outline-hidden"
          >
            <div className="w-8 h-8 rounded-md bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs tracking-wider">
              AQ
            </div>
            <span className="font-bold text-[#0F172A] tracking-tight text-base sm:text-lg">
              AI Quiz Studio
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Quiz Return */}
          {hasActiveQuiz && activeView !== 'quiz' && onGoToActiveQuiz && (
            <button
              type="button"
              onClick={onGoToActiveQuiz}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A8A] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-md transition-colors"
            >
              <span>Resume Active Quiz</span>
            </button>
          )}

          {/* New Quiz Button */}
          {activeView !== 'studio' && (
            <button
              type="button"
              onClick={onNewQuiz}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>New Quiz</span>
            </button>
          )}

          {/* API Key Modal Trigger: ONLY VISIBLE IF API STOPS WORKING */}
          {showApiOption && (
            <button
              type="button"
              onClick={onOpenApiSettings}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#FFFBEB] text-[#92400E] border border-[#F59E0B] hover:bg-[#FEF3C7] transition-colors"
              title="API service interrupted. Provide backup key."
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Update API Key</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
