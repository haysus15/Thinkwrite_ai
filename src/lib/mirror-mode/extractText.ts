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

function decodePdfLiteral(input: string): string {
  return input
    .replace(/\\([nrtbf()\\])/g, (_m, ch) => {
      switch (ch) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "(":
          return "(";
        case ")":
          return ")";
        case "\\":
          return "\\";
        default:
          return ch;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_m, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}

function extractTextOperators(content: string): string[] {
  const out: string[] = [];

  // ( ... ) Tj
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  for (const match of content.matchAll(tj)) {
    const literal = match[0].replace(/\)\s*Tj$/, "");
    out.push(decodePdfLiteral(literal.slice(1)));
  }

  // [ (...) ... ] TJ
  const tjArray = /\[(.*?)\]\s*TJ/gs;
  for (const block of content.matchAll(tjArray)) {
    const inner = block[1] || "";
    const literals = inner.match(/\((?:\\.|[^\\)])*\)/g) || [];
    if (!literals.length) continue;
    out.push(
      literals
        .map((literal) => decodePdfLiteral(literal.slice(1, -1)))
        .join("")
    );
  }

  return out;
}

async function extractPdfTextFallback(buffer: Buffer): Promise<string> {
  const { inflateSync, inflateRawSync } = await import("node:zlib");
  const binary = buffer.toString("latin1");
  const pieces: string[] = [];

  // Also try direct operator extraction from the full file in case streams are not compressed.
  pieces.push(...extractTextOperators(binary));

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of binary.matchAll(streamRegex)) {
    const raw = match[1];
    if (!raw) continue;
    const rawBuf = Buffer.from(raw, "latin1");

    const decodedCandidates: string[] = [raw];
    try {
      decodedCandidates.push(inflateSync(rawBuf).toString("latin1"));
    } catch {
      // Not inflate/flate stream
    }
    try {
      decodedCandidates.push(inflateRawSync(rawBuf).toString("latin1"));
    } catch {
      // Not raw inflate stream
    }

    for (const candidate of decodedCandidates) {
      pieces.push(...extractTextOperators(candidate));
    }
  }

  let text = cleanText(pieces.join("\n"));
  if (text) return text;

  // Absolute fallback: salvage visible strings from raw bytes.
  // This is noisy but avoids hard-failing uploads when parser libs are unavailable.
  const raw = buffer.toString("latin1");
  const asciiChunks = raw.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()'"%$#@!?\-_/\\]{3,}/g) || [];
  const seen = new Set<string>();
  const filtered = asciiChunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      if (!chunk) return false;
      const lower = chunk.toLowerCase();
      if (
        /^obj$|^endobj$|^stream$|^endstream$|^xref$|^trailer$|^catalog$|^pages?$|^font$/i.test(chunk)
      ) {
        return false;
      }
      if (
        /\/type|\/filter|\/length|\/font|\/page|endobj|endstream|xref|startxref|obj\b|<<|>>/i.test(lower)
      ) {
        return false;
      }
      const wordCount = (chunk.match(/[A-Za-z]{2,}/g) || []).length;
      if (wordCount < 3) return false;
      const letters = (chunk.match(/[A-Za-z]/g) || []).length;
      const printable = (chunk.match(/[A-Za-z0-9 ,.;:()'"%$#@!?\-_/\\]/g) || []).length;
      if (printable === 0) return false;
      if (letters / printable < 0.45) return false;
      if (chunk.length > 250) return false;
      if (seen.has(chunk)) return false;
      seen.add(chunk);
      return true;
    })
    .slice(0, 5000);
  text = cleanText(filtered.join("\n"));
  return text;
}

async function getNodeRequire():
  Promise<((id: string) => any) | null> {
  try {
    // Prefer native require when available in server runtime.
    // eslint-disable-next-line no-new-func
    const req = Function("return require")();
    if (typeof req === "function") {
      return req;
    }
  } catch {
    // Not in a CJS-capable context
  }

  try {
    const nodeModule: any = await import("node:module");
    if (typeof nodeModule?.createRequire === "function") {
      return nodeModule.createRequire(import.meta.url);
    }
  } catch {
    // Not in a node runtime with node:module support
  }
  return null;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const errors: string[] = [];

  try {
    const require = await getNodeRequire();
    if (!require) {
      throw new Error("require unavailable");
    }
    let mod: any;
    try {
      mod = require("pdf-parse/dist/pdf-parse/cjs/index.cjs");
    } catch {
      mod = require("pdf-parse");
    }

    // Legacy api: pdfParse(buffer) -> { text }
    const legacyParser =
      typeof mod === "function"
        ? mod
        : typeof mod?.default === "function"
        ? mod.default
        : null;
    if (legacyParser) {
      const result = await legacyParser(buffer);
      return cleanText(result?.text || "");
    }

    // Current api: new PDFParse({ data }).getText()
    const PDFParseCtor = mod?.PDFParse || mod?.default?.PDFParse;
    if (PDFParseCtor) {
      const parser = new PDFParseCtor({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return cleanText(result?.text || "");
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    }

    errors.push("Unsupported pdf-parse API shape");
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `pdf-parse require failed: ${error.message}`
        : "pdf-parse require failed"
    );
    try {
      const mod: any = await import("pdf-parse");

      // Legacy api: pdfParse(buffer) -> { text }
      const legacyParser =
        typeof mod === "function"
          ? mod
          : typeof mod?.default === "function"
          ? mod.default
          : null;
      if (legacyParser) {
        const result = await legacyParser(buffer);
        return cleanText(result?.text || "");
      }

      // Current api: new PDFParse({ data }).getText()
      const PDFParseCtor = mod?.PDFParse || mod?.default?.PDFParse;
      if (PDFParseCtor) {
        const parser = new PDFParseCtor({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          return cleanText(result?.text || "");
        } finally {
          if (typeof parser.destroy === "function") {
            await parser.destroy();
          }
        }
      }
    } catch (importError) {
      errors.push(
        importError instanceof Error
          ? `pdf-parse import failed: ${importError.message}`
          : "pdf-parse import failed"
      );
    }
  }

  // Fallback: use pdf.js directly for text extraction
  try {
    let pdfjs: any = null;
    try {
      const require = await getNodeRequire();
      if (!require) {
        throw new Error("node:module createRequire unavailable");
      }
      pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
    } catch (requireError) {
      errors.push(
        requireError instanceof Error
          ? `pdfjs require failed: ${requireError.message}`
          : "pdfjs require failed"
      );
      pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    }
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    try {
      let fullText = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = (content.items || [])
          .map((item: any) => item?.str || "")
          .join(" ");
        fullText += `${pageText}\n`;
      }
      return cleanText(fullText);
    } finally {
      if (typeof pdf.destroy === "function") {
        await pdf.destroy();
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "pdfjs fallback failed");
  }

  // Last-resort parser: extract text operators directly from PDF streams.
  try {
    const text = await extractPdfTextFallback(buffer);
    if (text) return text;
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `pdf stream fallback failed: ${error.message}`
        : "pdf stream fallback failed"
    );
  }

  throw new Error(errors.join(" | "));
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
      const buf = Buffer.from(await file.arrayBuffer());
      const text = await extractPdfText(buf);
      if (!text) return { ok: false, error: "PDF extracted empty text." };
      return { ok: true, text, method: "pdf" };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `PDF extraction failed: ${error.message}`
            : "PDF extraction failed.",
      };
    }
  }

  return {
    ok: false,
    error: "Unsupported file type. Upload TXT, DOCX, or PDF.",
  };
}
