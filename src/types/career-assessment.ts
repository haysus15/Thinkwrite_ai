// Career Assessment Types
// src/types/career-assessment.ts

export type AssessmentStatus = 'in_progress' | 'completed' | 'abandoned';
export type QuestionType = 'multiple_choice' | 'text' | 'scale' | 'multi_select';
export type AssessmentPhase = 'current_situation' | 'goals' | 'constraints' | 'generating' | 'complete';

export interface AssessmentQuestion {
  id: string;
  phase: AssessmentPhase;
  question: string;
  subtext?: string;
  type: QuestionType;
  options?: {
    value: string;
    label: string;
    description?: string;
  }[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  placeholder?: string;
  required: boolean;
  followUp?: {
    condition: string;
    question: AssessmentQuestion;
  };
}

export interface AssessmentAnswers {
  // Current Situation
  current_role?: string;
  current_industry?: string;
  years_experience?: string;
  employment_status?: string;
  satisfaction_level?: number;
  biggest_frustration?: string;
  current_salary_range?: string;
  
  // Goals
  short_term_goal?: string;
  long_term_goal?: string;
  target_industries?: string[];
  success_definition?: string;
  skills_to_develop?: string;
  dream_companies?: string;
  
  // Constraints
  location_preference?: string;
  willing_to_relocate?: string;
  salary_requirement?: string;
  timeline_urgency?: string;
  education_willingness?: string;
  work_life_priority?: string;
  
