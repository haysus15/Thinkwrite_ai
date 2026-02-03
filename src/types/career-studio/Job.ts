// Job Types for Career Studio
// src/types/career-studio/Job.ts

export type JobStatus = 'interested' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn' | 'archived';
export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'interview_scheduled' | 'interview_completed' | 'offer_received' | 'accepted' | 'rejected' | 'withdrawn';

export interface Job {
  id: string;
  userId: string;
  title: string;
  company: string;
  location?: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'annual' | 'monthly';
  };
  jobType?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'freelance' | 'internship';
  workMode?: 'remote' | 'hybrid' | 'onsite';
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
  sourceUrl?: string;
  sourceType: 'url' | 'text' | 'manual';
  applicationEmail?: string;
  applicationUrl?: string;
  status: JobStatus;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  tags?: string[];
  isSaved: boolean;
  hasApplied: boolean;
  appliedAt?: string;
  deadline?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobDB {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location?: string;
  salary?: Job['salary'];
  job_type?: Job['jobType'];
  work_mode?: Job['workMode'];
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
  source_url?: string;
  source_type: Job['sourceType'];
  application_email?: string;
  application_url?: string;
  status: JobStatus;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  tags?: string[];
  is_saved: boolean;
  has_applied: boolean;
  applied_at?: string;
  deadline?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  userId: string;
  jobId: string;
  resumeId?: string;
  coverLetterId?: string;
  tailoredResumeId?: string;
  status: ApplicationStatus;
  submittedAt?: string;
  notes?: string;
  followUpHistory?: FollowUp[];
  interviews?: Interview[];
  offers?: JobOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  type: 'email' | 'call' | 'linkedin' | 'other';
  date: string;
  notes?: string;
  response?: string;
}

export interface Interview {
  id: string;
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'behavioral' | 'panel';
  scheduledAt: string;
  duration?: number;
  interviewers?: string[];
  notes?: string;
  feedback?: string;
  outcome?: 'passed' | 'failed' | 'pending';
}

export interface JobOffer {
  id: string;
  receivedAt: string;
  expiresAt?: string;
  salary: {
    base: number;
    bonus?: number;
    equity?: string;
    currency: string;
  };
  startDate?: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined' | 'negotiating' | 'expired';
}

export interface JobSearchFilters {
  status?: JobStatus[];
  priority?: ('high' | 'medium' | 'low')[];
  workMode?: ('remote' | 'hybrid' | 'onsite')[];
  jobType?: Job['jobType'][];
  isSaved?: boolean;
  hasApplied?: boolean;
  searchQuery?: string;
  sortBy?: 'created_at' | 'updated_at' | 'company' | 'title' | 'deadline';
  sortOrder?: 'asc' | 'desc';
}

// Transform functions
export function transformJobFromDB(db: JobDB): Job {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    company: db.company,
    location: db.location,
    salary: db.salary,
    jobType: db.job_type,
    workMode: db.work_mode,
    description: db.description,
    requirements: db.requirements,
    responsibilities: db.responsibilities,
    benefits: db.benefits,
    sourceUrl: db.source_url,
    sourceType: db.source_type,
    applicationEmail: db.application_email,
    applicationUrl: db.application_url,
    status: db.status,
    priority: db.priority,
    notes: db.notes,
    tags: db.tags,
    isSaved: db.is_saved,
    hasApplied: db.has_applied,
    appliedAt: db.applied_at,
    deadline: db.deadline,
    followUpDate: db.follow_up_date,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformJobToDB(job: Partial<Job>): Partial<JobDB> {
  const db: Partial<JobDB> = {};

  if (job.userId) db.user_id = job.userId;
  if (job.title !== undefined) db.title = job.title;
  if (job.company !== undefined) db.company = job.company;
  if (job.location !== undefined) db.location = job.location;
  if (job.salary !== undefined) db.salary = job.salary;
  if (job.jobType !== undefined) db.job_type = job.jobType;
  if (job.workMode !== undefined) db.work_mode = job.workMode;
  if (job.description !== undefined) db.description = job.description;
  if (job.requirements !== undefined) db.requirements = job.requirements;
  if (job.responsibilities !== undefined) db.responsibilities = job.responsibilities;
  if (job.benefits !== undefined) db.benefits = job.benefits;
  if (job.sourceUrl !== undefined) db.source_url = job.sourceUrl;
  if (job.sourceType !== undefined) db.source_type = job.sourceType;
  if (job.applicationEmail !== undefined) db.application_email = job.applicationEmail;
  if (job.applicationUrl !== undefined) db.application_url = job.applicationUrl;
  if (job.status !== undefined) db.status = job.status;
  if (job.priority !== undefined) db.priority = job.priority;
  if (job.notes !== undefined) db.notes = job.notes;
  if (job.tags !== undefined) db.tags = job.tags;
  if (job.isSaved !== undefined) db.is_saved = job.isSaved;
  if (job.hasApplied !== undefined) db.has_applied = job.hasApplied;
  if (job.appliedAt !== undefined) db.applied_at = job.appliedAt;
  if (job.deadline !== undefined) db.deadline = job.deadline;
  if (job.followUpDate !== undefined) db.follow_up_date = job.followUpDate;

  return db;
}
