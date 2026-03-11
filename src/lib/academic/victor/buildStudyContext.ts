export type StudyContext = {
  materialName: string;
  className: string | null;
  materialType: string | null;
  contentChunk: string;
  studentQuery: string;
};

export function buildStudyContext(context: StudyContext): string {
  return [
    `STUDY MATERIAL: ${context.materialName}`,
    `CLASS: ${context.className || "Not specified"}`,
    `TYPE: ${context.materialType || "Not specified"}`,
    "CONTENT:",
    context.contentChunk,
    "",
    `STUDENT QUERY: ${context.studentQuery}`,
    "",
    "The student is asking about this material. Ground all responses in the content above. Do not reference information outside this document unless the student explicitly asks to connect it to broader knowledge.",
  ].join("\n");
}
