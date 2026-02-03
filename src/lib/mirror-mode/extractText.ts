export type ExtractResult =
  | { ok: true; text: string; method: "txt" | "docx" | "pdf" }
  | { ok: false; error: string };

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const mime = file.type || "";
  const name = file.name.toLowerCase();

  // TXT
  if (mime === "text/plain" || name.endsWith(".txt")) {
    const raw = await file.text();
    const text = cleanText(raw);
    if (!text) return { ok: false, error: "Empty text file." };
    return { ok: true, text, method: "txt" };
  }

  // DOCX (mammoth)
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    try {
      const mammoth = (await import("mammoth")).default || (await import("mammoth"));
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await (mammoth as any).extractRawText({ buffer: buf });
      const text = cleanText(result?.value || "");
      if (!text) return { ok: false, error: "DOCX extracted empty text." };
      return { ok: true, text, method: "docx" };
    } catch (e) {
      return {
        ok: false,
        error:
          "DOCX extraction failed. Ensure `mammoth` is installed and server runtime is nodejs.",
      };
    }
  }

  // PDF (best-effort; if pdf-parse not installed, we fail gracefully)
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const mod: any = await import("pdf-parse");
      const pdfParse = mod?.default || mod;
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await pdfParse(buf);
      const text = cleanText(result?.text || "");
      if (!text) return { ok: false, error: "PDF extracted empty text." };
      return { ok: true, text, method: "pdf" };
    } catch {
      return {
        ok: false,
        error:
          "PDF extraction not available yet. Install `pdf-parse` or switch to a pdf.js worker approach.",
      };
    }
  }

  return {
    ok: false,
    error: "Unsupported file type. Upload TXT, DOCX, or PDF.",
  };
}
