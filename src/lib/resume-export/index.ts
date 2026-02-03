import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// @ts-expect-error - pdfmake vfs typing mismatch
pdfMake.vfs = pdfFonts.pdfMake.vfs;

interface ResumeSections {
  summary?: { content: string };
  experience?: { content: string } | Array<{ company: string; title: string; bullets: string[] }>;
  education?: { content: string };
  skills?: { content: string };
  projects?: { content: string };
}

export async function exportToPdf(
  content: string,
  filename: string,
  sections?: ResumeSections
): Promise<void> {
  const docDefinition = buildPdfDocument(content, sections);

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).download(`${filename}.pdf`, () => {
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildPdfDocument(content: string, sections?: ResumeSections): any {
  const parsedSections = parseContentToSections(content);

  const docContent: any[] = [];

  if (parsedSections.summary) {
    docContent.push(
      { text: "PROFESSIONAL SUMMARY", style: "sectionHeader", margin: [0, 0, 0, 8] },
      { text: parsedSections.summary, style: "body", margin: [0, 0, 0, 16] }
    );
  }

  if (parsedSections.experience) {
    docContent.push(
      { text: "EXPERIENCE", style: "sectionHeader", margin: [0, 0, 0, 8] },
      { text: parsedSections.experience, style: "body", margin: [0, 0, 0, 16] }
    );
  }

  if (parsedSections.education) {
    docContent.push(
      { text: "EDUCATION", style: "sectionHeader", margin: [0, 0, 0, 8] },
      { text: parsedSections.education, style: "body", margin: [0, 0, 0, 16] }
    );
  }

  if (parsedSections.skills) {
    docContent.push(
      { text: "SKILLS", style: "sectionHeader", margin: [0, 0, 0, 8] },
      { text: parsedSections.skills, style: "body", margin: [0, 0, 0, 16] }
    );
  }

  if (docContent.length === 0) {
    docContent.push({ text: content, style: "body" });
  }

  return {
    content: docContent,
    styles: {
      sectionHeader: {
        fontSize: 11,
        bold: true,
        color: "#333333",
        characterSpacing: 1,
      },
      body: {
        fontSize: 10,
        lineHeight: 1.4,
        color: "#444444",
      },
    },
    defaultStyle: {
      font: "Helvetica",
    },
    pageMargins: [50, 50, 50, 50],
  };
}

export async function exportToDocx(
  content: string,
  filename: string,
  sections?: ResumeSections
): Promise<void> {
  const doc = buildDocxDocument(content, sections);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

function buildDocxDocument(content: string, sections?: ResumeSections): Document {
  const parsedSections = parseContentToSections(content);
  const docSections: Paragraph[] = [];

  if (parsedSections.summary) {
    docSections.push(
      new Paragraph({
        text: "PROFESSIONAL SUMMARY",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: parsedSections.summary })],
        spacing: { after: 240 },
      })
    );
  }

  if (parsedSections.experience) {
    docSections.push(
      new Paragraph({
        text: "EXPERIENCE",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: parsedSections.experience })],
        spacing: { after: 240 },
      })
    );
  }

  if (parsedSections.education) {
    docSections.push(
      new Paragraph({
        text: "EDUCATION",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: parsedSections.education })],
        spacing: { after: 240 },
      })
    );
  }

  if (parsedSections.skills) {
    docSections.push(
      new Paragraph({
        text: "SKILLS",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: parsedSections.skills })],
        spacing: { after: 240 },
      })
    );
  }

  if (docSections.length === 0) {
    docSections.push(
      new Paragraph({
        children: [new TextRun({ text: content })],
      })
    );
  }

  return new Document({
    sections: [
      {
        children: docSections,
      },
    ],
  });
}

function parseContentToSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};

  const sectionPatterns = [
    {
      key: "summary",
      patterns: [
        /(?:PROFESSIONAL\s+)?SUMMARY[:\s]*\n?([\s\S]*?)(?=\n[A-Z]{3,}|$)/i,
      ],
    },
    { key: "experience", patterns: [/EXPERIENCE[:\s]*\n?([\s\S]*?)(?=\n[A-Z]{3,}|$)/i] },
    { key: "education", patterns: [/EDUCATION[:\s]*\n?([\s\S]*?)(?=\n[A-Z]{3,}|$)/i] },
    { key: "skills", patterns: [/SKILLS[:\s]*\n?([\s\S]*?)(?=\n[A-Z]{3,}|$)/i] },
    { key: "projects", patterns: [/PROJECTS[:\s]*\n?([\s\S]*?)(?=\n[A-Z]{3,}|$)/i] },
  ];

  for (const { key, patterns } of sectionPatterns) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]?.trim()) {
        sections[key] = match[1].trim();
        break;
      }
    }
  }

  if (Object.keys(sections).length === 0) {
    const paragraphs = content.split(/\n\n+/).filter(Boolean);
    if (paragraphs.length > 0) {
      sections.summary = paragraphs[0];
      if (paragraphs.length > 1) {
        sections.experience = paragraphs.slice(1).join("\n\n");
      }
    }
  }

  return sections;
}
