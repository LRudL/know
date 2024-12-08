import React, { useState, useRef } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";

interface SpeechInputProps {
  onTranscript: (text: string) => void;
  sessionId: string;
  className?: string;
}

export const SpeechInput: React.FC<SpeechInputProps> = ({
  onTranscript,
  sessionId,
  className = "",
}) => {
  const [error, setError] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isListening, setIsListening] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendAudioToGoogle(audioBlob);
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsListening(true);
      setError("");
    } catch (err) {
      debug.error("Error starting recording:", err);
      setError("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsListening(false);
    }
  };

  const sendAudioToGoogle = async (audioBlob: Blob) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No auth session");

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];

        try {
          const response = await fetch("/api/speech-to-text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audio: base64Audio,
              session_id: sessionId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Speech recognition failed");
          }

          const { text } = await response.json();
          if (text) {
            onTranscript(text);
            setError("");
          } else {
            debug.warn("No text returned from speech recognition");
            setError("No speech detected");
          }
        } catch (err) {
          debug.error("Error in speech recognition:", err);
          setError("Speech recognition failed");
        }
      };
    } catch (err) {
      debug.error("Error in speech recognition:", err);
      setError("Speech recognition failed");
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={isListening ? stopRecording : startRecording}
        className={`p-2 rounded-full transition-colors ${
          isListening
            ? "bg-red-500 hover:bg-red-600"
            : "bg-blue-500 hover:bg-blue-600"
        } text-white`}
        title={isListening ? "Stop recording" : "Start recording"}
      >
        {isListening ? (
          <StopIcon className="h-5 w-5" />
        ) : (
          <MicrophoneIcon className="h-5 w-5" />
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-1 text-red-500 text-sm whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};
