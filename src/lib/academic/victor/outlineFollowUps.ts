export const FOLLOW_UP_MESSAGES = {
  topic_not_argument: (studentResponse: string, topic: string) =>
    `"${studentResponse.slice(0, 60)}${studentResponse.length > 60 ? "..." : ""}" describes the subject — but what is your argument about it?\n\nA thesis is a claim someone could reasonably disagree with. Try completing this: "I argue that [specific position] because [reason]."\n\nFor a paper on ${topic}, what specific position do you want to defend?`,

  too_short: () =>
    "Tell me more — I need a complete thought to work with, not just a phrase. What are you actually trying to say?",

  too_vague: (topic: string) =>
    `I need at least two distinct points I can build sections around. What are the specific arguments that support your thesis about ${topic}? Try listing them out, even roughly.`,

  no_counterargument: (thesis: string) =>
    `Let me help you find one. Your thesis argues that ${thesis}.\n\nSomeone who disagrees might say: the evidence is mixed, or that other factors matter more, or that the opposite approach is better.\n\nWhich of those feels most relevant to address in your paper — or do you see a different objection?`,

  missing_requirement: (gap: string) =>
    `Your outline is missing something your assignment requires: ${gap}.\n\nWhere would that fit in your current structure? We can add a section for it or incorporate it into an existing one.`,
} as const;
