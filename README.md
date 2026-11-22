# AI Quiz Studio

A distraction-free, academic exam generator and study platform powered by Gemini AI.

## Features

- **Academic Zero-Gradient UI**: Clean slate design (`#F8FAFC`, `#FFFFFF`, `#1E3A8A`) optimized for prolonged study without eye fatigue.
- **Secure Gemini Integration**:
  - Server-side `GEMINI_API_KEY` for zero-exposure Vercel deployment.
  - Optional browser `localStorage` client key for user-provided access.
- **Multi-Source Generation (`/api/generate`)**:
  - Ingests PDF, DOCX (via `mammoth`), TXT, Markdown, CSV, and diagram images.
  - Accepts raw pasted lecture notes and focus prompts.
  - Generates balanced scenario/analytical questions with clean options (no embedded letter prefixes) and structured rationales.
- **Practice vs. Exam Modes**:
  - *Practice Mode*: Immediate feedback, score updates, and rationale reveals.
  - *Exam Mode*: Timed countdown with hidden answers until submission.
- **Study Workflow & Portability**:
  - Topic filters, question flags, and keyboard navigation (`A–E`, `← / →`, `F`).
  - Standalone Offline HTML Quiz export (`.html`) with embedded interactive script.
  - Academic Markdown Study Sheet export (`.md`).
  - Missed Questions Review & "Retry Missed Only" instant quiz generation.

## Getting Started

1. Clone or copy project repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your Gemini API Key in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Run development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploying to Vercel

1. Push this repository to GitHub or GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. In Project Settings > **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Click **Deploy**.
