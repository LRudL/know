import { debug } from "@/lib/debug";
import React, { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  text: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const textBufferRef = useRef<string>("");
  const [needsUserActivation, setNeedsUserActivation] = useState(false);

  const initializeAudioContext = () => {
    try {
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") {
        setNeedsUserActivation(true);
      }
    } catch (error) {
      debug.error("Failed to initialize AudioContext:", error);
    }
  };

  const handleUserActivation = async () => {
    try {
      await audioContextRef.current?.resume();
      setNeedsUserActivation(false);
    } catch (error) {
      debug.error("Failed to resume AudioContext:", error);
    }
  };

  useEffect(() => {
    initializeAudioContext();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!text) {
      return;
    }
    if (!audioContextRef.current) {
      return;
    }

    // Clean the text by replacing both escaped and regular newlines with spaces
    const cleanedText = text
      .replace(/\\n/g, " ") // Replace escaped newlines
      .replace(/\n/g, " ") // Replace regular newlines
      .replace(/\s+/g, " "); // Collapse multiple spaces

    // Append cleaned text to buffer
    textBufferRef.current += cleanedText;

    // Split buffer into sentences using regex that matches sentence endings
    const sentences = textBufferRef.current.match(/[^.!?]+[.!?]+/g) || [];

    // If we have complete sentences, process them
    if (sentences.length > 0) {
      // Update buffer to keep any remaining incomplete sentence
      const lastChar = textBufferRef.current[textBufferRef.current.length - 1];
      const lastSentenceBoundary = Math.max(
        textBufferRef.current.lastIndexOf("."),
        textBufferRef.current.lastIndexOf("!"),
        textBufferRef.current.lastIndexOf("?")
      );
      textBufferRef.current = /[.!?]/.test(lastChar)
        ? ""
        : textBufferRef.current.slice(lastSentenceBoundary + 1);

      // Process each complete sentence
      sentences.forEach((sentence) => synthesizeSpeech(sentence.trim()));
    }
  }, [text]);

  const synthesizeSpeech = async (sentence: string) => {
    try {
      // Log the API key presence (not the actual key)
      // debug.log("API Key:", process.env.NEXT_PUBLIC_GOOGLE_API_KEY);

      const response = await fetch(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_API_KEY!,
          },
          body: JSON.stringify({
            input: { text: sentence },
            voice: {
              languageCode: "en-GB",
              name: "en-GB-Standard-A",
              ssmlGender: "FEMALE",
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: 1.0,
              pitch: 0.0,
            },
          }),
        }
      );

      if (!response.ok) {
        // Get more error details
        const errorData = await response.json().catch(() => null);
        debug.error("API Error Details:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${JSON.stringify(
            errorData
          )}`
        );
      }

      const { audioContent } = await response.json();

      // Convert base64 to ArrayBuffer
      const binaryString = window.atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContextRef.current!.decodeAudioData(
        bytes.buffer
      );
      audioQueueRef.current.push(audioBuffer);

      if (!isPlayingRef.current) {
        playNextInQueue();
      }
    } catch (error) {
      console.error("[AudioPlayer] Error synthesizing speech:", error);
    }
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = playNextInQueue;
    source.start(0);
  };

  return (
    <>
      {needsUserActivation && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={handleUserActivation}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
          >
            Enable Audio
          </button>
        </div>
      )}
    </>
  );
};
