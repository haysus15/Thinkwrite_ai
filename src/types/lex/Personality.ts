// Lex Personality Types
// src/types/lex/Personality.ts

export type PersonalityMode = 'mentor' | 'coach' | 'advisor' | 'friend' | 'expert';
export type CommunicationStyle = 'direct' | 'supportive' | 'analytical' | 'motivational';
export type ToneLevel = 'casual' | 'professional' | 'formal';

export interface LexPersonality {
  id: string;
  userId: string;

  // Core personality settings
  mode: PersonalityMode;
  communicationStyle: CommunicationStyle;
  toneLevel: ToneLevel;

  // Behavior settings
  verbosity: 'concise' | 'balanced' | 'detailed';
  encouragementLevel: 'minimal' | 'moderate' | 'high';
  challengeLevel: 'gentle' | 'balanced' | 'tough_love';
  humorLevel: 'none' | 'light' | 'frequent';

  // Preferences
  useEmojis: boolean;
  askFollowUps: boolean;
  provideSources: boolean;
  offerAlternatives: boolean;

  // Custom instructions
  customInstructions?: string;
  avoidTopics?: string[];
  focusAreas?: string[];

  // Context memory
  rememberedContext?: {
    careerGoals?: string;
    currentChallenges?: string;
    preferredIndustries?: string[];
    skills?: string[];
    workStyle?: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface LexPersonalityDB {
  id: string;
  user_id: string;
  mode: PersonalityMode;
  communication_style: CommunicationStyle;
  tone_level: ToneLevel;
  verbosity: LexPersonality['verbosity'];
  encouragement_level: LexPersonality['encouragementLevel'];
  challenge_level: LexPersonality['challengeLevel'];
  humor_level: LexPersonality['humorLevel'];
  use_emojis: boolean;
  ask_follow_ups: boolean;
  provide_sources: boolean;
  offer_alternatives: boolean;
  custom_instructions?: string;
  avoid_topics?: string[];
  focus_areas?: string[];
  remembered_context?: LexPersonality['rememberedContext'];
  created_at: string;
  updated_at: string;
}

// Personality mode descriptions for UI
export const PERSONALITY_MODES: Record<PersonalityMode, {
  name: string;
  description: string;
  icon: string;
  traits: string[];
}> = {
  mentor: {
    name: 'Mentor',
    description: 'Experienced guide sharing wisdom and career advice',
    icon: '🎓',
    traits: ['Wise', 'Patient', 'Supportive', 'Strategic'],
  },
  coach: {
    name: 'Coach',
    description: 'Action-oriented partner pushing you toward your goals',
    icon: '🏆',
    traits: ['Motivating', 'Goal-focused', 'Accountable', 'Energetic'],
  },
  advisor: {
    name: 'Advisor',
    description: 'Professional consultant with data-driven insights',
    icon: '📊',
    traits: ['Analytical', 'Objective', 'Research-based', 'Strategic'],
  },
  friend: {
    name: 'Friend',
    description: 'Supportive companion for your career journey',
    icon: '🤝',
    traits: ['Empathetic', 'Encouraging', 'Understanding', 'Casual'],
  },
  expert: {
    name: 'Expert',
    description: 'Deep specialist in career development and job search',
    icon: '🎯',
    traits: ['Knowledgeable', 'Precise', 'Thorough', 'Technical'],
  },
};

export const COMMUNICATION_STYLES: Record<CommunicationStyle, {
  name: string;
  description: string;
}> = {
  direct: {
    name: 'Direct',
    description: 'Straight to the point, no fluff',
  },
  supportive: {
    name: 'Supportive',
    description: 'Encouraging and empathetic',
  },
  analytical: {
    name: 'Analytical',
    description: 'Data-driven and logical',
  },
  motivational: {
    name: 'Motivational',
    description: 'Inspiring and energizing',
  },
};

// Default personality settings
export function getDefaultPersonality(userId: string): LexPersonality {
  return {
    id: `lex_personality_${Date.now()}`,
    userId,
    mode: 'mentor',
    communicationStyle: 'supportive',
    toneLevel: 'professional',
    verbosity: 'balanced',
    encouragementLevel: 'moderate',
    challengeLevel: 'balanced',
    humorLevel: 'light',
    useEmojis: true,
    askFollowUps: true,
    provideSources: true,
    offerAlternatives: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Transform functions
export function transformPersonalityFromDB(db: LexPersonalityDB): LexPersonality {
  return {
    id: db.id,
    userId: db.user_id,
    mode: db.mode,
    communicationStyle: db.communication_style,
    toneLevel: db.tone_level,
    verbosity: db.verbosity,
    encouragementLevel: db.encouragement_level,
    challengeLevel: db.challenge_level,
    humorLevel: db.humor_level,
    useEmojis: db.use_emojis,
    askFollowUps: db.ask_follow_ups,
    provideSources: db.provide_sources,
    offerAlternatives: db.offer_alternatives,
    customInstructions: db.custom_instructions,
    avoidTopics: db.avoid_topics,
    focusAreas: db.focus_areas,
    rememberedContext: db.remembered_context,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformPersonalityToDB(personality: Partial<LexPersonality>): Partial<LexPersonalityDB> {
  const db: Partial<LexPersonalityDB> = {};

  if (personality.userId) db.user_id = personality.userId;
  if (personality.mode) db.mode = personality.mode;
  if (personality.communicationStyle) db.communication_style = personality.communicationStyle;
  if (personality.toneLevel) db.tone_level = personality.toneLevel;
  if (personality.verbosity) db.verbosity = personality.verbosity;
  if (personality.encouragementLevel) db.encouragement_level = personality.encouragementLevel;
  if (personality.challengeLevel) db.challenge_level = personality.challengeLevel;
  if (personality.humorLevel) db.humor_level = personality.humorLevel;
  if (personality.useEmojis !== undefined) db.use_emojis = personality.useEmojis;
  if (personality.askFollowUps !== undefined) db.ask_follow_ups = personality.askFollowUps;
  if (personality.provideSources !== undefined) db.provide_sources = personality.provideSources;
  if (personality.offerAlternatives !== undefined) db.offer_alternatives = personality.offerAlternatives;
  if (personality.customInstructions !== undefined) db.custom_instructions = personality.customInstructions;
  if (personality.avoidTopics !== undefined) db.avoid_topics = personality.avoidTopics;
  if (personality.focusAreas !== undefined) db.focus_areas = personality.focusAreas;
  if (personality.rememberedContext !== undefined) db.remembered_context = personality.rememberedContext;

  return db;
}
