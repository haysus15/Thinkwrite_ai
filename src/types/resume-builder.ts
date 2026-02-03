// Resume Builder Types
// src/types/resume-builder.ts

export type SectionStatus = 'empty' | 'draft' | 'reviewed' | 'polished';

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
}

export interface ExperienceEntry {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
  relevantCoursework?: string[];
}

export interface SkillGroup {
  id: string;
  category: string;
  skills: string[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  bullets?: string[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  expirationDate?: string;
  credentialId?: string;
}

export interface SectionFeedback {
  strengths: string[];
  improvements: Array<{
    issue: string;
    suggestion: string;
    example?: string;
  }>;
  rewrites?: Array<{
    original: string;
    suggested: string;
    reason: string;
  }>;
  overallTip: string;
  score?: number;
}

export interface ResumeBuilderData {
  id?: string;
  userId: string;
  title: string;
  targetRole?: string;
  targetIndustry?: string;
  
  // Section data
  contactInfo: ContactInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  
  // Section statuses
  sectionStatuses: {
    contact: SectionStatus;
    summary: SectionStatus;
    experience: SectionStatus;
    education: SectionStatus;
    skills: SectionStatus;
    projects: SectionStatus;
    certifications: SectionStatus;
  };
  
  // Lex feedback per section
  sectionFeedback: {
    contact?: SectionFeedback;
    summary?: SectionFeedback;
    experience?: SectionFeedback;
    education?: SectionFeedback;
    skills?: SectionFeedback;
    projects?: SectionFeedback;
    certifications?: SectionFeedback;
  };
  
  // Meta
  isDraft: boolean;
  isMasterResume: boolean;
  lastSavedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Raw imported resume text (hidden, preserved)
  rawImportedText?: string | null;
}

export interface ResumeBuilderDB {
  id: string;
  user_id: string;
  title: string;
  target_role?: string;
  target_industry?: string;
  contact_info: ContactInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  section_statuses: ResumeBuilderData['sectionStatuses'];
  section_feedback: ResumeBuilderData['sectionFeedback'];
  is_draft: boolean;
  is_master_resume: boolean;
  source: 'builder';
  extracted_text?: string | null;
  created_at: string;
  updated_at: string;
}

// Lex Feedback Request
export interface LexFeedbackRequest {
  section: keyof ResumeBuilderData['sectionStatuses'];
  content: any; // Section-specific content
  targetRole?: string;
  targetIndustry?: string;
  resumeContext?: {
    hasExperience: boolean;
    yearsExperience?: number;
    industries?: string[];
  };
}

// Lex Feedback Response
export interface LexFeedbackResponse {
  success: boolean;
  feedback?: SectionFeedback;
  error?: string;
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Default empty resume
export function createEmptyResume(userId: string): ResumeBuilderData {
  return {
    userId,
    title: '',
    targetRole: '',
    targetIndustry: '',
    contactInfo: {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      website: ''
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    sectionStatuses: {
      contact: 'empty',
      summary: 'empty',
      experience: 'empty',
      education: 'empty',
      skills: 'empty',
      projects: 'empty',
      certifications: 'empty'
    },
    sectionFeedback: {},
    isDraft: true,
    isMasterResume: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Check if resume has enough content to save
export function canSaveResume(resume: ResumeBuilderData): boolean {
  const contactInfo = resume.contactInfo || { name: "", email: "" } as ResumeBuilderData["contactInfo"];
  const title = resume.title || "";
  const summary = resume.summary || "";
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const certifications = Array.isArray(resume.certifications) ? resume.certifications : [];

  // Must have a title
  if (title.trim().length > 0) return true;
  
  // Or have meaningful content in any section
  if ((contactInfo.name || "").trim().length > 0) return true;
  if (summary.trim().length > 0) return true;
  if (experience.length > 0) return true;
  if (education.length > 0) return true;
  if (skills.length > 0) return true;
  if (projects.length > 0) return true;
  if (certifications.length > 0) return true;
  
  return false;
}

// Calculate completion percentage
export function calculateCompletion(resume: ResumeBuilderData): number {
  const contactInfo = resume.contactInfo || { name: "", email: "" } as ResumeBuilderData["contactInfo"];
  const summary = resume.summary || "";
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const certifications = Array.isArray(resume.certifications) ? resume.certifications : [];

  const sections = [
    {
      weight: 15,
      filled:
        (contactInfo.name || "").length > 0 &&
        (contactInfo.email || "").length > 0,
    },
    { weight: 15, filled: summary.length > 50 },
    {
      weight: 30,
      filled:
        experience.length > 0 &&
        experience.some((e) => Array.isArray(e.bullets) && e.bullets.length > 0),
    },
    {
      weight: 15,
      filled:
        skills.length > 0 &&
        skills.some((s) => Array.isArray(s.skills) && s.skills.length > 0),
    },
    { weight: 15, filled: education.length > 0 },
    { weight: 5, filled: projects.length > 0 },
    { weight: 5, filled: certifications.length > 0 }
  ];
  
  return sections.reduce((total, section) => total + (section.filled ? section.weight : 0), 0);
}

// Transform from DB format
export function transformResumeFromDB(db: ResumeBuilderDB): ResumeBuilderData {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    targetRole: db.target_role,
    targetIndustry: db.target_industry,
    contactInfo: db.contact_info,
    summary: db.summary,
    experience: db.experience,
    education: db.education,
    skills: db.skills,
    projects: db.projects,
    certifications: db.certifications,
    sectionStatuses: db.section_statuses,
    sectionFeedback: db.section_feedback,
    isDraft: db.is_draft,
    isMasterResume: db.is_master_resume,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    rawImportedText: (db as any).extracted_text || null
  };
}

// Transform to DB format
export function transformResumeToDB(resume: ResumeBuilderData): Partial<ResumeBuilderDB> {
  return {
    user_id: resume.userId,
    title: resume.title,
    target_role: resume.targetRole,
    target_industry: resume.targetIndustry,
    contact_info: resume.contactInfo,
    summary: resume.summary,
    experience: resume.experience,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects,
    certifications: resume.certifications,
    section_statuses: resume.sectionStatuses,
    section_feedback: resume.sectionFeedback,
    is_draft: resume.isDraft,
    is_master_resume: resume.isMasterResume,
    extracted_text: resume.rawImportedText || null,
    source: 'builder'
  };
}
