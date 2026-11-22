import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { parseUploadedFile } from '@/lib/fileParser';
import { QuizPackage, QuizQuestion, QuizChoice, QuestionChoiceKey } from '@/types/quiz';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const clientProvidedKey = req.headers.get('x-gemini-key');
    const selectedModel = req.headers.get('x-gemini-model') || 'gemini-3.5-flash-lite';
    const apiKey = (clientProvidedKey && clientProvidedKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'API key is unavailable or not configured. Please provide a Gemini API key to proceed.',
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
          compiledTextContext += `### File: ${parsed.fileName}\n${parsed.textContent}\n\n`;
        }
      }
    }

    if (!compiledTextContext.trim() && imageParts.length === 0 && !topicPrompt.trim()) {
      return NextResponse.json(
        {
          error: 'Please provide study notes, upload documents/images, or enter a topic prompt.',
        },
        { status: 400 }
      );
    }

    const allowedKeys = choiceCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    const promptText = `
You are an academic exam author.
Create an objective, rigorous multiple-choice quiz grounded in the provided source material and focus instructions.

REQUIREMENTS:
1. Generate exactly ${requestedCount} multiple choice questions.
2. Each question MUST have exactly ${choiceCount} choices labeled with keys: ${allowedKeys.join(', ')}.
3. Do NOT include letter prefixes like "A)", "B.", or "1." inside the "text" field of each choice. The text field must contain purely the option text.
4. Question Style: "${questionStyle}". If scenario-based, provide an authentic problem vignette. If analytical, test discrimination between plausible alternatives.
5. Difficulty: "${difficulty}". Distractors must be plausible and non-trivial.
6. Topic: Assign a concise topic tag (2-4 words) to each question to track performance.
7. Rationale: Provide a comprehensive rationale explaining why the correct choice is right and why key distractors are incorrect.
8. Grounding: Rely strictly on facts from the provided materials or topic.

Focus Topic: ${topicPrompt || 'Core concepts from provided materials'}

${compiledTextContext ? `Source Content:\n${compiledTextContext.slice(0, 80000)}` : 'Create questions based directly on the focus topic.'}
`;

    const ai = new GoogleGenAI({ apiKey });

    const quizResponseSchema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Title for this quiz',
        },
        topicSummary: {
          type: Type.STRING,
          description: '1-sentence summary of the subject matter',
        },
        topicsList: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of unique subtopics covered',
        },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scenario: {
                type: Type.STRING,
                description: 'Optional clinical or case vignette',
              },
              question: {
                type: Type.STRING,
                description: 'The primary question prompt',
              },
              choices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: {
                      type: Type.STRING,
                      description: 'Letter key: A, B, C, D, or E',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'The option text without any letter prefix',
                    },
                  },
                  required: ['key', 'text'],
                },
              },
              correctKey: {
                type: Type.STRING,
                description: 'The correct choice key (A, B, C, D, or E)',
              },
              rationale: {
                type: Type.STRING,
                description: 'Explanation for correct and incorrect options',
              },
              topic: {
                type: Type.STRING,
                description: 'Specific subtopic for this question',
              },
              difficulty: {
                type: Type.STRING,
                description: 'easy, medium, or hard',
              },
            },
            required: ['question', 'choices', 'correctKey', 'rationale', 'topic'],
          },
        },
      },
      required: ['title', 'topicSummary', 'topicsList', 'questions'],
    };

    const contents: any[] = [];
    if (imageParts.length > 0) {
      contents.push(...imageParts);
    }
    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizResponseSchema,
        temperature: 0.2,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response received from generation model.');
    }

    const rawParsed = JSON.parse(responseText);

    const quizId = 'quiz_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const questions: QuizQuestion[] = (rawParsed.questions || []).map((q: any, idx: number) => {
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
        title: rawParsed.title || (topicPrompt ? `Quiz: ${topicPrompt}` : 'Study Quiz'),
        topicSummary: rawParsed.topicSummary || `${questions.length} questions generated`,
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
      msg.includes('429') ||
      msg.includes('403') ||
      msg.includes('401') ||
      msg.includes('API_KEY') ||
      msg.includes('UNAUTHENTICATED') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('credits');

    return NextResponse.json(
      {
        error: isQuotaOrAuth
          ? 'API service limit reached or key is unavailable. Please provide a backup Gemini API key to continue.'
          : (msg || 'Failed to generate quiz. Please try again with shorter content or fewer questions.'),
        apiError: isQuotaOrAuth,
      },
      { status: isQuotaOrAuth ? 429 : 500 }
    );
  }
}
