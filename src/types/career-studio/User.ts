// User Types for Career Studio
// src/types/career-studio/User.ts

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  portfolio?: string;
  currentRole?: string;
  currentCompany?: string;
  yearsExperience?: number;
  industries?: string[];
  skills?: string[];
  targetRoles?: string[];
  targetIndustries?: string[];
  targetSalary?: {
    min: number;
    max: number;
    currency: string;
  };
  workPreferences?: {
    remote: boolean;
    hybrid: boolean;
    onsite: boolean;
    willingToRelocate: boolean;
    preferredLocations?: string[];
  };
  jobSearchStatus?: 'active' | 'passive' | 'not_looking' | 'employed_open';
  completedOnboarding: boolean;
  onboardingStep?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileDB {
  id: string;
  user_id: string;
  display_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  portfolio?: string;
  current_role?: string;
  current_company?: string;
  years_experience?: number;
  industries?: string[];
  skills?: string[];
  target_roles?: string[];
  target_industries?: string[];
  target_salary?: UserProfile['targetSalary'];
  work_preferences?: UserProfile['workPreferences'];
  job_search_status?: UserProfile['jobSearchStatus'];
  completed_onboarding: boolean;
  onboarding_step?: number;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  userId: string;
  notifications: {
    email: boolean;
    jobAlerts: boolean;
    applicationReminders: boolean;
    weeklyDigest: boolean;
  };
  privacy: {
    profileVisible: boolean;
    shareAnalytics: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
  };
  mirrorMode?: {
    enabled: boolean;
    autoLearn: boolean;
    sources: {
      coverLetters: boolean;
      lexChat: boolean;
      resumeBuilder: boolean;
      tailoredResumes: boolean;
    };
  };
}

export interface UserActivity {
  userId: string;
  resumeUploads: number;
  resumeEdits: number;
  jobsAnalyzed: number;
  jobsSaved: number;
  coverLettersGenerated: number;
  applicationsSubmitted: number;
  assessmentsCompleted: number;
  lexConversations: number;
  lastActive: string | null;
  activityDates: string[];
}

// Transform functions
export function transformUserProfileFromDB(db: UserProfileDB): UserProfile {
  return {
    id: db.id,
    userId: db.user_id,
    displayName: db.display_name,
    headline: db.headline,
    bio: db.bio,
    location: db.location,
    phone: db.phone,
    linkedin: db.linkedin,
    website: db.website,
    portfolio: db.portfolio,
    currentRole: db.current_role,
    currentCompany: db.current_company,
    yearsExperience: db.years_experience,
    industries: db.industries,
    skills: db.skills,
    targetRoles: db.target_roles,
    targetIndustries: db.target_industries,
    targetSalary: db.target_salary,
    workPreferences: db.work_preferences,
    jobSearchStatus: db.job_search_status,
    completedOnboarding: db.completed_onboarding,
    onboardingStep: db.onboarding_step,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformUserProfileToDB(profile: Partial<UserProfile>): Partial<UserProfileDB> {
  const db: Partial<UserProfileDB> = {};

  if (profile.userId) db.user_id = profile.userId;
  if (profile.displayName !== undefined) db.display_name = profile.displayName;
  if (profile.headline !== undefined) db.headline = profile.headline;
  if (profile.bio !== undefined) db.bio = profile.bio;
  if (profile.location !== undefined) db.location = profile.location;
  if (profile.phone !== undefined) db.phone = profile.phone;
  if (profile.linkedin !== undefined) db.linkedin = profile.linkedin;
  if (profile.website !== undefined) db.website = profile.website;
  if (profile.portfolio !== undefined) db.portfolio = profile.portfolio;
  if (profile.currentRole !== undefined) db.current_role = profile.currentRole;
  if (profile.currentCompany !== undefined) db.current_company = profile.currentCompany;
  if (profile.yearsExperience !== undefined) db.years_experience = profile.yearsExperience;
  if (profile.industries !== undefined) db.industries = profile.industries;
  if (profile.skills !== undefined) db.skills = profile.skills;
  if (profile.targetRoles !== undefined) db.target_roles = profile.targetRoles;
  if (profile.targetIndustries !== undefined) db.target_industries = profile.targetIndustries;
  if (profile.targetSalary !== undefined) db.target_salary = profile.targetSalary;
  if (profile.workPreferences !== undefined) db.work_preferences = profile.workPreferences;
  if (profile.jobSearchStatus !== undefined) db.job_search_status = profile.jobSearchStatus;
  if (profile.completedOnboarding !== undefined) db.completed_onboarding = profile.completedOnboarding;
  if (profile.onboardingStep !== undefined) db.onboarding_step = profile.onboardingStep;

  return db;
}
