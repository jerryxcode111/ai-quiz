import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI, Type } from '@google/genai';
import { parseUploadedFile } from '@/lib/fileParser';
import { QuizPackage, QuizQuestion, QuizChoice, QuestionChoiceKey } from '@/types/quiz';

export const maxDuration = 60;

// --- Helpers ---

/** Build the system prompt for JSON quiz generation */
function buildSystemPrompt(): string {
  return `You are an academic exam generator. Return ONLY a valid JSON object matching this schema:
{
  "title": "string",
  "topicSummary": "string",
  "topicsList": ["string"],
  "questions": [
    {
      "scenario": "string (optional case study / vignette, or empty string)",
      "question": "string",
      "choices": [
        {"key": "A", "text": "string"},
        {"key": "B", "text": "string"}
      ],
      "correctKey": "A",
      "rationale": "string",
      "topic": "string",
      "difficulty": "easy | medium | hard"
    }
  ]
}
Return ONLY the JSON. No markdown fences, no commentary.`;
}

/** Build the user prompt for a batch of questions */
function buildUserPrompt(opts: {
  batchCount: number;
  totalCount: number;
  batchIndex: number;
  choiceCount: number;
  allowedKeys: string[];
  difficulty: string;
  questionStyle: string;
  topicPrompt: string;
  compiledTextContext: string;
  maxContentChars: number;
}): string {
  const batchLabel =
    opts.totalCount > opts.batchCount
      ? `Generate batch ${opts.batchIndex + 1}: exactly ${opts.batchCount} questions (questions ${opts.batchIndex * opts.batchCount + 1}-${(opts.batchIndex + 1) * opts.batchCount} of ${opts.totalCount} total).`
      : `Generate exactly ${opts.batchCount} multiple choice questions.`;

  return `
You are an expert psychometrician and university examination author.
Create an objective, rigorous multiple-choice quiz strictly grounded in the provided source material and focus instructions.

STRICT PSYCHOMETRIC RULES (NON-NEGOTIABLE):
1. OPTION LENGTH & DETAIL PARITY (CRITICAL ANTI-GIVEAWAY RULE):
   - All choices for any single question MUST be of approximately EQUAL LENGTH, word count, and level of detail.
   - NEVER make the correct answer significantly longer, more elaborate, or more specifically qualified than the distractors ("length cue bias").
   - If the correct answer is 12 words, all distractors must also be roughly 10-14 words with identical grammatical syntax.
   - DO NOT pad the correct answer with extra qualifiers, specifics, or technical terms that the distractors lack.
2. DISTRACTOR QUALITY:
   - Distractors must be authentic, plausible, and represent common academic misconceptions or closely related technical concepts.
   - NEVER write lazy, obviously false, or joke options.
   - NEVER use "All of the above", "None of the above", or "Both A and C".
   - Avoid giveaway absolutes ("always", "never", "in all cases") in distractors if the correct choice uses hedged language.
   - DO NOT make one option stand out by being more detailed, more precise, or more "textbook-like" than the others.
3. FORMATTING:
   - ${batchLabel}
   - Each question MUST have exactly ${opts.choiceCount} choices labeled with keys: ${opts.allowedKeys.join(', ')}.
   - Under NO circumstances include letter prefixes like "A)", "B.", or "1." inside the choice "text" string.
   - Distribute correct keys (${opts.allowedKeys.join(', ')}) randomly and roughly evenly across questions.
4. Question Style: "${opts.questionStyle}". If scenario-based, provide an authentic problem vignette.
5. Difficulty: "${opts.difficulty}".
6. Topic: Assign a concise subtopic tag (2-4 words) to each question.
7. Rationale: Provide a comprehensive rationale explaining why the correct choice is right and why key distractors are incorrect.
8. Grounding: Rely strictly on facts from the provided materials or topic.
9. ANTI-GIVEAWAY VERIFICATION (MUST DO BEFORE FINALIZING):
   - For each question, verify that if you hid the correctKey, a test-taking strategist could NOT identify the answer just by picking the longest or most detailed option.
   - If any option is noticeably longer/more specific than the others, REWRITE ALL options to be equal length.

Focus Topic: ${opts.topicPrompt || 'Core concepts from provided materials'}

${opts.compiledTextContext ? `Source Content:\n${opts.compiledTextContext.slice(0, opts.maxContentChars)}` : 'Create questions based directly on the focus topic.'}
`;
}

