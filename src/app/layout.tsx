import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Quiz Studio | Clean Academic Exam & Study Platform',
  description:
    'Distraction-free, zero-gradient academic quiz generator and exam simulator powered by Gemini AI. Multi-file uploads, real-time rationales, and offline portability.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full bg-[#F8FAFC] text-[#0F172A] antialiased flex flex-col font-sans selection:bg-[#EFF6FF] selection:text-[#1E3A8A]">
        {children}
      </body>
    </html>
  );
}
