export type MathfieldElement = HTMLElement & {
  value: string;
  readOnly?: boolean;
  focus: () => void;
  insert?: (value: string) => void;
  executeCommand?: (command: string) => void;
  keystroke?: (key: string) => void;
};

export type MathfieldElementConstructor = new () => MathfieldElement;

export function getMathfieldElementConstructor(
  win: Window
): MathfieldElementConstructor | null {
  const candidate = (
    win as unknown as { MathfieldElement?: MathfieldElementConstructor }
  ).MathfieldElement;
  return candidate ?? null;
}
