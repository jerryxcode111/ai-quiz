export type QuestionChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuizChoice {
  key: QuestionChoiceKey;
  text: string;
}

export interface QuizQuestion {
  id: string;
  scenario?: string;
  question: string;
  choices: QuizChoice[];
  correctKey: QuestionChoiceKey;
  rationale: string;
  topic: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export type QuizMode = 'practice' | 'exam';
export type QuestionStyle = 'scenario' | 'conceptual' | 'direct' | 'analytical';
export type DifficultyOption = 'all' | 'easy' | 'medium' | 'hard';

export interface QuizConfig {
  title?: string;
  questionCount: number; // 5 to 50
  choiceCount: 4 | 5;    // A-D or A-E
  difficulty: DifficultyOption;
  questionStyle: QuestionStyle;
  quizMode: QuizMode;
  timerMinutes: number | null; // null for untimed
  topicPrompt?: string;
}

export interface QuizMetadata {
  id: string;
  title: string;
  topicSummary: string;
  createdAt: string;
  questionCount: number;
  choiceCount: 4 | 5;
  defaultMode: QuizMode;
  timerMinutes: number | null;
  topics: string[];
}

export interface QuizPackage {
  metadata: QuizMetadata;
  questions: QuizQuestion[];
}

export interface QuizAttemptState {
  quizId: string;
  mode: QuizMode;
  answers: Record<string, QuestionChoiceKey>; // questionId -> selected key
  flaggedQuestionIds: string[];
  revealedRationales: Record<string, boolean>; // for practice mode or manual toggle
  startedAt: number; // timestamp ms
  timeRemainingSeconds: number | null;
  isFinished: boolean;
  finishedAt?: number;
}

export interface QuizResultSummary {
  quizId: string;
  title: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  scorePercentage: number;
  timeSpentSeconds: number;
  topicAccuracy: {
    topic: string;
    correct: number;
    total: number;
    accuracyPercentage: number;
  }[];
  missedQuestions: {
    question: QuizQuestion;
    userAnswer?: QuestionChoiceKey;
    correctAnswer: QuestionChoiceKey;
    rationale: string;
  }[];
}

export interface UserApiSettings {
  apiKey: string;
  preferredModel: string;
  hasCustomKey: boolean;
}