  [key: string]: string | string[] | number | undefined;
}

export interface GapAnalysisItem {
  category: 'skill' | 'experience' | 'education' | 'certification';
  have: string[];
  need: string[];
  priority: 'critical' | 'important' | 'nice_to_have';
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'certification' | 'education' | 'skill' | 'project' | 'networking' | 'application';
  priority: 'high' | 'medium' | 'low';
  timeline: 'this_week' | 'this_month' | 'this_quarter' | 'this_year';
  estimatedDuration?: string;
  estimatedCost?: string;
  resources: {
    name: string;
    url: string;
    type: 'course' | 'certification' | 'book' | 'website' | 'tool';
    provider?: string;
    cost?: string;
  }[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface JobTarget {
  title: string;
  timeline: 'now' | '6_months' | '2_years';
  salaryRange: string;
  requirements: string[];
  matchScore?: number;
  gapSummary?: string;
}

export interface CareerRoadmap {
  executiveSummary: {
    currentState: string;
    targetState: string;
    timelineEstimate: string;
    keyInsight: string;
  };
  gapAnalysis: GapAnalysisItem[];
  actionPlan: {
    immediate: ActionItem[];
    shortTerm: ActionItem[];
    mediumTerm: ActionItem[];
    longTerm: ActionItem[];
  };
  jobTargets: JobTarget[];
  resumeRecommendations: {
    emphasize: string[];
    add: string[];
    remove: string[];
  };
  certifications: {
    name: string;
    provider: string;
    url: string;
    cost: string;
    duration: string;
    priority: 'critical' | 'recommended' | 'optional';
    reason: string;
  }[];
  educationPaths?: {
    type: 'degree' | 'bootcamp' | 'online_course';
    name: string;
    provider: string;
    url: string;
    duration: string;
    cost: string;
    reason: string;
  }[];
  lexInsights: string[];
}

export interface CareerAssessment {
  id: string;
  userId: string;
  status: AssessmentStatus;
  currentPhase: AssessmentPhase;
  currentQuestionIndex: number;
  answers: AssessmentAnswers;
  resumeId?: string;
  resumeSnapshot?: any;
  roadmap?: CareerRoadmap;
  startedAt: string;
  completedAt?: string;
  lastUpdatedAt: string;
  timeSpentSeconds: number;
}

export interface CareerAssessmentDB {
  id: string;
  user_id: string;
  status: AssessmentStatus;
  current_phase: number;
  current_question: number;
  answers: AssessmentAnswers;
  resume_id?: string;
  resume_snapshot?: any;
  roadmap?: CareerRoadmap;
  action_plan?: any;
  gap_analysis?: any;
  recommended_resources?: any;
  started_at: string;
  completed_at?: string;
  last_updated_at: string;
  time_spent_seconds: number;
  created_at: string;
  updated_at: string;
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // Phase 1: Current Situation
  {
    id: 'employment_status',
    phase: 'current_situation',
    question: "Let's start with where you are right now. What's your current employment status?",
    type: 'multiple_choice',
    options: [
      { value: 'employed_fulltime', label: 'Employed Full-Time', description: 'Working 35+ hours/week' },
      { value: 'employed_parttime', label: 'Employed Part-Time', description: 'Working less than 35 hours/week' },
      { value: 'unemployed_searching', label: 'Unemployed & Job Searching', description: 'Actively looking for work' },
      { value: 'unemployed_not_searching', label: 'Unemployed & Not Searching', description: 'Taking a break or other priorities' },
      { value: 'student', label: 'Student', description: 'Currently in school/training' },
      { value: 'freelance', label: 'Freelance/Self-Employed', description: 'Working for yourself' },
      { value: 'career_changer', label: 'Career Changer', description: 'Looking to switch fields entirely' }
    ],
    required: true
  },
  {
    id: 'current_role',
    phase: 'current_situation',
    question: "What's your current or most recent job title?",
    subtext: "If you're a student or career changer, share what role you're targeting.",
    type: 'text',
    placeholder: 'e.g., Software Engineer, Marketing Manager, Recent Graduate',
    required: true
  },
  {
    id: 'current_industry',
    phase: 'current_situation',
    question: "What industry are you currently in (or targeting)?",
    type: 'multiple_choice',
    options: [
      { value: 'technology', label: 'Technology/Software' },
      { value: 'healthcare', label: 'Healthcare/Medical' },
      { value: 'finance', label: 'Finance/Banking' },
      { value: 'marketing', label: 'Marketing/Advertising' },
      { value: 'education', label: 'Education' },
      { value: 'retail', label: 'Retail/E-commerce' },
      { value: 'manufacturing', label: 'Manufacturing' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'government', label: 'Government/Public Sector' },
      { value: 'nonprofit', label: 'Non-Profit' },
      { value: 'other', label: 'Other' }
    ],
    required: true
  },
  {
    id: 'years_experience',
    phase: 'current_situation',
    question: "How many years of professional experience do you have?",
    type: 'multiple_choice',
    options: [
      { value: '0-1', label: '0-1 years', description: 'Entry level / New graduate' },
      { value: '2-4', label: '2-4 years', description: 'Early career' },
      { value: '5-7', label: '5-7 years', description: 'Mid-level' },
      { value: '8-12', label: '8-12 years', description: 'Senior' },
      { value: '13+', label: '13+ years', description: 'Executive / Expert' }
    ],
    required: true
  },
  {
    id: 'satisfaction_level',
    phase: 'current_situation',
    question: "How satisfied are you with your current career situation?",
    subtext: "1 = Very Unsatisfied, 10 = Completely Satisfied",
    type: 'scale',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: { min: 'Very Unsatisfied', max: 'Completely Satisfied' },
    required: true
  },
  {
    id: 'biggest_frustration',
    phase: 'current_situation',
    question: "What's your biggest frustration or challenge with your current career situation?",
    subtext: "Be honest - this helps me give you targeted advice.",
    type: 'text',
    placeholder: "e.g., Not getting callbacks, feeling stuck, low salary, no growth opportunities...",
    required: true
  },

  // Phase 2: Goals
  {
    id: 'short_term_goal',
    phase: 'goals',
    question: "Where do you want to be in 1-2 years?",
    subtext: "Think about your ideal role, company type, or situation.",
    type: 'text',
    placeholder: "e.g., Senior Software Engineer at a mid-size tech company, Manager role, Remote position...",
    required: true
  },
  {
    id: 'long_term_goal',
    phase: 'goals',
    question: "What's your 5-year career vision?",
    subtext: "Dream big - this helps me map the path to get there.",
    type: 'text',
    placeholder: "e.g., VP of Engineering, Start my own company, Director of Marketing...",
    required: true
  },
  {
    id: 'target_industries',
    phase: 'goals',
    question: "Which industries interest you for your next role?",
    subtext: "Select all that apply.",
    type: 'multi_select',
    options: [
      { value: 'technology', label: 'Technology/Software' },
      { value: 'healthcare', label: 'Healthcare/Medical' },
      { value: 'finance', label: 'Finance/Banking/Fintech' },
      { value: 'marketing', label: 'Marketing/Advertising' },
      { value: 'education', label: 'Education/EdTech' },
      { value: 'retail', label: 'Retail/E-commerce' },
      { value: 'ai_ml', label: 'AI/Machine Learning' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'startup', label: 'Startups' },
      { value: 'open', label: 'Open to anything' }
    ],
    required: true
  },
  {
    id: 'success_definition',
    phase: 'goals',
    question: "What does career success mean to YOU?",
    subtext: "Everyone's definition is different. What matters most?",
    type: 'multiple_choice',
    options: [
      { value: 'money', label: 'Financial Success', description: 'High salary, wealth building' },
      { value: 'impact', label: 'Making an Impact', description: 'Meaningful work that matters' },
      { value: 'growth', label: 'Continuous Growth', description: 'Always learning, advancing' },
      { value: 'balance', label: 'Work-Life Balance', description: 'Time for life outside work' },
      { value: 'leadership', label: 'Leadership & Influence', description: 'Leading teams, making decisions' },
      { value: 'expertise', label: 'Deep Expertise', description: 'Being the best at what you do' },
      { value: 'freedom', label: 'Autonomy & Freedom', description: 'Working on your own terms' }
    ],
    required: true
  },
  {
    id: 'skills_to_develop',
    phase: 'goals',
    question: "What skills do you most want to develop?",
    subtext: "Think about what would make you more valuable in your target role.",
    type: 'text',
    placeholder: "e.g., Leadership, Python, Data Analysis, Public Speaking, Project Management...",
    required: true
  },

  // Phase 3: Constraints
  {
    id: 'location_preference',
    phase: 'constraints',
    question: "What's your location preference?",
    type: 'multiple_choice',
    options: [
      { value: 'remote_only', label: 'Remote Only', description: 'I want to work from anywhere' },
      { value: 'hybrid', label: 'Hybrid', description: 'Mix of remote and in-office' },
      { value: 'onsite', label: 'On-site', description: 'I prefer being in an office' },
      { value: 'flexible', label: 'Flexible', description: 'Open to any arrangement' }
    ],
    required: true
  },
  {
    id: 'willing_to_relocate',
    phase: 'constraints',
    question: "Are you willing to relocate for the right opportunity?",
    type: 'multiple_choice',
    options: [
      { value: 'yes_anywhere', label: 'Yes - Anywhere', description: 'Willing to move anywhere' },
      { value: 'yes_specific', label: 'Yes - Specific Areas', description: 'Willing to move to certain locations' },
      { value: 'no', label: 'No', description: 'I need to stay in my current area' }
    ],
    required: true
  },
  {
    id: 'timeline_urgency',
    phase: 'constraints',
    question: "How urgently are you looking to make a career move?",
    type: 'multiple_choice',
    options: [
      { value: 'immediate', label: 'ASAP', description: 'Actively job hunting now' },
      { value: '3_months', label: 'Within 3 months', description: 'Ready to move soon' },
      { value: '6_months', label: 'Within 6 months', description: 'Exploring options' },
      { value: 'long_term', label: 'Long-term planning', description: 'Building toward future goals' }
    ],
    required: true
  },
  {
    id: 'education_willingness',
    phase: 'constraints',
    question: "Are you willing to invest in education or certifications?",
    subtext: "This helps me recommend the right upskilling path.",
    type: 'multiple_choice',
    options: [
      { value: 'degree', label: 'Yes - Even a Degree', description: 'Open to going back to school' },
      { value: 'bootcamp', label: 'Yes - Bootcamp/Intensive', description: 'Several weeks/months of training' },
      { value: 'certification', label: 'Yes - Certifications', description: 'A few weeks of focused study' },
      { value: 'self_study', label: 'Self-Study Only', description: 'Free resources, learning on my own' },
      { value: 'no', label: 'No Additional Education', description: 'I want to use what I have' }
    ],
    required: true
  },
  {
    id: 'work_life_priority',
    phase: 'constraints',
    question: "What's most important to you in your next role?",
    subtext: "Choose your TOP priority - this shapes my recommendations.",
    type: 'multiple_choice',
    options: [
      { value: 'compensation', label: 'Compensation', description: 'Maximize my earning potential' },
      { value: 'growth', label: 'Career Growth', description: 'Fast advancement opportunities' },
      { value: 'stability', label: 'Job Stability', description: 'Secure, established company' },
      { value: 'flexibility', label: 'Flexibility', description: 'Remote, flexible hours' },
      { value: 'culture', label: 'Company Culture', description: 'Great team, values alignment' },
      { value: 'learning', label: 'Learning Opportunities', description: 'New technologies, skills' }
    ],
    required: true
  }
];

export function getQuestionsByPhase(phase: AssessmentPhase): AssessmentQuestion[] {
  return ASSESSMENT_QUESTIONS.filter(q => q.phase === phase);
}

export function getPhaseProgress(answers: AssessmentAnswers): {
  current_situation: number;
  goals: number;
  constraints: number;
  overall: number;
} {
  const phases = ['current_situation', 'goals', 'constraints'] as const;
  const progress: any = {};
  
  phases.forEach(phase => {
    const questions = getQuestionsByPhase(phase);
    const answered = questions.filter(q => answers[q.id] !== undefined).length;
    progress[phase] = Math.round((answered / questions.length) * 100);
  });
  
  const totalQuestions = ASSESSMENT_QUESTIONS.length;
  const totalAnswered = Object.keys(answers).filter(k => answers[k] !== undefined).length;
  progress.overall = Math.round((totalAnswered / totalQuestions) * 100);
  
  return progress;
}

export function generateAssessmentId(): string {
  return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}