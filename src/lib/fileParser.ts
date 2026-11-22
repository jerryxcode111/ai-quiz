import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import JSZip from 'jszip';

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

  // 1. Handle Images (PNG, JPG, WEBP)
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

  // 2. Handle PPTX / PPT PowerPoint Presentations
  if (
    fileName.endsWith('.pptx') ||
    fileName.endsWith('.ppt') ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileType === 'application/vnd.ms-powerpoint'
  ) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      );

      // Sort slides numerically: slide1.xml, slide2.xml ...
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
        return numA - numB;
      });

      let extractedPptText = '';
      for (let i = 0; i < slideFiles.length; i++) {
        const slideEntry = zip.file(slideFiles[i]);
        if (slideEntry) {
          const xml = await slideEntry.async('text');
          // In OpenXML PowerPoint, slide text is enclosed within <a:t>...</a:t>
          const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
          const slideText = matches
            .map((m) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ');

          if (slideText) {
            extractedPptText += `--- Slide ${i + 1} ---\n${slideText}\n\n`;
          }
        }
      }

      if (extractedPptText.trim().length > 0) {
        return {
          fileName,
          fileType: 'application/pptx',
          textContent: extractedPptText,
        };
      }
    } catch (err) {
      console.warn(`Attempting fallback parse for presentation ${fileName}:`, err);
    }
  }

  // 3. Handle DOCX via Mammoth
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

  // 4. Handle PDF via unpdf
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    try {
      const pdfData = await extractText(new Uint8Array(buffer));
      const extractedText = Array.isArray(pdfData.text)
        ? pdfData.text.join('\n')
        : pdfData.text || '';
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

  // 5. Handle Plain text, Markdown, JSON, CSV, code
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
      textContent: `[Unable to read file content]`,
    };
  }
}
