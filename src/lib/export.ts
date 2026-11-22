import { QuizPackage } from '@/types/quiz';

/**
 * Generates an academic Markdown study sheet from a QuizPackage.
 */
export function exportStudySheetMarkdown(quiz: QuizPackage): string {
  const { metadata, questions } = quiz;

  let md = `# Study Sheet: ${metadata.title}\n\n`;
  md += `> **Created:** ${new Date(metadata.createdAt).toLocaleDateString()} | **Questions:** ${questions.length} | **Topics:** ${metadata.topics.join(', ')}\n\n`;
  md += `---\n\n`;

  questions.forEach((q, idx) => {
    md += `### Question ${idx + 1} [${q.topic}]\n`;
    if (q.scenario) {
      md += `*Scenario:*\n> ${q.scenario}\n\n`;
    }
    md += `${q.question}\n\n`;

    q.choices.forEach((c) => {
      const isCorrect = c.key === q.correctKey;
      md += `- **[${c.key}]** ${c.text} ${isCorrect ? '*(Correct Answer)*' : ''}\n`;
    });

    md += `\n**Key Rationale:**\n> ${q.rationale}\n\n`;
    md += `---\n\n`;
  });

  return md;
}

/**
 * Generates a self-contained offline HTML quiz with embedded styles and interactive JS.
 */
export function exportOfflineHtmlQuiz(quiz: QuizPackage): string {
  const safeData = JSON.stringify(quiz).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(quiz.metadata.title)} - Offline Quiz</title>
  <style>
    :root {
      --bg: #F8FAFC;
      --card: #FFFFFF;
      --border: #CBD5E1;
      --text: #0F172A;
      --text-muted: #475569;
      --accent: #1E3A8A;
      --accent-hover: #172554;
      --accent-tint: #EFF6FF;
      --correct-bg: #ECFDF5;
      --correct-border: #10B981;
      --correct-text: #065F46;
      --wrong-bg: #FEF2F2;
      --wrong-border: #EF4444;
      --wrong-text: #991B1B;
      --mono: 'JetBrains Mono', monospace, Consolas;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 860px; margin: 0 auto; }
    .header {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 1.25rem; font-weight: 700; color: var(--text); }
    .header p { font-size: 0.875rem; color: var(--text-muted); }
    .score-badge {
      font-family: var(--mono);
      font-size: 1rem;
      font-weight: 700;
      background: var(--accent-tint);
      color: var(--accent);
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #BFDBFE;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .q-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .tag {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      background: #F1F5F9;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #E2E8F0;
      font-family: var(--mono);
    }
    .scenario {
      font-size: 0.95rem;
      color: var(--text-muted);
      border-left: 3px solid #94A3B8;
      padding-left: 12px;
      margin-bottom: 14px;
      font-style: italic;
    }
    .question-text {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 18px;
      color: var(--text);
    }
    .choice-btn {
      width: 100%;
      text-align: left;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 10px;
      cursor: pointer;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.15s ease;
    }
    .choice-btn:hover { background: #F8FAFC; border-color: #94A3B8; }
    .choice-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      font-family: var(--mono);
      font-weight: 700;
      font-size: 0.85rem;
    }
    .choice-btn.selected-correct {
      background: var(--correct-bg);
      border-color: var(--correct-border);
      color: var(--correct-text);
    }
    .choice-btn.selected-correct .choice-key {
      background: #A7F3D0;
      border-color: var(--correct-border);
      color: var(--correct-text);
    }
    .choice-btn.selected-wrong {
      background: var(--wrong-bg);
      border-color: var(--wrong-border);
      color: var(--wrong-text);
    }
    .choice-btn.selected-wrong .choice-key {
      background: #FECACA;
      border-color: var(--wrong-border);
      color: var(--wrong-text);
    }
    .rationale {
      margin-top: 14px;
      padding: 14px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #334155;
      display: none;
    }
    .rationale.visible { display: block; }
    .footer-bar {
      margin-top: 24px;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--mono);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 id="quiz-title"></h1>
        <p id="quiz-meta"></p>
      </div>
      <div class="score-badge" id="score-display">0 / 0 (0%)</div>
    </div>
    <div id="questions-list"></div>
    <div class="footer-bar">
      AI Quiz Studio • Offline Study Pack
    </div>
  </div>

  <script>
    const data = ${safeData};
    const answers = {};

    document.getElementById('quiz-title').innerText = data.metadata.title;
    document.getElementById('quiz-meta').innerText = 'Questions: ' + data.questions.length + ' • ' + data.metadata.topics.join(', ');

    const container = document.getElementById('questions-list');

    function updateScore() {
      let correct = 0;
      const total = data.questions.length;
      data.questions.forEach((q, i) => {
        if (answers[q.id] === q.correctKey) correct++;
      });
      const answered = Object.keys(answers).length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      document.getElementById('score-display').innerText = correct + ' / ' + total + ' (' + pct + '%)';
    }

    data.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'card';

      const meta = document.createElement('div');
      meta.className = 'q-meta';
      meta.innerHTML = '<span class="tag">#' + (idx + 1) + '</span><span class="tag">' + (q.topic || 'General') + '</span>';
      card.appendChild(meta);

      if (q.scenario) {
        const scn = document.createElement('div');
        scn.className = 'scenario';
        scn.innerText = q.scenario;
        card.appendChild(scn);
      }

      const qText = document.createElement('div');
      qText.className = 'question-text';
      qText.innerText = q.question;
      card.appendChild(qText);

      const optionsDiv = document.createElement('div');

      const rat = document.createElement('div');
      rat.className = 'rationale';
      rat.innerHTML = '<strong>Rationale:</strong> ' + q.rationale;

      q.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = '<span class="choice-key">' + c.key + '</span><span>' + c.text + '</span>';
        btn.onclick = () => {
          if (answers[q.id]) return; // locked once answered
          answers[q.id] = c.key;
          
          if (c.key === q.correctKey) {
            btn.classList.add('selected-correct');
          } else {
            btn.classList.add('selected-wrong');
            // highlight the correct one
            Array.from(optionsDiv.children).forEach(otherBtn => {
              const k = otherBtn.querySelector('.choice-key').innerText;
              if (k === q.correctKey) otherBtn.classList.add('selected-correct');
            });
          }
          rat.classList.add('visible');
          updateScore();
        };
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      card.appendChild(rat);
      container.appendChild(card);
    });

    updateScore();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Downloads a string content as a client-side file.
 */
export function downloadFile(content: string, fileName: string, contentType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

