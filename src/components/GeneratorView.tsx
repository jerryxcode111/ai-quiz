'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  X,
  Sparkles,
  Settings,
  History,
  Trash2,
  Download,
  AlertCircle,
} from 'lucide-react';
import {
  QuizPackage,
  QuestionStyle,
  DifficultyOption,
  QuizMode,
} from '@/types/quiz';
import { getSavedQuizzes, deleteSavedQuiz, getApiSettings } from '@/lib/storage';

interface GeneratorViewProps {
  onQuizReady: (quiz: QuizPackage) => void;
  onApiFailure: () => void;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  onQuizReady,
  onApiFailure,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [pastedNotes, setPastedNotes] = useState('');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [choiceCount, setChoiceCount] = useState<4 | 5>(4);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [questionStyle, setQuestionStyle] = useState<QuestionStyle>('scenario');
  const [difficulty, setDifficulty] = useState<DifficultyOption>('all');
  const [quizMode, setQuizMode] = useState<QuizMode>('practice');
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedQuizzes, setSavedQuizzes] = useState<QuizPackage[]>([]);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  const refreshSavedQuizzes = () => {
    setSavedQuizzes(getSavedQuizzes());
  };

  useEffect(() => {
    refreshSavedQuizzes();
  }, []);

  const totalBatchBytes = uploadedFiles.reduce((acc, f) => acc + f.size, 0);
  const maxBatchBytes = 4.4 * 1024 * 1024;
  const isOverSize = totalBatchBytes > maxBatchBytes;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    setErrorMessage(null);
    const combined = [...uploadedFiles, ...newFiles];
    if (combined.length > 5) {
      setErrorMessage('Maximum 5 files allowed per upload.');
      setUploadedFiles(combined.slice(0, 5));
      return;
    }
    setUploadedFiles(combined);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setErrorMessage(null);

    if (uploadedFiles.length === 0 && !pastedNotes.trim() && !topicPrompt.trim()) {
      setErrorMessage('Provide study notes, upload documents/images, or enter a focus topic.');
      return;
    }

    if (isOverSize) {
      setErrorMessage('Total file size exceeds 4.4 MB.');
      return;
    }

    setIsLoading(true);

    try {
      const apiSettings = getApiSettings();
      const formData = new FormData();

      uploadedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('pastedNotes', pastedNotes);
      formData.append('topicPrompt', topicPrompt);
      formData.append('questionCount', questionCount.toString());
      formData.append('choiceCount', choiceCount.toString());
      formData.append('questionStyle', questionStyle);
      formData.append('difficulty', difficulty);
      formData.append('quizMode', quizMode);
      if (timerMinutes) {
        formData.append('timerMinutes', timerMinutes.toString());
      }

      const headers: Record<string, string> = {};
      if (apiSettings.apiKey) {
        headers['x-gemini-key'] = apiSettings.apiKey;
      }
      if (apiSettings.preferredModel) {
        headers['x-gemini-model'] = apiSettings.preferredModel;
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.apiError || res.status === 401 || res.status === 429) {
          onApiFailure();
        }
        setErrorMessage(data.error || 'Failed to generate quiz.');
        setIsLoading(false);
        return;
      }

      onQuizReady(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred while generating quiz.');
      setIsLoading(false);
    }
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.metadata && parsed.questions && Array.isArray(parsed.questions)) {
          onQuizReady(parsed as QuizPackage);
        } else {
          setErrorMessage('Invalid Quiz JSON format.');
        }
      } catch (err) {
        setErrorMessage('Failed to parse Quiz JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getFormatBadge = (name: string) => {
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* View Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
            Quiz Generator
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Generate scenario-based or conceptual multiple-choice exams from documents or notes.
          </p>
        </div>
        <div>
          <input
            type="file"
            ref={jsonImportRef}
            onChange={handleJsonImport}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => jsonImportRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#475569] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5 rotate-180" />
            <span>Import JSON</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-3.5 bg-[#FEF2F2] border border-[#EF4444] rounded-md flex items-start gap-3 text-xs text-[#991B1B]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-[#FEE2E2] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 items-start">
        {/* Left Column: Source Materials */}
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1E3A8A]" />
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Source Content
                </h2>
              </div>
              <span className="font-mono text-xs text-[#64748B]">Max 5 files (4.4 MB)</span>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#1E3A8A] bg-[#EFF6FF]'
                  : 'border-[#CBD5E1] hover:border-[#94A3B8] bg-[#F8FAFC]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                multiple
                accept=".pdf,.docx,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />
              <Upload className="w-7 h-7 mx-auto text-[#64748B] mb-2" />
              <p className="text-xs sm:text-sm font-semibold text-[#0F172A]">
                Drag and drop files, or <span className="text-[#1E3A8A] underline">browse</span>
              </p>
              <p className="text-[11px] text-[#64748B] mt-1 font-mono">
                PDF, DOCX, TXT, Markdown, CSV, or Images
              </p>
            </div>

            {/* Uploaded File List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-[#475569] flex justify-between">
                  <span>Attached Files ({uploadedFiles.length}/5)</span>
                  <span
                    className={`font-mono text-[11px] ${
                      isOverSize ? 'text-[#EF4444] font-bold' : 'text-[#64748B]'
                    }`}
                  >
                    {(totalBatchBytes / (1024 * 1024)).toFixed(2)} MB / 4.40 MB
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {uploadedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-md text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#CBD5E1] text-[#1E3A8A]">
                          {getFormatBadge(f.name)}
                        </span>
                        <span className="font-medium text-[#0F172A] truncate max-w-[240px]">
                          {f.name}
                        </span>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="p-1 text-[#64748B] hover:text-[#EF4444] rounded hover:bg-[#FFFFFF]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pasted Notes */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                Paste Study Notes or Text
              </label>
              <textarea
                value={pastedNotes}
                onChange={(e) => setPastedNotes(e.target.value)}
                rows={5}
                placeholder="Paste lecture excerpts, textbook notes, or outlines here..."
                className="w-full text-xs font-mono p-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#1E3A8A]"
              />
              <div className="text-right text-[11px] font-mono text-[#64748B] mt-0.5">
                {pastedNotes.length} characters
              </div>
            </div>

            {/* Focus Topic */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                Focus Topic (Optional)
              </label>
              <input
                type="text"
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Chapter 5: Membrane transport and cellular respiration"
                className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#1E3A8A]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Configuration & History */}
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
              <Settings className="w-4 h-4 text-[#1E3A8A]" />
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Configuration
              </h2>
            </div>

            <div className="space-y-4">
              {/* Question Count */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Number of Questions
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[5, 10, 15, 20, 30, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`py-1.5 text-xs font-mono font-bold rounded-md border text-center transition-colors ${
                        questionCount === num
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Choices Format */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Options per Question
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChoiceCount(4)}
                    className={`py-2 px-3 text-xs rounded-md border text-center transition-colors ${
                      choiceCount === 4
                        ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#1E3A8A] font-semibold'
                        : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    4 Choices (A–D)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoiceCount(5)}
                    className={`py-2 px-3 text-xs rounded-md border text-center transition-colors ${
                      choiceCount === 5
                        ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#1E3A8A] font-semibold'
                        : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    5 Choices (A–E)
                  </button>
                </div>
              </div>

              {/* Question Style */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Question Style
                </label>
                <select
                  value={questionStyle}
                  onChange={(e) => setQuestionStyle(e.target.value as QuestionStyle)}
                  className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-hidden focus:border-[#1E3A8A]"
                >
                  <option value="scenario">Scenario-Based Problem Vignettes</option>
                  <option value="analytical">Analytical & Discrimination</option>
                  <option value="conceptual">Conceptual Principles</option>
                  <option value="direct">Direct Recall & Definitions</option>
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Difficulty
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'all', label: 'Mixed' },
                    { id: 'easy', label: 'Easy' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'hard', label: 'Hard' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id as DifficultyOption)}
                      className={`py-1.5 text-xs font-medium rounded-md border text-center transition-colors ${
                        difficulty === d.id
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] font-semibold'
                          : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuizMode('practice')}
                    className={`py-2 px-3 text-left text-xs rounded-md border transition-colors ${
                      quizMode === 'practice'
                        ? 'bg-[#EFF6FF] border-[#1E3A8A] text-[#1E3A8A] font-semibold'
                        : 'bg-[#FFFFFF] border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div>Practice Mode</div>
                    <div className="text-[10px] text-[#64748B] font-normal">Immediate answers</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuizMode('exam')}
                    className={`py-2 px-3 text-left text-xs rounded-md border transition-colors ${
                      quizMode === 'exam'
                        ? 'bg-[#EFF6FF] border-[#1E3A8A] text-[#1E3A8A] font-semibold'
                        : 'bg-[#FFFFFF] border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div>Exam Mode</div>
                    <div className="text-[10px] text-[#64748B] font-normal">Hidden until finish</div>
                  </button>
                </div>
              </div>

              {/* Timer */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Timer
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { val: null, label: 'Untimed' },
                    { val: 10, label: '10m' },
                    { val: 15, label: '15m' },
                    { val: 30, label: '30m' },
                    { val: 60, label: '60m' },
                  ].map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTimerMinutes(t.val)}
                      className={`py-1.5 text-xs font-mono font-medium rounded-md border text-center transition-colors ${
                        timerMinutes === t.val
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                          : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-colors ${
                  isLoading
                    ? 'bg-[#64748B] cursor-wait'
                    : 'bg-[#1E3A8A] hover:bg-[#172554] active:bg-[#0F172A]'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Quiz</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Saved Quizzes */}
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1E3A8A]" />
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Saved Quizzes
                </h3>
              </div>
              <span className="font-mono text-xs text-[#64748B]">
                {savedQuizzes.length}
              </span>
            </div>

            {savedQuizzes.length === 0 ? (
              <p className="text-xs text-[#64748B] py-3 text-center">
                No saved quizzes yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedQuizzes.map((quiz) => (
                  <div
                    key={quiz.metadata.id}
                    className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md flex items-center justify-between gap-2 hover:bg-[#F1F5F9] transition-colors"
                  >
                    <div className="overflow-hidden">
                      <div className="font-semibold text-xs text-[#0F172A] truncate">
                        {quiz.metadata.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B] flex items-center gap-2 mt-0.5">
                        <span>{quiz.questions.length} Qs</span>
                        <span>•</span>
                        <span>{new Date(quiz.metadata.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onQuizReady(quiz)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172554] rounded transition-colors"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteSavedQuiz(quiz.metadata.id);
                          refreshSavedQuizzes();
                        }}
                        className="p-1 text-[#64748B] hover:text-[#EF4444] rounded"
                        title="Delete quiz"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
