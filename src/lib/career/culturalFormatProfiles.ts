export interface CulturalFormatProfile {
  language: string;
  market: string;
  resumeConventions: string[];
  coverLetterConventions: string[];
  toneGuidance: string;
  avoidances: string[];
}

const CULTURAL_FORMAT_PROFILES: Record<string, CulturalFormatProfile> = {
  en: {
    language: "en",
    market: "United States",
    resumeConventions: [
      "Use standard American resume structure with a concise professional summary.",
      "Keep the document to one page for early-career candidates and two pages only when experience clearly requires it.",
      "Lead with quantified achievements and role-relevant skills.",
      "Do not include a photo, age, marital status, or other protected personal data.",
    ],
    coverLetterConventions: [
      "Use a direct business letter opening with role, company, and value proposition in the first paragraph.",
      "Keep the body achievement-focused and tailored to the role requirements.",
      "Close with a confident call to action and professional sign-off.",
    ],
    toneGuidance:
      "Use polished American professional English. Clear, achievement-focused, and concise without sounding stiff.",
    avoidances: [
      "Do not add a photo or personal demographics.",
      "Do not use a Europass-style personal data block.",
      "Do not over-explain routine duties when quantified outcomes are available.",
    ],
  },
  es: {
    language: "es",
    market: "Spain",
    resumeConventions: [
      "Use CV conventions common in Spain, with awareness of Europass structure when useful.",
      "A personal data section is common and may include fecha de nacimiento or estado civil when appropriate to the market.",
      "Photo inclusion is common by convention.",
      "Maintain reverse-chronological structure with formal presentation.",
    ],
    coverLetterConventions: [
      "Use a formal opening and structured paragraphs with clear motivation for the role.",
      "Reference fit for the puesto and the company in a direct but respectful way.",
      "Keep the closing formal and professional.",
    ],
    toneGuidance:
      "Use formal professional Spanish for Spain. Crisp, serious, and institutionally appropriate.",
    avoidances: [
      "Do not default to American resume conventions when they conflict with Spanish CV norms.",
      "Do not omit the personal data block when the surrounding document style calls for it.",
      "Do not use overly casual workplace language.",
    ],
  },
  fr: {
    language: "fr",
    market: "France",
    resumeConventions: [
      "Use French CV structure rather than an American resume format.",
      "Include an accroche or personal statement near the top.",
      "Use reverse-chronological experience ordering.",
      "Personal data is commonly included; photo is common but not mandatory.",
      "Keep junior CVs to one page when possible and senior CVs to two pages when needed.",
    ],
    coverLetterConventions: [
      "Use a formal lettre de motivation structure with a disciplined introduction, body, and conclusion.",
      "Reference the role and enterprise specifically with a formal register.",
      "Close with a polished and formal final paragraph.",
    ],
    toneGuidance:
      "Use formal French professional register. Controlled, polished, and credible rather than conversational.",
    avoidances: [
      "Do not force American resume formatting conventions.",
      "Do not remove the accroche when a CV is being generated.",
      "Do not write in an overly casual startup tone unless the user context strongly demands it.",
    ],
  },
  de: {
    language: "de",
    market: "Germany",
    resumeConventions: [
      "Use Lebenslauf conventions with a formal, structured layout.",
      "Include a personal data section consistent with German professional norms.",
      "Photo inclusion is standard by convention.",
      "Maintain reverse-chronological ordering and clean factual phrasing.",
    ],
    coverLetterConventions: [
      "Use Anschreiben structure with formal opening, body, closing, and signature block.",
      "Address the employer directly with a formal Sie register throughout.",
      "State fit, role motivation, and relevant qualifications with disciplined structure.",
    ],
    toneGuidance:
      "Use formal German business register with consistent Sie usage. Precise, disciplined, and highly professional.",
    avoidances: [
      "Do not use informal du register.",
      "Do not write cover letters in loose Anglo-American paragraph style.",
      "Do not omit standard formal document structure.",
    ],
  },
  pt: {
    language: "pt",
    market: "Brazil",
    resumeConventions: [
      "Use curriculo conventions common in Brazil.",
      "Include personal data section when appropriate.",
      "Photo inclusion is common by convention.",
      "Include an objective statement near the top when it fits the profile.",
    ],
    coverLetterConventions: [
      "Use a professional but more fluid structure than stricter European markets.",
      "State interest in the vaga and practical value to the employer clearly.",
      "Keep the close polite, confident, and direct.",
    ],
    toneGuidance:
      "Use professional Brazilian Portuguese. Direct and credible, but slightly less rigid than many European business formats.",
    avoidances: [
      "Do not default to European Portuguese phrasing when Brazilian context is intended.",
      "Do not overformalize to the point that the text feels unnatural in Brazilian professional settings.",
      "Do not remove the objective statement when it is useful to the format.",
    ],
  },
  zh: {
    language: "zh",
    market: "China",
    resumeConventions: [
      "Use Chinese resume conventions with a prominent personal information section.",
      "Photo, age, gender, and marital status are commonly included by convention.",
      "Emphasize academic credentials and measurable outcomes clearly.",
      "Keep the document structured and easy to scan.",
    ],
    coverLetterConventions: [
      "Use formal, efficient professional Chinese with a clear purpose statement early.",
      "Stress fit for the role, capability, and measurable contribution.",
      "Close with a respectful, concise expression of interest.",
    ],
    toneGuidance:
      "Use formal written Mandarin suitable for professional application documents. Structured, efficient, and serious.",
    avoidances: [
      "Do not force Western minimal-personal-data norms onto the resume.",
      "Do not use colloquial internet-style phrasing.",
      "Do not underemphasize education when it is relevant to the market.",
    ],
  },
  ja: {
    language: "ja",
    market: "Japan",
    resumeConventions: [
      "Use rirekisho conventions with highly structured fields and chronological order.",
      "Photo inclusion is required by convention.",
      "Preserve formal field-based structure rather than a freeform Western resume layout.",
      "Account for common rirekisho expectations such as clean factual entries and standardized ordering.",
    ],
    coverLetterConventions: [
      "Use extremely formal Japanese application register.",
      "Keep structure disciplined and aligned with rirekisho-adjacent expectations.",
      "Present motivation, fit, and professional seriousness with restraint and precision.",
    ],
    toneGuidance:
      "Use highly formal Japanese business/application register. Polite, restrained, and structurally disciplined.",
    avoidances: [
      "Do not use casual plain-form phrasing.",
      "Do not write with an American self-promotional style that feels culturally off.",
      "Do not drop structured application-field expectations.",
    ],
  },
  ko: {
    language: "ko",
    market: "South Korea",
    resumeConventions: [
      "Use iryeokseo conventions with a prominent personal data and education section.",
      "Photo inclusion is standard by convention.",
      "Military service may be relevant for male applicants depending on context.",
      "Maintain a formal, structured layout with clear chronology.",
    ],
    coverLetterConventions: [
      "Use formal Korean professional register with disciplined structure.",
      "Emphasize role fit, diligence, and concrete capability in a polished way.",
      "Keep the close respectful and conventional.",
    ],
    toneGuidance:
      "Use formal Korean professional register with proper honorific sensitivity. Serious, respectful, and clear.",
    avoidances: [
      "Do not use casual spoken Korean.",
      "Do not apply American-style minimal personal-detail assumptions when the format expects more structure.",
      "Do not weaken honorific formality.",
    ],
  },
};

