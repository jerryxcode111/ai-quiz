'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  PlusCircle,
  Download,
  FileCode,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { QuizResultSummary, QuizPackage } from '@/types/quiz';
import { exportOfflineHtmlQuiz, exportStudySheetMarkdown, downloadFile } from '@/lib/export';

interface ResultsViewProps {
  summary: QuizResultSummary;
  originalQuiz: QuizPackage;
  onReviewQuestions: () => void;
  onRetryMissedOnly: (missedQuestionsQuiz: QuizPackage) => void;
  onCreateAnotherQuiz: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  summary,
  originalQuiz,
  onReviewQuestions,
  onRetryMissedOnly,
  onCreateAnotherQuiz,
}) => {
  // Trigger celebration confetti for distinction (>= 80%)
  useEffect(() => {
    if (summary.scorePercentage >= 80) {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#1E3A8A', '#10B981', '#3B82F6'],
        });
      } catch (err) {
        // Safe fallback if canvas not available
      }
    }
  }, [summary.scorePercentage]);

  const formatTimeSpent = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder}s`;
  };

  // Grade badge logic
  const getGradeInfo = (pct: number) => {
    if (pct >= 90) return { label: 'High Distinction', color: 'text-[#065F46] bg-[#ECFDF5] border-[#10B981]' };
    if (pct >= 80) return { label: 'Distinction', color: 'text-[#065F46] bg-[#ECFDF5] border-[#10B981]' };
    if (pct >= 70) return { label: 'Satisfactory Pass', color: 'text-[#1E3A8A] bg-[#EFF6FF] border-[#BFDBFE]' };
    if (pct >= 50) return { label: 'Marginal Pass', color: 'text-[#92400E] bg-[#FFFBEB] border-[#F59E0B]' };
    return { label: 'Needs Comprehensive Review', color: 'text-[#991B1B] bg-[#FEF2F2] border-[#EF4444]' };
  };

  const grade = getGradeInfo(summary.scorePercentage);

  // Construct retry missed quiz package
  const handleRetryMissed = () => {
    if (summary.missedQuestions.length === 0) return;

    const missedOnlyPackage: QuizPackage = {
      metadata: {
        id: `retry_${summary.quizId}_${Date.now()}`,
        title: `Retry: ${summary.title} (Missed Items)`,
        topicSummary: `Targeted review of ${summary.missedQuestions.length} missed question(s).`,
        createdAt: new Date().toISOString(),
        questionCount: summary.missedQuestions.length,
        choiceCount: originalQuiz.metadata.choiceCount,
        defaultMode: 'practice',
        timerMinutes: null,
        topics: Array.from(new Set(summary.missedQuestions.map((m) => m.question.topic))),
      },
      questions: summary.missedQuestions.map((m) => m.question),
    };

    onRetryMissedOnly(missedOnlyPackage);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. SUMMARY CARD */}
      <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${grade.color}`}>
                {grade.label}
              </span>
              <span className="text-xs font-mono text-[#64748B]">
                Time: {formatTimeSpent(summary.timeSpentSeconds)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
              Exam & Quiz Performance Report
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{summary.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const html = exportOfflineHtmlQuiz(originalQuiz);
                downloadFile(html, `${summary.title.toLowerCase().replace(/\s+/g, '_')}_offline.html`, 'text/html');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Offline HTML</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const md = exportStudySheetMarkdown(originalQuiz);
                downloadFile(md, `${summary.title.toLowerCase().replace(/\s+/g, '_')}_study_sheet.md`, 'text/markdown');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Study Sheet</span>
            </button>
          </div>
        </div>

        {/* 4 STAT BOXES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
          {/* Final Score % */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 text-center">
            <div className="text-[11px] font-semibold text-[#1E3A8A] uppercase tracking-wider">
              Final Score
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-bold text-[#1E3A8A] mt-1">
              {summary.scorePercentage}%
            </div>
            <div className="text-[11px] font-mono text-[#475569] mt-1">
              {summary.correctCount} / {summary.totalQuestions} Questions
            </div>
          </div>

          {/* Correct Count */}
          <div className="bg-[#ECFDF5] border border-[#10B981] rounded-lg p-4 text-center">
            <div className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider">
              Correct
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-bold text-[#065F46] mt-1">
              {summary.correctCount}
            </div>
            <div className="text-[11px] font-mono text-[#065F46] mt-1">
              {summary.totalQuestions > 0 ? Math.round((summary.correctCount / summary.totalQuestions) * 100) : 0}% Accuracy
            </div>
          </div>

          {/* Incorrect Count */}
          <div className="bg-[#FEF2F2] border border-[#EF4444] rounded-lg p-4 text-center">
            <div className="text-[11px] font-semibold text-[#991B1B] uppercase tracking-wider">
              Incorrect
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-bold text-[#991B1B] mt-1">
              {summary.incorrectCount}
            </div>
            <div className="text-[11px] font-mono text-[#991B1B] mt-1">
              Requires review
            </div>
          </div>

          {/* Unanswered Count */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-4 text-center">
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Unanswered
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-bold text-[#475569] mt-1">
              {summary.unansweredCount}
            </div>
            <div className="text-[11px] font-mono text-[#64748B] mt-1">
              Skipped questions
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS STRIP */}
        <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onReviewQuestions}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0F172A] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors shadow-xs"
          >
            <span>Review All Questions</span>
          </button>

          {summary.missedQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleRetryMissed}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172554] rounded-md transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Missed Only ({summary.missedQuestions.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCreateAnotherQuiz}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#475569] hover:text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded-md transition-colors ml-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Another Quiz</span>
          </button>
        </div>
      </div>

      {/* 2. TOPIC ACCURACY TABLE */}
      {summary.topicAccuracy.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
            <TrendingUp className="w-4 h-4 text-[#1E3A8A]" />
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Topic & Section Accuracy Breakdown
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-mono">
                  <th className="py-2.5 px-3 font-semibold">Topic / Section</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Correct</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Total</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Accuracy</th>
                  <th className="py-2.5 px-3 font-semibold w-36">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {summary.topicAccuracy.map((t) => (
                  <tr key={t.topic} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-medium text-[#0F172A]">{t.topic}</td>
                    <td className="py-2.5 px-3 font-mono text-center text-[#065F46] font-semibold">
                      {t.correct}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center text-[#475569]">{t.total}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-[#0F172A]">
                      {t.accuracyPercentage}%
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden border border-[#CBD5E1]">
                        <div
                          className={`h-full ${
                            t.accuracyPercentage >= 75
                              ? 'bg-[#10B981]'
                              : t.accuracyPercentage >= 50
                              ? 'bg-[#F59E0B]'
                              : 'bg-[#EF4444]'
                          }`}
                          style={{ width: `${t.accuracyPercentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MISSED QUESTIONS REVIEW CARD */}
      {summary.missedQuestions.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Missed Questions Review ({summary.missedQuestions.length})
              </h2>
            </div>
            <span className="font-mono text-xs text-[#64748B]">
              Carefully study explanations to cement learning
            </span>
          </div>

          <div className="space-y-4">
            {summary.missedQuestions.map((item, idx) => {
              const q = item.question;
              const userChoice = q.choices.find((c) => c.key === item.userAnswer);
              const correctChoice = q.choices.find((c) => c.key === item.correctAnswer);

              return (
                <div
                  key={q.id}
                  className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#1E3A8A]">
                      Question #{idx + 1}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#CBD5E1] text-[#475569]">
                      {q.topic}
                    </span>
                  </div>

                  {q.scenario && (
                    <div className="text-xs text-[#475569] italic border-l-2 border-[#94A3B8] pl-2.5 py-0.5">
                      {q.scenario}
                    </div>
                  )}

                  <div className="text-xs font-bold text-[#0F172A]">{q.question}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* User Answer */}
                    <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#EF4444] text-[#991B1B]">
                      <div className="font-mono font-bold text-[10px] uppercase mb-0.5">
                        Your Answer:
                      </div>
                      <div className="font-medium">
                        {userChoice ? `[${userChoice.key}] ${userChoice.text}` : 'Unanswered / Skipped'}
                      </div>
                    </div>

                    {/* Correct Answer */}
                    <div className="p-2.5 rounded bg-[#ECFDF5] border border-[#10B981] text-[#065F46]">
                      <div className="font-mono font-bold text-[10px] uppercase mb-0.5">
                        Correct Answer:
                      </div>
                      <div className="font-medium">
                        [{correctChoice?.key}] {correctChoice?.text}
                      </div>
                    </div>
                  </div>

                  {/* Rationale */}
                  <div className="p-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded text-xs text-[#334155] leading-relaxed">
                    <strong className="text-[#0F172A]">Rationale: </strong>
                    {q.rationale}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-center">
          <Trophy className="w-10 h-10 text-[#065F46] mx-auto mb-2" />
          <h2 className="text-base font-bold text-[#065F46]">Flawless Score!</h2>
          <p className="text-xs text-[#065F46] mt-1">
            You answered all {summary.totalQuestions} questions correctly with zero misses.
          </p>
        </div>
      )}
    </div>
  );
};

