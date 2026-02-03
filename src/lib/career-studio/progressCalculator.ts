// Progress Calculator Utilities for Career Studio
// src/lib/career-studio/progressCalculator.ts

export interface CareerProgress {
  overall: number;
  sections: ProgressSection[];
  nextSteps: NextStep[];
  achievements: Achievement[];
  streak: StreakInfo;
}

export interface ProgressSection {
  id: string;
  name: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  items: ProgressItem[];
}

export interface ProgressItem {
  id: string;
  label: string;
  completed: boolean;
  timestamp?: string;
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  link?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedAt: string;
  icon: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastActivity: string | null;
}

export interface UserActivity {
  resumeUploads: number;
  resumeEdits: number;
  jobsAnalyzed: number;
  jobsSaved: number;
  coverLettersGenerated: number;
  applicationsSubmitted: number;
  assessmentsCompleted: number;
  lexConversations: number;
  lastActive: string | null;
}

// Progress weights for overall calculation
const SECTION_WEIGHTS: Record<string, number> = {
  resume: 25,
  jobSearch: 20,
  coverLetters: 15,
  applications: 20,
  skills: 10,
  networking: 10,
};

/**
 * Calculate overall career readiness progress
 */
export function calculateOverallProgress(sections: ProgressSection[]): number {
  if (sections.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const section of sections) {
    const weight = SECTION_WEIGHTS[section.id] || 10;
    weightedSum += section.progress * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

/**
 * Calculate section progress from items
 */
export function calculateSectionProgress(items: ProgressItem[]): number {
  if (items.length === 0) return 0;

  const completedCount = items.filter(item => item.completed).length;
  return Math.round((completedCount / items.length) * 100);
}

/**
 * Get section status based on progress
 */
export function getSectionStatus(progress: number): ProgressSection['status'] {
  if (progress === 0) return 'not_started';
  if (progress >= 100) return 'completed';
  return 'in_progress';
}

/**
 * Build resume section progress
 */
export function buildResumeProgress(activity: Partial<UserActivity>): ProgressSection {
  const items: ProgressItem[] = [
    {
      id: 'upload',
      label: 'Upload your resume',
      completed: (activity.resumeUploads || 0) > 0,
    },
    {
      id: 'review',
      label: 'Review resume analysis',
      completed: (activity.resumeEdits || 0) > 0,
    },
    {
      id: 'optimize',
      label: 'Optimize for ATS',
      completed: (activity.resumeEdits || 0) >= 2,
    },
    {
      id: 'tailor',
      label: 'Create tailored version',
      completed: (activity.resumeEdits || 0) >= 3,
    },
  ];

  const progress = calculateSectionProgress(items);

  return {
    id: 'resume',
    name: 'Resume',
    progress,
    status: getSectionStatus(progress),
    items,
  };
}

/**
 * Build job search section progress
 */
export function buildJobSearchProgress(activity: Partial<UserActivity>): ProgressSection {
  const items: ProgressItem[] = [
    {
      id: 'analyze',
      label: 'Analyze first job posting',
      completed: (activity.jobsAnalyzed || 0) >= 1,
    },
    {
      id: 'analyze5',
      label: 'Analyze 5 job postings',
      completed: (activity.jobsAnalyzed || 0) >= 5,
    },
    {
      id: 'save',
      label: 'Save interested positions',
      completed: (activity.jobsSaved || 0) >= 1,
    },
    {
      id: 'compare',
      label: 'Compare multiple opportunities',
      completed: (activity.jobsSaved || 0) >= 3,
    },
  ];

  const progress = calculateSectionProgress(items);

  return {
    id: 'jobSearch',
    name: 'Job Search',
    progress,
    status: getSectionStatus(progress),
    items,
  };
}

/**
 * Build cover letters section progress
 */
export function buildCoverLettersProgress(activity: Partial<UserActivity>): ProgressSection {
  const items: ProgressItem[] = [
    {
      id: 'generate',
      label: 'Generate first cover letter',
      completed: (activity.coverLettersGenerated || 0) >= 1,
    },
    {
      id: 'customize',
      label: 'Customize for specific role',
      completed: (activity.coverLettersGenerated || 0) >= 2,
    },
    {
      id: 'multiple',
      label: 'Create 3+ unique letters',
      completed: (activity.coverLettersGenerated || 0) >= 3,
    },
  ];

  const progress = calculateSectionProgress(items);

  return {
    id: 'coverLetters',
    name: 'Cover Letters',
    progress,
    status: getSectionStatus(progress),
    items,
  };
}

/**
 * Build applications section progress
 */
export function buildApplicationsProgress(activity: Partial<UserActivity>): ProgressSection {
  const items: ProgressItem[] = [
    {
      id: 'first',
      label: 'Submit first application',
      completed: (activity.applicationsSubmitted || 0) >= 1,
    },
    {
      id: 'five',
      label: 'Apply to 5 positions',
      completed: (activity.applicationsSubmitted || 0) >= 5,
    },
    {
      id: 'ten',
      label: 'Apply to 10 positions',
      completed: (activity.applicationsSubmitted || 0) >= 10,
    },
    {
      id: 'followup',
      label: 'Follow up on applications',
      completed: false, // Would need tracking
    },
  ];

  const progress = calculateSectionProgress(items);

  return {
    id: 'applications',
    name: 'Applications',
    progress,
    status: getSectionStatus(progress),
    items,
  };
}

/**
 * Build skills assessment section progress
 */
export function buildSkillsProgress(activity: Partial<UserActivity>): ProgressSection {
  const items: ProgressItem[] = [
    {
      id: 'assessment',
      label: 'Complete skills assessment',
      completed: (activity.assessmentsCompleted || 0) >= 1,
    },
    {
      id: 'identify',
      label: 'Identify skill gaps',
      completed: (activity.assessmentsCompleted || 0) >= 1,
    },
    {
      id: 'lex',
      label: 'Discuss with Lex',
      completed: (activity.lexConversations || 0) >= 1,
    },
  ];

  const progress = calculateSectionProgress(items);

  return {
    id: 'skills',
    name: 'Skills',
    progress,
    status: getSectionStatus(progress),
    items,
  };
}

/**
 * Generate next steps based on current progress
 */
export function generateNextSteps(sections: ProgressSection[]): NextStep[] {
  const steps: NextStep[] = [];

  for (const section of sections) {
    if (section.status === 'completed') continue;

    // Find first incomplete item
    const nextItem = section.items.find(item => !item.completed);
    if (!nextItem) continue;

    // Create next step
    const step = createNextStep(section.id, nextItem);
    if (step) {
      steps.push(step);
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  steps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return steps.slice(0, 5);
}

/**
 * Create a next step from a progress item
 */
function createNextStep(sectionId: string, item: ProgressItem): NextStep | null {
  const stepMap: Record<string, Partial<NextStep>> = {
    'resume:upload': {
      title: 'Upload Your Resume',
      description: 'Start by uploading your current resume for analysis',
      priority: 'high',
      estimatedMinutes: 2,
      link: '/career-studio/resume',
    },
    'resume:review': {
      title: 'Review Your Resume Analysis',
      description: 'See how your resume scores and get improvement suggestions',
      priority: 'high',
      estimatedMinutes: 10,
      link: '/career-studio/resume',
    },
    'resume:optimize': {
      title: 'Optimize for ATS',
      description: 'Make your resume more ATS-friendly with our suggestions',
      priority: 'medium',
      estimatedMinutes: 15,
      link: '/career-studio/resume',
    },
    'jobSearch:analyze': {
      title: 'Analyze a Job Posting',
      description: 'Paste a job description to get insights and keywords',
      priority: 'high',
      estimatedMinutes: 5,
      link: '/career-studio/job-analysis',
    },
    'jobSearch:save': {
      title: 'Save Interested Positions',
      description: 'Keep track of jobs you want to apply for',
      priority: 'medium',
      estimatedMinutes: 2,
      link: '/career-studio/job-analysis',
    },
    'coverLetters:generate': {
      title: 'Generate a Cover Letter',
      description: 'Create a tailored cover letter for a specific job',
      priority: 'medium',
      estimatedMinutes: 10,
      link: '/career-studio/cover-letter',
    },
    'applications:first': {
      title: 'Submit Your First Application',
      description: 'Apply to a position with your tailored materials',
      priority: 'high',
      estimatedMinutes: 30,
    },
    'skills:assessment': {
      title: 'Complete Skills Assessment',
      description: 'Identify your strengths and areas for growth',
      priority: 'medium',
      estimatedMinutes: 15,
      link: '/career-studio/assessment',
    },
    'skills:lex': {
      title: 'Chat with Lex',
      description: 'Get personalized career guidance from your AI advisor',
      priority: 'low',
      estimatedMinutes: 10,
      link: '/career-studio/lex',
    },
  };

  const key = `${sectionId}:${item.id}`;
  const template = stepMap[key];

  if (!template) return null;

  return {
    id: key,
    title: template.title || item.label,
    description: template.description || '',
    priority: template.priority || 'medium',
    estimatedMinutes: template.estimatedMinutes || 10,
    link: template.link,
  };
}

/**
 * Check and award achievements
 */
export function checkAchievements(activity: UserActivity): Achievement[] {
  const achievements: Achievement[] = [];
  const now = new Date().toISOString();

  // Resume achievements
  if (activity.resumeUploads >= 1) {
    achievements.push({
      id: 'first-resume',
      title: 'Resume Ready',
      description: 'Uploaded your first resume',
      earnedAt: now,
      icon: '📄',
    });
  }

  // Job analysis achievements
  if (activity.jobsAnalyzed >= 1) {
    achievements.push({
      id: 'first-analysis',
      title: 'Job Detective',
      description: 'Analyzed your first job posting',
      earnedAt: now,
      icon: '🔍',
    });
  }

  if (activity.jobsAnalyzed >= 10) {
    achievements.push({
      id: 'analysis-master',
      title: 'Analysis Master',
      description: 'Analyzed 10 job postings',
      earnedAt: now,
      icon: '🎯',
    });
  }

  // Cover letter achievements
  if (activity.coverLettersGenerated >= 1) {
    achievements.push({
      id: 'first-cover',
      title: 'Letter Writer',
      description: 'Generated your first cover letter',
      earnedAt: now,
      icon: '✉️',
    });
  }

  if (activity.coverLettersGenerated >= 5) {
    achievements.push({
      id: 'prolific-writer',
      title: 'Prolific Writer',
      description: 'Generated 5 cover letters',
      earnedAt: now,
      icon: '📝',
    });
  }

  // Application achievements
  if (activity.applicationsSubmitted >= 1) {
    achievements.push({
      id: 'first-app',
      title: 'First Step',
      description: 'Submitted your first application',
      earnedAt: now,
      icon: '🚀',
    });
  }

  if (activity.applicationsSubmitted >= 10) {
    achievements.push({
      id: 'persistent',
      title: 'Persistent',
      description: 'Submitted 10 applications',
      earnedAt: now,
      icon: '💪',
    });
  }

  // Lex conversation achievements
  if (activity.lexConversations >= 1) {
    achievements.push({
      id: 'lex-chat',
      title: 'Lex Friend',
      description: 'Had your first conversation with Lex',
      earnedAt: now,
      icon: '💬',
    });
  }

  return achievements;
}

/**
 * Calculate activity streak
 */
export function calculateStreak(activityDates: string[]): StreakInfo {
  if (activityDates.length === 0) {
    return { current: 0, longest: 0, lastActivity: null };
  }

  // Sort dates in descending order
  const sortedDates = [...activityDates]
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = sortedDates[0];
  lastActivity.setHours(0, 0, 0, 0);

  // Check if streak is still active (last activity today or yesterday)
  const daysSinceLastActivity = Math.floor(
    (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastActivity > 1) {
    // Streak is broken
    return {
      current: 0,
      longest: calculateLongestStreak(sortedDates),
      lastActivity: lastActivity.toISOString(),
    };
  }

  // Count current streak
  let currentStreak = 1;
  let expectedDate = new Date(lastActivity);

  for (let i = 1; i < sortedDates.length; i++) {
    expectedDate.setDate(expectedDate.getDate() - 1);
    const activityDate = new Date(sortedDates[i]);
    activityDate.setHours(0, 0, 0, 0);

    if (activityDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    current: currentStreak,
    longest: Math.max(currentStreak, calculateLongestStreak(sortedDates)),
    lastActivity: lastActivity.toISOString(),
  };
}

/**
 * Calculate longest streak from dates
 */
function calculateLongestStreak(sortedDates: Date[]): number {
  if (sortedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.floor(
      (sortedDates[i - 1].getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

/**
 * Build complete career progress
 */
export function buildCareerProgress(
  activity: UserActivity,
  activityDates: string[] = []
): CareerProgress {
  const sections: ProgressSection[] = [
    buildResumeProgress(activity),
    buildJobSearchProgress(activity),
    buildCoverLettersProgress(activity),
    buildApplicationsProgress(activity),
    buildSkillsProgress(activity),
  ];

  const overall = calculateOverallProgress(sections);
  const nextSteps = generateNextSteps(sections);
  const achievements = checkAchievements(activity);
  const streak = calculateStreak(activityDates);

  return {
    overall,
    sections,
    nextSteps,
    achievements,
    streak,
  };
}

/**
 * Get progress summary text
 */
export function getProgressSummary(progress: CareerProgress): string {
  if (progress.overall === 0) {
    return "Let's get started on your career journey!";
  } else if (progress.overall < 25) {
    return "You're just getting started. Keep building momentum!";
  } else if (progress.overall < 50) {
    return "Great progress! You're building a solid foundation.";
  } else if (progress.overall < 75) {
    return "Excellent work! You're well on your way.";
  } else if (progress.overall < 100) {
    return "Almost there! Just a few more steps to complete.";
  } else {
    return "Congratulations! You've completed all major milestones.";
  }
}
