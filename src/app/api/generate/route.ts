import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI, Type } from '@google/genai';
import { parseUploadedFile } from '@/lib/fileParser';
import { QuizPackage, QuizQuestion, QuizChoice, QuestionChoiceKey } from '@/types/quiz';

export const maxDuration = 60;

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

    const promptText = `
You are an expert psychometrician and university examination author.
Create an objective, rigorous multiple-choice quiz strictly grounded in the provided source material and focus instructions.

STRICT PSYCHOMETRIC RULES (NON-NEGOTIABLE):
1. OPTION LENGTH & DETAIL PARITY (CRITICAL ANTI-GIVEAWAY RULE):
   - All choices (A, B, C, D, E) for any single question MUST be of approximately EQUAL LENGTH, word count, and level of detail.
   - NEVER make the correct answer significantly longer, more elaborate, or more specifically qualified than the distractors ("length cue bias").
   - If the correct answer is 12 words, all distractors must also be roughly 10-14 words with identical grammatical syntax.
2. DISTRACTOR QUALITY:
   - Distractors must be authentic, plausible, and represent common academic misconceptions or closely related technical concepts.
   - NEVER write lazy, obviously false, or joke options.
   - NEVER use "All of the above", "None of the above", or "Both A and C".
   - Avoid giveaway absolutes ("always", "never", "in all cases") in distractors if the correct choice uses hedged language ("usually", "predominantly").
3. FORMATTING:
   - Generate exactly ${requestedCount} multiple choice questions.
   - Each question MUST have exactly ${choiceCount} choices labeled with keys: ${allowedKeys.join(', ')}.
   - Under NO circumstances include letter prefixes like "A)", "B.", or "1." inside the choice "text" string. The "text" field must contain purely the option statement.
   - Distribute correct keys (A, B, C, D${choiceCount === 5 ? ', E' : ''}) randomly and evenly across questions.
4. Question Style: "${questionStyle}". If scenario-based, provide an authentic problem vignette. If analytical, test discrimination between plausible alternatives.
5. Difficulty: "${difficulty}".
6. Topic: Assign a concise subtopic tag (2-4 words) to each question to track performance.
7. Rationale: Provide a comprehensive rationale explaining why the correct choice is right and why key distractors are incorrect.
8. Grounding: Rely strictly on facts from the provided materials or topic.

Focus Topic: ${topicPrompt || 'Core concepts from provided materials'}

${compiledTextContext ? `Source Content:\n${compiledTextContext.slice(0, 90000)}` : 'Create questions based directly on the focus topic.'}
`;

    let rawParsed: any = null;

    // --- Provider Execution: Groq (Primary if key exists) ---
    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an academic exam generator. Return ONLY a valid JSON object matching this schema:
{
  "title": "string",
  "topicSummary": "string",
  "topicsList": ["string"],
  "questions": [
    {
      "scenario": "string (optional case study / vignette, or empty)",
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
}`,
          },
          {
            role: 'user',
            content: promptText,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned empty output.');
      }
      rawParsed = JSON.parse(content);
    } else if (geminiKey) {
      // --- Provider Execution: Gemini ---
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const modelName = selectedModel || 'gemini-3.5-flash-lite';

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

      const contents: any[] = [];
      if (imageParts.length > 0) {
        contents.push(...imageParts);
      }
      contents.push({ text: promptText });

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
      if (!responseText) {
        throw new Error('Empty response received from generation model.');
      }
      rawParsed = JSON.parse(responseText);
    }

    if (!rawParsed || !rawParsed.questions) {
      throw new Error('Could not parse generated quiz questions.');
    }

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
