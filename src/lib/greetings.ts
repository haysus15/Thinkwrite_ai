export type StudioPersona = "victor" | "travis" | "lex" | "ursie";

type TimeSlot =
  | "earlyMorning"
  | "midday"
  | "afternoon"
  | "evening"
  | "lateNight"
  | "nightOwl"
  | "unhingedHours";

function getTimeSlot(): TimeSlot {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "earlyMorning";
  if (hour >= 11 && hour < 13) return "midday";
  if (hour >= 13 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  if (hour >= 20 && hour < 23) return "lateNight";
  if (hour >= 23 || hour < 2) return "nightOwl";
  return "unhingedHours";
}

const GREETINGS: Record<StudioPersona, Record<TimeSlot, string>> = {
  victor: {
    earlyMorning: "The early mind is the sharpest one, {name}. What are we examining today?",
    midday: "Peak clarity, {name}. What question deserves your focus right now?",
    afternoon: "The afternoon is underrated, {name}. Some of the best thinking happens here.",
    evening: "The day has given you material to work with, {name}. Let us examine it.",
    lateNight: "Dedication noted, {name}. Even Aristotle eventually slept.",
    nightOwl: "This is either genius or stubbornness, {name}. Victor suspects both.",
    unhingedHours: "{name}. It is {hour}am. The library is closed. Victor is not.",
  },
  travis: {
    earlyMorning: "Up early, {name}. Good. Let's get ahead of today.",
    midday: "Midday check-in, {name}. What still needs handling?",
    afternoon: "Afternoon, {name}. The to-do list does not review itself.",
    evening: "End of day, {name}. Let's see where things stand.",
    lateNight: "Still at it, {name}. Travis respects the commitment.",
    nightOwl: "{name}. The agenda can wait until morning. Mostly.",
    unhingedHours: "{name}. It is {hour}am. Travis is flagging this as a risk.",
  },
  lex: {
    earlyMorning: "First mover advantage, {name}. Good time to be up.",
    midday: "Midday, {name}. The market does not stop. Neither do you.",
    afternoon: "Afternoon grind, {name}. What are we building today?",
    evening: "After hours, {name}. Lex respects the hustle.",
    lateNight: "The market closes. Lex does not. What are we working on?",
    nightOwl: "Late-night strategy session, {name}. Lex is here for it.",
    unhingedHours: "{name}. It is {hour}am. Even the ambitious need sleep. What's the deadline?",
  },
  ursie: {
    earlyMorning: "Your voice is clearest before the noise starts, {name}.",
    midday: "The day is in full motion, {name}. Your words can keep up.",
    afternoon: "Good afternoon, {name}. The afternoon has its own rhythm.",
    evening: "The day shaped you, {name}. Let's capture what it left behind.",
    lateNight: "Night writing hits different, {name}. Ursie is listening.",
    nightOwl: "The quiet hours belong to the writers, {name}.",
    unhingedHours: "{name}. It is {hour}am. The voice that speaks this late means something.",
  },
};

export function getPersonaGreeting(persona: StudioPersona, name: string): string {
  const slot = getTimeSlot();
  const hour = new Date().getHours();
  const template = GREETINGS[persona][slot];
  return template
    .replace("{name}", name || "there")
    .replace("{hour}", String(hour === 0 ? 12 : hour > 12 ? hour - 12 : hour));
}
