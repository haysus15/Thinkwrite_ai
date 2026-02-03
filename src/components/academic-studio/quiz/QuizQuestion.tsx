// src/components/academic-studio/quiz/QuizQuestion.tsx
"use client";

import type { QuizQuestion as QuizQuestionType } from "@/types/academic-studio";
import MultipleChoiceQuestion from "./questions/MultipleChoiceQuestion";
import TrueFalseQuestion from "./questions/TrueFalseQuestion";
import ShortAnswerQuestion from "./questions/ShortAnswerQuestion";
import EssayQuestion from "./questions/EssayQuestion";

interface QuizQuestionProps {
  question: QuizQuestionType;
  answer: unknown;
  onAnswer: (value: unknown) => void;
}

export default function QuizQuestion({
  question,
  answer,
  onAnswer,
}: QuizQuestionProps) {
  switch (question.type) {
    case "multiple_choice":
      return (
        <MultipleChoiceQuestion
          question={question}
          answer={answer as string}
          onAnswer={onAnswer}
        />
      );
    case "true_false":
      return (
        <TrueFalseQuestion
          question={question}
          answer={answer as boolean | undefined}
          onAnswer={onAnswer}
        />
      );
    case "short_answer":
      return (
        <ShortAnswerQuestion
          question={question}
          answer={answer as string}
          onAnswer={onAnswer}
        />
      );
    case "essay":
      return (
        <EssayQuestion
          question={question}
          answer={answer as string}
          onAnswer={onAnswer}
        />
      );
    default:
      return null;
  }
}