export const SUPPORTED_CULTURAL_FORMAT_LANGUAGES = Object.keys(CULTURAL_FORMAT_PROFILES);

export function getCulturalFormatProfile(language: string | null | undefined): CulturalFormatProfile {
  const normalized = String(language || "en").toLowerCase();
  return CULTURAL_FORMAT_PROFILES[normalized] || CULTURAL_FORMAT_PROFILES.en;
}

export function buildCulturalFormatInstruction(profile: CulturalFormatProfile): string {
  return `Apply the following professional document conventions for ${profile.market}:
Resume conventions:
- ${profile.resumeConventions.join("\n- ")}

Cover letter conventions:
- ${profile.coverLetterConventions.join("\n- ")}

Tone guidance:
${profile.toneGuidance}

Avoid:
- ${profile.avoidances.join("\n- ")}`;
}

export function getCulturalFormatNotice(profile: CulturalFormatProfile): {
  title: string;
  detail: string;
} | null {
  if (profile.language === "en") return null;

  const detailByLanguage: Record<string, string> = {
    es: "Applying Spanish CV conventions with formal structure and common personal-data expectations.",
    fr: "Applying French CV conventions with an accroche and standard CV structure.",
    de: "Applying German Lebenslauf conventions with formal Anschreiben structure for cover letters.",
    pt: "Applying Brazilian curriculo conventions with an objective-led professional format.",
    zh: "Applying Chinese professional document conventions with a prominent personal-information structure.",
    ja: "Applying Japanese rirekisho conventions with structured fields and formal register.",
    ko: "Applying Korean iryeokseo conventions with formal register and structured profile details.",
  };

  return {
    title: `Applying ${profile.market} professional document conventions.`,
    detail: detailByLanguage[profile.language] || `Applying ${profile.market} professional conventions for this document.`,
  };
}
