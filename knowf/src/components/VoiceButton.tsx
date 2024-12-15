// components/VoiceButton.tsx
import { useState } from "react";
import { SpeechInput } from "@/components/SpeechInput";
import { debug } from "@/lib/debug";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  sessionId: string;
  size?: "small" | "large";
  onSend?: (text: string) => void; // Optional callback for direct sending
}

export function VoiceButton({
  onTranscript,
  sessionId,
  size = "small",
  onSend,
}: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);

  const handleTranscript = (text: string) => {
    setIsRecording(false);
    onTranscript(text);
    if (onSend) {
      onSend(text);
    }
  };

  // Size-specific styles
  const sizeStyles = {
    small: {
      button: "w-10 h-10",
      container: "flex items-center justify-center",
      text: "text-sm",
    },
    large: {
      button: "w-[300px] h-[300px]",
      container: "flex items-center justify-center w-full h-full",
      text: "text-4xl",
    },
  };

  const styles = sizeStyles[size];

  const baseStyle = {
    borderRadius: "50%",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "none",
  };

  return (
    <div className={styles.container}>
      <SpeechInput
        onTranscript={handleTranscript}
        sessionId={sessionId}
        className={`${
          styles.button
        } rounded-full transition-colors flex items-center justify-center text-white font-bold cursor-pointer ${
          isRecording
            ? "bg-red-500 hover:bg-red-600"
            : "bg-[var(--accent-9)] hover:bg-[var(--accent-10)]"
        } ${styles.text}`}
        buttonStyle={baseStyle}
        buttonText={isRecording ? "Click to Send" : "Click to Speak"}
        isRecording={isRecording}
        onRecordingStateChange={setIsRecording}
      />
    </div>
  );
}
