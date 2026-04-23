// VOICE DISCONNECTED — Mirror Mode ships standalone. Reconnect via API contract.
"use client";

interface Props {
  content: string;
  contentType: string;
  onClose: () => void;
  onTransformed: (newContent: string) => void;
}

export function VoiceTransformModal({ onClose }: Props) {
  return <div>{/* Voice features connect when Mirror Mode standalone is integrated */}</div>;
}
