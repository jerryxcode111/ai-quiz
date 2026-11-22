'use client';

import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { ApiSettingsModal } from '@/components/ApiSettingsModal';
import { GeneratorView } from '@/components/GeneratorView';
import { ActiveQuizView } from '@/components/ActiveQuizView';
import { ResultsView } from '@/components/ResultsView';
import { QuizPackage, QuizResultSummary } from '@/types/quiz';
import { getApiSettings, saveQuiz, getSavedQuizzes } from '@/lib/storage';

export default function Home() {
  const [activeView, setActiveView] = useState<'studio' | 'quiz' | 'results'>('studio');
  const [currentQuiz, setCurrentQuiz] = useState<QuizPackage | null>(null);
  const [lastSummary, setLastSummary] = useState<QuizResultSummary | null>(null);

  // API option is locked & hidden unless the API service stops working or key is missing
  const [showApiOption, setShowApiOption] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // Check if API is available on load
  const verifyApiAvailability = async () => {
    const local = getApiSettings();
    if (local.hasCustomKey) {
      setShowApiOption(false);
      return;
    }

    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        // Only show API option if server key is completely missing
        setShowApiOption(!data.hasServerKey);
      } else {
        setShowApiOption(true);
      }
    } catch {
      setShowApiOption(true);
    }
  };

  useEffect(() => {
    verifyApiAvailability();

    // Check if there's any recent quiz in local history
    const recent = getSavedQuizzes();
    if (recent.length > 0 && !currentQuiz) {
      setCurrentQuiz(recent[0]);
    }
  }, []);

  const handleApiFailure = () => {
    // Unlocks and shows the API key option immediately when API fails/quota hits
    setShowApiOption(true);
    setIsApiModalOpen(true);
  };

  const handleQuizReady = (quiz: QuizPackage) => {
    saveQuiz(quiz);
    setCurrentQuiz(quiz);
    setActiveView('quiz');
  };

  const handleFinishQuiz = (summary: QuizResultSummary) => {
    setLastSummary(summary);
    setActiveView('results');
  };

  const handleReviewQuestions = () => {
    setActiveView('quiz');
  };

  const handleRetryMissedOnly = (missedQuiz: QuizPackage) => {
    saveQuiz(missedQuiz);
    setCurrentQuiz(missedQuiz);
    setActiveView('quiz');
  };

  const handleNewQuiz = () => {
    setActiveView('studio');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Bar */}
      <TopBar
        showApiOption={showApiOption}
        onOpenApiSettings={() => setIsApiModalOpen(true)}
        onNewQuiz={handleNewQuiz}
        activeView={activeView}
        hasActiveQuiz={Boolean(currentQuiz)}
        onGoToActiveQuiz={() => setActiveView('quiz')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeView === 'studio' && (
          <GeneratorView
            onQuizReady={handleQuizReady}
            onApiFailure={handleApiFailure}
          />
        )}

        {activeView === 'quiz' && currentQuiz && (
          <ActiveQuizView
            quiz={currentQuiz}
            onFinishQuiz={handleFinishQuiz}
            onQuitToStudio={handleNewQuiz}
          />
        )}

        {activeView === 'results' && lastSummary && currentQuiz && (
          <ResultsView
            summary={lastSummary}
            originalQuiz={currentQuiz}
            onReviewQuestions={handleReviewQuestions}
            onRetryMissedOnly={handleRetryMissedOnly}
            onCreateAnotherQuiz={handleNewQuiz}
          />
        )}
      </main>

      {/* Backup API Settings Modal */}
      <ApiSettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        onSaved={verifyApiAvailability}
      />
    </div>
  );
}
