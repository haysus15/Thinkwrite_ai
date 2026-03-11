import OpenAI from "openai";

type ChunkInput = {
  documentContent: string;
  studentQuery: string;
};

type ChunkOutput = {
  baseline: string;
  relevant: string;
  combined: string;
};

const WORDS_PER_TOKEN = 0.75;

function tokenEstimate(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / WORDS_PER_TOKEN);
}

function takeApproxTokens(text: string, maxTokens: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const maxWords = Math.max(1, Math.floor(maxTokens * WORDS_PER_TOKEN));
  return words.slice(0, maxWords).join(" ");
}

export async function chunkDocumentContext(input: ChunkInput): Promise<ChunkOutput> {
  const content = input.documentContent.trim();
  if (!content) {
    return { baseline: "", relevant: "", combined: "" };
  }

  const totalTokens = tokenEstimate(content);
  if (totalTokens <= 2000) {
    return { baseline: content, relevant: "", combined: content };
  }

  const baseline = takeApproxTokens(content, 1500);

  let relevant = "";
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && input.studentQuery.trim()) {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Return the 800 most relevant tokens from this document for answering this question. Return plain text only.",
          },
          {
            role: "user",
            content: `QUESTION:\n${input.studentQuery}\n\nDOCUMENT:\n${content.slice(0, 24000)}`,
          },
        ],
      });
      relevant = (response.choices[0]?.message?.content || "").trim();
    } catch {
      relevant = "";
    }
  }

  const merged = `${baseline}\n\n${takeApproxTokens(relevant, 800)}`.trim();
  const combined = takeApproxTokens(merged, 2000);
  return { baseline, relevant, combined };
}
