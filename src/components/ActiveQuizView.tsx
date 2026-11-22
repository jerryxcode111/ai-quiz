'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileCode,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import {
  QuizPackage,
  QuizAttemptState,
  QuestionChoiceKey,
  QuizMode,
  QuizResultSummary,
} from '@/types/quiz';
import { saveActiveAttempt, getActiveAttempt, clearActiveAttempt } from '@/lib/storage';
import { exportOfflineHtmlQuiz, exportStudySheetMarkdown, downloadFile } from '@/lib/export';

interface ActiveQuizViewProps {
  quiz: QuizPackage;
  onFinishQuiz: (summary: QuizResultSummary) => void;
  onQuitToStudio: () => void;
}

export const ActiveQuizView: React.FC<ActiveQuizViewProps> = ({
  quiz,
  onFinishQuiz,
  onQuitToStudio,
}) => {
  const { metadata, questions } = quiz;

  // Filter state
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  // Filtered question set for display while maintaining global indices
  const filteredQuestions = useMemo(() => {
    if (selectedTopic === 'all') return questions;
    return questions.filter((q) => q.topic === selectedTopic);
  }, [questions, selectedTopic]);

  // Current active question index (points to index in `filteredQuestions`)
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Active quiz attempt state
  const [attemptState, setAttemptState] = useState<QuizAttemptState>(() => {
    const cached = getActiveAttempt(metadata.id);
    if (cached && !cached.isFinished) {
      return cached;
    }
    return {
      quizId: metadata.id,
      mode: metadata.defaultMode || 'practice',
      answers: {},
      flaggedQuestionIds: [],
      revealedRationales: {},
      startedAt: Date.now(),
      timeRemainingSeconds: metadata.timerMinutes ? metadata.timerMinutes * 60 : null,
      isFinished: false,
    };
  });

  // Keep active attempt synced with localStorage
  useEffect(() => {
    saveActiveAttempt(attemptState);
  }, [attemptState]);

  // Active question object
  const currentQuestion = filteredQuestions[currentIndex] || filteredQuestions[0] || questions[0];
  const currentGlobalIndex = questions.findIndex((q) => q.id === currentQuestion.id);

  // Countdown timer logic
  useEffect(() => {
    if (attemptState.timeRemainingSeconds === null || attemptState.isFinished) return;

    const interval = setInterval(() => {
      setAttemptState((prev) => {
        if (prev.timeRemainingSeconds === null) return prev;
        if (prev.timeRemainingSeconds <= 1) {
          clearInterval(interval);
          handleFinish(prev);
          return { ...prev, timeRemainingSeconds: 0, isFinished: true };
        }
        return { ...prev, timeRemainingSeconds: prev.timeRemainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attemptState.timeRemainingSeconds, attemptState.isFinished]);

  // Format Timer mm:ss
  const formatTimer = (totalSecs: number | null) => {
    if (totalSecs === null) return null;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Answer handler
  const handleSelectChoice = (choiceKey: QuestionChoiceKey) => {
    setAttemptState((prev) => {
      const nextAnswers = { ...prev.answers, [currentQuestion.id]: choiceKey };
      const nextRationales = { ...prev.revealedRationales };

      // In practice mode, reveal rationale immediately
      if (prev.mode === 'practice') {
        nextRationales[currentQuestion.id] = true;
      }

      return {
        ...prev,
        answers: nextAnswers,
        revealedRationales: nextRationales,
      };
    });
  };

  // Flag toggle
  const handleToggleFlag = () => {
    setAttemptState((prev) => {
      const isFlagged = prev.flaggedQuestionIds.includes(currentQuestion.id);
      return {
        ...prev,
        flaggedQuestionIds: isFlagged
          ? prev.flaggedQuestionIds.filter((id) => id !== currentQuestion.id)
          : [...prev.flaggedQuestionIds, currentQuestion.id],
      };
    });
  };

  // Navigation
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // Mode Toggle (Practice vs Exam)
  const handleToggleMode = () => {
    setAttemptState((prev) => ({
      ...prev,
      mode: prev.mode === 'practice' ? 'exam' : 'practice',
    }));
  };

  // Finish and compute scores
  const handleFinish = (stateToScore?: QuizAttemptState) => {
    const finalState = stateToScore || attemptState;
    const answeredCount = Object.keys(finalState.answers).length;
    let correctCount = 0;
    const topicMap: Record<string, { correct: number; total: number }> = {};

    questions.forEach((q) => {
      if (!topicMap[q.topic]) {
        topicMap[q.topic] = { correct: 0, total: 0 };
      }
      topicMap[q.topic].total += 1;

      const userAns = finalState.answers[q.id];
      if (userAns === q.correctKey) {
        correctCount += 1;
        topicMap[q.topic].correct += 1;
      }
    });

    const totalQuestions = questions.length;
    const incorrectCount = answeredCount - correctCount;
    const unansweredCount = totalQuestions - answeredCount;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const timeSpentSeconds = Math.round((Date.now() - finalState.startedAt) / 1000);

    const topicAccuracy = Object.entries(topicMap).map(([topic, data]) => ({
      topic,
      correct: data.correct,
      total: data.total,
      accuracyPercentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));

    const missedQuestions = questions
      .filter((q) => finalState.answers[q.id] !== q.correctKey)
      .map((q) => ({
        question: q,
        userAnswer: finalState.answers[q.id],
        correctAnswer: q.correctKey,
        rationale: q.rationale,
      }));

    const summary: QuizResultSummary = {
      quizId: metadata.id,
      title: metadata.title,
      totalQuestions,
      answeredCount,
      correctCount,
      incorrectCount,
      unansweredCount,
      scorePercentage,
      timeSpentSeconds,
      topicAccuracy,
      missedQuestions,
    };

    setAttemptState((prev) => ({ ...prev, isFinished: true, finishedAt: Date.now() }));
    onFinishQuiz(summary);
  };

  // Reset attempt
  const handleResetAttempt = () => {
    if (window.confirm('Reset this quiz attempt and start over? All answers and timer will be reset.')) {
      clearActiveAttempt(metadata.id);
      setAttemptState({
        quizId: metadata.id,
        mode: metadata.defaultMode || 'practice',
        answers: {},
        flaggedQuestionIds: [],
        revealedRationales: {},
        startedAt: Date.now(),
        timeRemainingSeconds: metadata.timerMinutes ? metadata.timerMinutes * 60 : null,
        isFinished: false,
      });
      setCurrentIndex(0);
    }
  };

  // Keyboard Shortcuts (A-E, 1-5, Arrows, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();

      if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        const choice = currentQuestion.choices.find((c) => c.key === key);
        if (choice) {
          handleSelectChoice(key as QuestionChoiceKey);
        }
      } else if (['1', '2', '3', '4', '5'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        const choice = currentQuestion.choices[idx];
        if (choice) {
          handleSelectChoice(choice.key);
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (key === 'F') {
        handleToggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentIndex, filteredQuestions.length]);

  // Statistics calculation for progress bar
  const totalQuestions = questions.length;
  const answeredTotal = Object.keys(attemptState.answers).length;
  const flaggedTotal = attemptState.flaggedQuestionIds.length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredTotal / totalQuestions) * 100) : 0;

  // Running score in practice mode
  let runningCorrect = 0;
  questions.forEach((q) => {
    if (attemptState.answers[q.id] === q.correctKey) runningCorrect++;
  });
  const runningScorePercent = answeredTotal > 0 ? Math.round((runningCorrect / answeredTotal) * 100) : 0;

  // Question specific states
  const selectedAnswer = attemptState.answers[currentQuestion.id];
  const isFlagged = attemptState.flaggedQuestionIds.includes(currentQuestion.id);
  const isRationaleRevealed = attemptState.revealedRationales[currentQuestion.id];

  const isTimerCritical =
    attemptState.timeRemainingSeconds !== null && attemptState.timeRemainingSeconds < 60;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* 1. TOP QUIZ HEADER BAR */}
      <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-4 sm:px-6 sm:py-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Topic filter */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] truncate max-w-xl">
              {metadata.title}
            </h1>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
              {questions.length} Qs
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#475569]">
            {/* Topic Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="font-medium text-[#64748B]">Filter:</span>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setCurrentIndex(0);
                }}
                className="text-xs font-semibold bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2 py-0.5 text-[#0F172A] focus:outline-hidden focus:border-[#1E3A8A]"
              >
                <option value="all">All Topics ({questions.length})</option>
                {metadata.topics.map((t) => (
                  <option key={t} value={t}>
                    {t} ({questions.filter((q) => q.topic === t).length})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Practice vs Exam Toggle */}
          <button
            type="button"
            onClick={handleToggleMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              attemptState.mode === 'practice'
                ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
                : 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1]'
            }`}
          >
            {attemptState.mode === 'practice' ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Practice Mode</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Exam Mode</span>
              </>
            )}
          </button>

          {/* Countdown Timer */}
          {attemptState.timeRemainingSeconds !== null && (
            <div
              className={`font-mono text-xs font-bold px-3 py-1.5 rounded-md border flex items-center gap-1.5 ${
                isTimerCritical
                  ? 'bg-[#FEF2F2] text-[#991B1B] border-[#EF4444] animate-pulse'
                  : 'bg-[#F1F5F9] text-[#0F172A] border-[#CBD5E1]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(attemptState.timeRemainingSeconds)}</span>
            </div>
          )}

          {/* Export HTML */}
          <button
            type="button"
            onClick={() => {
              const html = exportOfflineHtmlQuiz(quiz);
              downloadFile(html, `${metadata.title.toLowerCase().replace(/\s+/g, '_')}_offline.html`, 'text/html');
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
            title="Download self-contained offline interactive quiz"
          >
            <FileCode className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Export HTML</span>
          </button>

          {/* Export Study Sheet */}
          <button
            type="button"
            onClick={() => {
              const md = exportStudySheetMarkdown(quiz);
              downloadFile(md, `${metadata.title.toLowerCase().replace(/\s+/g, '_')}_study_sheet.md`, 'text/markdown');
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
            title="Download Markdown summary with answers and rationales"
          >
            <FileText className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Study Sheet</span>
          </button>

          {/* Finish & Score Button */}
          <button
            type="button"
            onClick={() => {
              const unanswered = totalQuestions - answeredTotal;
              if (
                unanswered > 0 &&
                !window.confirm(`You still have ${unanswered} unanswered question(s). Finish and view score now?`)
              ) {
                return;
              }
              handleFinish();
            }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172554] rounded-md transition-colors shadow-xs"
          >
            Finish & Score
          </button>
        </div>
      </div>

      {/* 2. PROGRESS STRIP */}
      <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-3 sm:px-4 shadow-xs">
        <div className="flex items-center justify-between text-xs font-mono font-medium text-[#475569] mb-2">
          <div className="flex items-center gap-4">
            <span>
              Answered: <strong className="text-[#0F172A]">{answeredTotal}</strong> / {totalQuestions}
            </span>
            {attemptState.mode === 'practice' && (
              <span>
                Running Score: <strong className="text-[#10B981]">{runningScorePercent}%</strong>
              </span>
            )}
            <span>
              Flagged: <strong className="text-[#D97706]">{flaggedTotal}</strong>
            </span>
          </div>
          <div>
            <span>{progressPercent}% Complete</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden border border-[#E2E8F0]">
          <div
            className="h-full bg-[#1E3A8A] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3. TWO-COLUMN QUIZ WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-6 items-start">
        {/* LEFT COLUMN: ACTIVE QUESTION CARD */}
        <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-6 sm:p-7 shadow-xs space-y-5">
          {/* Question Sub-header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#1E3A8A] border border-[#CBD5E1]">
                QUESTION {String(currentGlobalIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]">
                {currentQuestion.topic}
              </span>
              {currentQuestion.difficulty && (
                <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded text-[#64748B] border border-[#E2E8F0]">
                  {currentQuestion.difficulty}
                </span>
              )}
            </div>

            {/* Flag for review button */}
            <button
              type="button"
              onClick={handleToggleFlag}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                isFlagged
                  ? 'bg-[#FFFBEB] text-[#92400E] border-[#F59E0B]'
                  : 'bg-[#FFFFFF] text-[#64748B] hover:text-[#0F172A] border-[#CBD5E1]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFlagged ? 'fill-[#F59E0B] text-[#F59E0B]' : ''}`} />
              <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
            </button>
          </div>

          {/* Scenario Prompt Box (if present) */}
          {currentQuestion.scenario && (
            <div className="p-3.5 bg-[#F8FAFC] border-l-4 border-[#1E3A8A] border border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] rounded-r-md text-xs sm:text-sm text-[#334155] italic leading-relaxed">
              <div className="font-mono text-[10px] uppercase font-bold not-italic text-[#64748B] mb-1">
                Clinical / Problem Scenario
              </div>
              {currentQuestion.scenario}
            </div>
          )}

          {/* Question Text */}
          <div className="text-sm sm:text-base font-bold text-[#0F172A] leading-relaxed">
            {currentQuestion.question}
          </div>

          {/* Option Buttons (Stacked A-D or A-E) */}
          <div className="space-y-2.5 pt-2">
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedAnswer === choice.key;
              const isCorrect = choice.key === currentQuestion.correctKey;
              const isPractice = attemptState.mode === 'practice';
              const isAnswered = Boolean(selectedAnswer);

              // Styling states
              let btnStyle = 'bg-[#FFFFFF] text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]';
              let badgeStyle = 'bg-[#F1F5F9] text-[#0F172A] border-[#CBD5E1]';

              if (isPractice && isAnswered) {
                if (isCorrect) {
                  btnStyle = 'bg-[#ECFDF5] text-[#065F46] border-[#10B981] font-semibold';
                  badgeStyle = 'bg-[#10B981] text-white border-[#10B981]';
                } else if (isSelected && !isCorrect) {
                  btnStyle = 'bg-[#FEF2F2] text-[#991B1B] border-[#EF4444]';
                  badgeStyle = 'bg-[#EF4444] text-white border-[#EF4444]';
                }
              } else if (isSelected) {
                // Exam mode or unrevealed selection
                btnStyle = 'bg-[#EFF6FF] text-[#1E3A8A] border-[#1E3A8A] font-semibold';
                badgeStyle = 'bg-[#1E3A8A] text-white border-[#1E3A8A]';
              }

              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => handleSelectChoice(choice.key)}
                  className={`w-full text-left p-3 rounded-md border flex items-start gap-3 transition-colors ${btnStyle}`}
                >
                  <span
                    className={`w-7 h-7 rounded shrink-0 font-mono font-bold text-xs flex items-center justify-center border ${badgeStyle}`}
                  >
                    {choice.key}
                  </span>
                  <span className="text-xs sm:text-sm mt-0.5 leading-snug flex-1">
                    {choice.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rationale Box (Practice mode or revealed) */}
          {selectedAnswer && (attemptState.mode === 'practice' || isRationaleRevealed) && (
            <div className="mt-4 p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#334155] space-y-1.5 animate-in fade-in duration-200">
              <div className="font-semibold text-xs text-[#0F172A] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Explanation & Rationale:</span>
              </div>
              <p className="leading-relaxed text-[#475569]">{currentQuestion.rationale}</p>
            </div>
          )}

          {/* Footer Navigation Bar */}
          <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Keyboard shortcuts hints */}
            <div className="text-[11px] font-mono text-[#64748B] flex items-center gap-2">
              <span className="bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#CBD5E1]">A-E</span>
              <span>to select</span>
              <span className="bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#CBD5E1]">← / →</span>
              <span>to navigate</span>
              <span className="bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#CBD5E1]">F</span>
              <span>to flag</span>
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed border border-[#CBD5E1] rounded-md"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {currentIndex < filteredQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172554] rounded-md shadow-xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleFinish()}
                  className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-md shadow-xs"
                >
                  <span>Finish Quiz</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 290PX QUESTION NAVIGATOR */}
        <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-5 shadow-xs sticky top-20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Question Navigator
            </h3>
            <span className="font-mono text-xs text-[#64748B]">
              {answeredTotal}/{totalQuestions}
            </span>
          </div>

          {/* 5-Column Grid */}
          <div className="grid grid-cols-5 gap-2">
            {filteredQuestions.map((q, idx) => {
              const isCurrent = q.id === currentQuestion.id;
              const isAnswered = Boolean(attemptState.answers[q.id]);
              const flagged = attemptState.flaggedQuestionIds.includes(q.id);
              const isPractice = attemptState.mode === 'practice';
              const isCorrect = attemptState.answers[q.id] === q.correctKey;

              let btnStyle = 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]';

              if (isPractice && isAnswered) {
                if (isCorrect) {
                  btnStyle = 'bg-[#ECFDF5] text-[#065F46] border-[#10B981]';
                } else {
                  btnStyle = 'bg-[#FEF2F2] text-[#991B1B] border-[#EF4444]';
                }
              } else if (isAnswered) {
                btnStyle = 'bg-[#F1F5F9] text-[#0F172A] border-[#94A3B8] font-bold';
              }

              if (isCurrent) {
                btnStyle += ' ring-2 ring-[#1E3A8A] ring-offset-1 border-[#1E3A8A] font-bold';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative h-9 text-xs font-mono rounded-md border flex items-center justify-center transition-all ${btnStyle}`}
                >
                  {idx + 1}
                  {flagged && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F59E0B]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-[#E2E8F0] space-y-1.5 text-[11px] font-mono text-[#64748B]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs border border-[#1E3A8A] ring-1 ring-[#1E3A8A] bg-white inline-block" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs border border-[#94A3B8] bg-[#F1F5F9] inline-block" />
              <span>Answered</span>
            </div>
            {attemptState.mode === 'practice' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs border border-[#10B981] bg-[#ECFDF5] inline-block" />
                  <span>Correct</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs border border-[#EF4444] bg-[#FEF2F2] inline-block" />
                  <span>Incorrect</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block" />
              <span>Flagged for review</span>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetAttempt}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#64748B] hover:text-[#991B1B] hover:bg-[#FEF2F2] border border-[#E2E8F0] rounded-md transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Attempt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

