// TypeScript types for ThinkWrite Job Analysis System
export interface JobDetails {
  title: string;
  company: string;
  location?: string;
  postedDate?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationEmail?: string;
}
export interface PhraseTranslation {
  original: string;
  meaning: string;
  context: string;
}
export interface HiddenInsights {
  phraseTranslations: PhraseTranslation[];
  urgencyIndicators: string[];
  cultureClues: string[];
  compensationSignals: string[];
}
export interface IndustryIntelligence {
  sector: string;
  hiringPatterns: string[];
  buzzwordMeanings: string[];
  applicationTips: string[];
}
export interface ATSKeywords {
  hardSkills: Array<{
    skill: string;
    frequency: number;
    importance: 'high' | 'medium' | 'low';
    category: string;
  }>;
  softSkills: Array<{
    skill: string;
    frequency: number;
    importance: 'high' | 'medium' | 'low';
  }>;
  technologies: Array<{
    technology: string;
    frequency: number;
    category: string;
  }>;
  certifications: string[];
  educationRequirements: string[];
  experienceKeywords: Array<{
    keyword: string;
    context: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  industryKeywords: string[];
  actionWords: string[];
  keyPhrases?: string[];
  atsScore: number;
}
export interface JobAnalysisResult {
  id?: string;
  success: boolean;
  jobDetails: JobDetails;
  hiddenInsights: HiddenInsights;
  industryIntelligence: IndustryIntelligence;
  atsKeywords: ATSKeywords;
  error?: string;
}
export interface SavedJobAnalysis {
  id: string;
  user_id: string;
  source_content: string;
  source_type: 'url' | 'text';
  job_title: string;
  company_name: string;
  location?: string;
  job_description: string;
  requirements: string[];
  responsibilities: string[];
  application_email?: string;
  hidden_insights?: HiddenInsights;
  industry_intelligence?: IndustryIntelligence;
  ats_keywords?: ATSKeywords;
  is_saved: boolean;
  has_applied: boolean;
  applied_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
export interface LexDiscussionMessage {
  role: 'user' | 'lex';
  message: string;
  timestamp?: string;
}
export interface LexJobDiscussion {
  id: string;
  user_id: string;
  job_analysis_id: string;
  conversation_context: LexDiscussionMessage[];
  discussion_type: string;
  is_active: boolean;
  last_message_at: string;
  created_at: string;
}
export interface JobAnalysisAPIResponse {
  success: boolean;
  jobId?: string;
  analysis?: JobAnalysisResult;
  error?: string;
}
export interface SavedAnalysesAPIResponse {
  success: boolean;
  analyses?: SavedJobAnalysis[];
  error?: string;
}
export interface LexDiscussionAPIResponse {
  success: boolean;
  lexResponse?: string;
  analysisContext?: {
    jobTitle: string;
    company: string;
    hasEmail: boolean;
    keyInsights: PhraseTranslation[];
  };
  error?: string;
}
export interface JobAnalysisPreferences {
  preferred_industries: string[];
  red_flag_sensitivity: 'high' | 'medium' | 'low';
  auto_save_analyses: boolean;
  notify_application_reminders: boolean;
  reminder_days_after_analysis: number;
}