/** Try to salvage partial JSON when the response gets truncated */
function salvagePartialJson(raw: string): any | null {
  // 1. Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {}

  // 2. Strip markdown code fences if present
  let cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3. Try to find and close the last complete question object
  const lastCompleteQ = cleaned.lastIndexOf('"difficulty"');
  if (lastCompleteQ === -1) return null;

  // Find the closing brace of that question object
  let braceDepth = 0;
  let cutoff = -1;
  for (let i = lastCompleteQ; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceDepth++;
    if (cleaned[i] === '}') {
      braceDepth--;
      if (braceDepth <= -1) {
        cutoff = i + 1;
        break;
      }
    }
  }

  if (cutoff === -1) {
    // Try to find the last complete } before truncation
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) cutoff = lastBrace + 1;
    else return null;
  }

  // Close the array and object
  const truncated = cleaned.slice(0, cutoff) + ']}';
  try {
    return JSON.parse(truncated);
  } catch {}

  // 4. More aggressive: find all complete question objects
  const questionPattern = /\{[^{}]*"question"\s*:\s*"[^"]*"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const matches = cleaned.match(questionPattern);
  if (matches && matches.length > 0) {
    // Try to build a minimal valid object
    const titleMatch = cleaned.match(/"title"\s*:\s*"([^"]*)"/);
    const title = titleMatch ? titleMatch[1] : 'Generated Quiz';
    try {
      return {
        title,
        topicSummary: 'Auto-recovered quiz',
        topicsList: [],
        questions: matches.map((m) => JSON.parse(m)),
      };
    } catch {}
  }

  return null;
}

