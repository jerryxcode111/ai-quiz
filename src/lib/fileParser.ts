import mammoth from 'mammoth';
import { extractText } from 'unpdf';

export interface ParsedFileContent {
  fileName: string;
  fileType: string;
  textContent?: string;
  inlineImage?: {
    mimeType: string;
    data: string; // base64
  };
}

export async function parseUploadedFile(file: File): Promise<ParsedFileContent> {
  const fileName = file.name;
  const fileType = file.type || '';
  const buffer = Buffer.from(await file.arrayBuffer());

  // Handle Images (PNG, JPG, WEBP)
  if (fileType.startsWith('image/')) {
    return {
      fileName,
      fileType,
      inlineImage: {
        mimeType: fileType,
        data: buffer.toString('base64'),
      },
    };
  }

  // Handle DOCX via Mammoth
  if (
    fileName.endsWith('.docx') ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        fileName,
        fileType: 'application/docx',
        textContent: result.value || '',
      };
    } catch (err) {
      console.error(`Error parsing docx ${fileName}:`, err);
      return {
        fileName,
        fileType: 'application/docx',
        textContent: `[Error reading DOCX: ${(err as Error).message}]`,
      };
    }
  }

  // Handle PDF via unpdf
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    try {
      const pdfData = await extractText(new Uint8Array(buffer));
      const extractedText = Array.isArray(pdfData.text) ? pdfData.text.join('\n') : (pdfData.text || '');
      return {
        fileName,
        fileType: 'application/pdf',
        textContent: extractedText,
      };
    } catch (err) {
      console.error(`Error parsing PDF ${fileName}:`, err);
      return {
        fileName,
        fileType: 'application/pdf',
        textContent: `[Error reading PDF: ${(err as Error).message}]`,
      };
    }
  }

  // Handle Plain text, markdown, json, csv, code
  try {
    const text = buffer.toString('utf-8');
    return {
      fileName,
      fileType: fileType || 'text/plain',
      textContent: text,
    };
  } catch (err) {
    return {
      fileName,
      fileType: fileType || 'application/octet-stream',
      textContent: `[Unable to read text encoding]`,
    };
  }
}
