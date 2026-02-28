/**
 * Lightweight DOCX text extractor using Node.js built-ins.
 *
 * DOCX files are ZIP archives containing XML. The main body text
 * lives in `word/document.xml` inside `<w:t>` tags. This extracts
 * all text content without any third-party dependencies.
 */

import { Readable } from 'stream';
import { createInflateRaw } from 'zlib';

interface ZipEntry {
  fileName: string;
  offset: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
}

/** Parse ZIP central directory to find entries */
function parseZipEntries(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];

  // Find End of Central Directory record (signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;

  while (pos < cdEnd && pos + 46 <= buf.length) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x02014b50) break;

    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const fileName = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf-8');

    entries.push({ fileName, offset: localHeaderOffset, compressedSize, uncompressedSize, compressionMethod });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/** Extract raw data for a specific entry from the ZIP */
function extractEntry(buf: Buffer, entry: ZipEntry): Buffer {
  // Local file header starts at entry.offset (signature 0x04034b50)
  const nameLen = buf.readUInt16LE(entry.offset + 26);
  const extraLen = buf.readUInt16LE(entry.offset + 28);
  const dataStart = entry.offset + 30 + nameLen + extraLen;
  return buf.subarray(dataStart, dataStart + entry.compressedSize);
}

/** Decompress a deflated buffer */
function inflate(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inflater = createInflateRaw();
    inflater.on('data', (chunk: Buffer) => chunks.push(chunk));
    inflater.on('end', () => resolve(Buffer.concat(chunks)));
    inflater.on('error', reject);
    Readable.from(data).pipe(inflater);
  });
}

/** Strip XML tags and extract text from OOXML document.xml */
function extractTextFromXml(xml: string): string {
  // Extract text from <w:t> and <w:t xml:space="preserve"> tags
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  let lastWasParagraphEnd = false;

  // Also detect paragraph boundaries for line breaks
  const tokens = xml.split(/(<\/?w:p[ >\/])/);
  let inParagraph = false;
  let paragraphText = '';

  for (const token of tokens) {
    if (token.startsWith('<w:p')) {
      inParagraph = true;
      paragraphText = '';
    } else if (token.startsWith('</w:p')) {
      if (paragraphText.trim()) {
        textParts.push(paragraphText.trim());
      }
      inParagraph = false;
    } else if (inParagraph) {
      const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let m;
      while ((m = tRegex.exec(token)) !== null) {
        paragraphText += m[1];
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Extract plain text from a DOCX file buffer.
 * Returns the extracted text, or an empty string if extraction fails.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const entries = parseZipEntries(buffer);
    const docEntry = entries.find(e => e.fileName === 'word/document.xml');
    if (!docEntry) return '';

    const rawData = extractEntry(buffer, docEntry);

    let xmlBuffer: Buffer;
    if (docEntry.compressionMethod === 8) {
      // Deflated
      xmlBuffer = await inflate(rawData);
    } else {
      // Stored (no compression)
      xmlBuffer = rawData;
    }

    const xml = xmlBuffer.toString('utf-8');
    return extractTextFromXml(xml);
  } catch (err) {
    console.error('[docx-extract] Failed to extract text from DOCX:', (err as Error).message);
    return '';
  }
}
