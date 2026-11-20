/**
 * The sheet inside its PDF: the PDF button attaches the same file Export
 * saves (lib/exchange), so Import can rebuild the character from the PDF.
 * Edits typed into the PDF's fields are not read back; the attached file is
 * the sheet as it was when the PDF was made. Loaded only when a PDF is
 * imported, as it brings the PDF library.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import { TITLE } from '#lib/exchange.ts';

/** What the attachment says it is, in a PDF reader's attachments list. */
export const BACKUP_NOTE = 'This character, for DND Companion: import this PDF from the sheet list to bring it back.';

/**
 * The sheet file attached to a PDF, or null when it has none (a PDF from
 * elsewhere, or one saved again by an app that drops attachments).
 */
export async function readPdfBackup(bytes: Uint8Array | ArrayBuffer): Promise<string | null> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return null;
  }
  const decoder = new TextDecoder();
  for (const file of doc.getAttachments()) {
    const text = decoder.decode(file.data).replace(/^﻿/, '');
    if (text.trimStart().startsWith(TITLE)) return text;
  }
  return null;
}