/** Call Groq for a single batch */
async function callGroqBatch(
  groq: Groq,
  systemPrompt: string,
  userPrompt: string,
  candidateModels: string[]
): Promise<any | null> {
  for (const m of candidateModels) {
    try {
      const completion = await groq.chat.completions.create({
        model: m,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 32768,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      // Try strict parse, then salvage
      const parsed = salvagePartialJson(content);
      if (parsed && parsed.questions && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (err: any) {
      console.warn(`Groq model ${m} failed:`, err?.message);
      // If it's a rate limit or auth error, throw to let outer handler catch it
      if (err?.status === 429 || err?.status === 401 || err?.status === 403) {
        throw err;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const clientProvidedKey = req.headers.get('x-gemini-key');
    const selectedModel = req.headers.get('x-gemini-model');

    const groqKey =
      (clientProvidedKey && clientProvidedKey.startsWith('gsk_') ? clientProvidedKey : null) ||
      process.env.GROQ_API_KEY;

    const geminiKey =
      (clientProvidedKey && !clientProvidedKey.startsWith('gsk_') ? clientProvidedKey : null) ||
      process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return NextResponse.json(
        {
          error: 'No API key configured. Please set GROQ_API_KEY or GEMINI_API_KEY in Vercel environment variables.',
          apiError: true,
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const pastedNotes = (formData.get('pastedNotes') as string) || '';
    const topicPrompt = (formData.get('topicPrompt') as string) || '';

    const requestedCount = Math.min(
      50,
      Math.max(5, parseInt((formData.get('questionCount') as string) || '10', 10))
    );
    const choiceCount = parseInt((formData.get('choiceCount') as string) || '4', 10) === 5 ? 5 : 4;
    const difficulty = (formData.get('difficulty') as string) || 'all';
    const questionStyle = (formData.get('questionStyle') as string) || 'scenario';
    const quizMode = ((formData.get('quizMode') as string) || 'practice') as 'practice' | 'exam';
    const timerRaw = formData.get('timerMinutes');
    const timerMinutes = timerRaw && timerRaw !== 'null' ? parseInt(timerRaw as string, 10) : null;

    let compiledTextContext = '';
    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];

    if (pastedNotes.trim()) {
      compiledTextContext += `### Notes:\n${pastedNotes.trim()}\n\n`;
    }

    for (const file of files) {
      if (file && typeof file.arrayBuffer === 'function') {
        const parsed = await parseUploadedFile(file);
        if (parsed.inlineImage) {
          imageParts.push({
            inlineData: {
              mimeType: parsed.inlineImage.mimeType,
              data: parsed.inlineImage.data,
            },
          });
        } else if (parsed.textContent) {
          compiledTextContext += `### File (${parsed.fileName}):\n${parsed.textContent}\n\n`;
        }
      }
    }

    if (!compiledTextContext.trim() && imageParts.length === 0 && !topicPrompt.trim()) {
      return NextResponse.json(
        {
          error: 'Please provide study notes, upload documents/images, or enter a focus topic.',
        },
        { status: 400 }
      );
    }

    const allowedKeys = choiceCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    // Determine batching: split large requests into smaller chunks
    const BATCH_SIZE = 15; // Safe size that won't exceed output token limits
    const batches: number[] = [];
    let remaining = requestedCount;
    while (remaining > 0) {
      const batchCount = Math.min(remaining, BATCH_SIZE);
      batches.push(batchCount);
      remaining -= batchCount;
    }

    let allQuestions: any[] = [];
    let quizTitle = '';
    let quizTopicSummary = '';
    let quizTopicsList: string[] = [];

    const systemPrompt = buildSystemPrompt();

    // --- Provider Execution: Groq (primary, with batching & auto-fallback) ---
    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
      const candidateModels = [
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
      ];

      // Content limit for Groq: smaller to leave room for output tokens
      const groqContentLimit = 40000;

      let groqSucceeded = true;

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchCount = batches[batchIdx];
        const userPrompt = buildUserPrompt({
          batchCount,
          totalCount: requestedCount,
          batchIndex: batchIdx,
          choiceCount,
          allowedKeys,
          difficulty,
          questionStyle,
          topicPrompt,
          compiledTextContext,
          maxContentChars: groqContentLimit,
        });

        try {
          const result = await callGroqBatch(groq, systemPrompt, userPrompt, candidateModels);
          if (result && result.questions && result.questions.length > 0) {
            allQuestions.push(...result.questions);
            if (batchIdx === 0) {
              quizTitle = result.title || '';
              quizTopicSummary = result.topicSummary || '';
              quizTopicsList = result.topicsList || [];
            }
          } else {
            groqSucceeded = false;
            break;
          }
        } catch (err: any) {
          groqSucceeded = false;
          console.warn(`Groq batch ${batchIdx + 1} failed:`, err?.message);
          break;
        }
      }

      if (!groqSucceeded) {
        allQuestions = []; // Reset so Gemini fallback can try
      }
    }

    // --- Provider Execution: Gemini (Fallback if Groq not set or failed) ---
    if (allQuestions.length === 0 && geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiCandidates = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];

      const quizResponseSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          topicSummary: { type: Type.STRING },
          topicsList: { type: Type.ARRAY, items: { type: Type.STRING } },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scenario: { type: Type.STRING },
                question: { type: Type.STRING },
                choices: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
                    required: ['key', 'text'],
                  },
                },
                correctKey: { type: Type.STRING },
                rationale: { type: Type.STRING },
                topic: { type: Type.STRING },
                difficulty: { type: Type.STRING },
              },
              required: ['question', 'choices', 'correctKey', 'rationale', 'topic'],
            },
          },
        },
        required: ['title', 'topicSummary', 'topicsList', 'questions'],
      };

      // Gemini handles larger contexts better, so use a higher limit
      const geminiContentLimit = 80000;

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchCount = batches[batchIdx];
        const userPrompt = buildUserPrompt({
          batchCount,
          totalCount: requestedCount,
          batchIndex: batchIdx,
          choiceCount,
          allowedKeys,
          difficulty,
          questionStyle,
          topicPrompt,
          compiledTextContext,
          maxContentChars: geminiContentLimit,
        });

        let batchDone = false;
        for (const modelName of geminiCandidates) {
          try {
            const contents: any[] = [];
            if (imageParts.length > 0) {
              contents.push(...imageParts);
            }
            contents.push({ text: userPrompt });

            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                responseMimeType: 'application/json',
                responseSchema: quizResponseSchema,
                temperature: 0.2,
              },
            });

            const responseText = response.text;
            if (responseText) {
              const parsed = salvagePartialJson(responseText);
              if (parsed && parsed.questions && parsed.questions.length > 0) {
                allQuestions.push(...parsed.questions);
                if (batchIdx === 0) {
                  quizTitle = parsed.title || '';
                  quizTopicSummary = parsed.topicSummary || '';
                  quizTopicsList = parsed.topicsList || [];
                }
                batchDone = true;
                break;
              }
            }
          } catch (geminiErr: any) {
            console.warn(`Gemini model ${modelName} failed:`, geminiErr?.message);
          }
        }
        if (!batchDone) break;
      }
    }

    if (allQuestions.length === 0) {
      throw new Error('Could not generate quiz questions. Please try with fewer questions or shorter text.');
    }

    const quizId = 'quiz_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const questions: QuizQuestion[] = allQuestions.map((q: any, idx: number) => {
      const choices: QuizChoice[] = (q.choices || []).slice(0, choiceCount).map((c: any, cIdx: number) => {
        const key = (allowedKeys[cIdx] || c.key || 'A') as QuestionChoiceKey;
        let cleanText = String(c.text || '').trim();
        cleanText = cleanText.replace(/^[A-Ea-e][\)\.\:\-]\s*/, '').trim();
        return { key, text: cleanText };
      });

      let correctKey = String(q.correctKey || 'A').toUpperCase().trim() as QuestionChoiceKey;
      if (!allowedKeys.includes(correctKey)) {
        correctKey = 'A';
      }

      return {
        id: `q_${quizId}_${idx + 1}`,
        scenario: q.scenario && q.scenario.trim().length > 0 ? q.scenario.trim() : undefined,
        question: String(q.question || `Question ${idx + 1}`).trim(),
        choices,
        correctKey,
        rationale: String(q.rationale || 'No explanation provided.').trim(),
        topic: String(q.topic || 'General').trim(),
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      };
    });

    const uniqueTopics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)));
    if (uniqueTopics.length === 0) uniqueTopics.push('General');

    const quizPackage: QuizPackage = {
      metadata: {
        id: quizId,
        title: quizTitle || (topicPrompt ? `Quiz: ${topicPrompt}` : 'Study Quiz'),
        topicSummary: quizTopicSummary || `${questions.length} questions generated`,
        createdAt: new Date().toISOString(),
        questionCount: questions.length,
        choiceCount,
        defaultMode: quizMode,
        timerMinutes,
        topics: uniqueTopics,
      },
      questions,
    };

    return NextResponse.json(quizPackage);
  } catch (error: any) {
    console.error('Quiz Generation API Error:', error);
    const msg = error.message || '';
    const isQuotaOrAuth =
      msg.includes('quota') ||
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('403') ||
      msg.includes('401') ||
      msg.includes('API_KEY') ||
      msg.includes('UNAUTHENTICATED') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('high demand') ||
      msg.includes('credits');

    return NextResponse.json(
      {
        error: isQuotaOrAuth
          ? 'AI service rate limit reached or high demand. Please provide an alternate Groq or Gemini API key to continue.'
          : (msg || 'Failed to generate quiz. Please try again with shorter content or fewer questions.'),
        apiError: isQuotaOrAuth,
      },
      { status: isQuotaOrAuth ? 429 : 500 }
    );
  }
}
