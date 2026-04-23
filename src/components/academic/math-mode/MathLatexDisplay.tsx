"use client";

import { useMemo } from "react";
import katex from "katex";

export default function MathLatexDisplay({
  latex,
  className,
}: {
  latex: string;
  className?: string;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return "";
    }
  }, [latex]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
