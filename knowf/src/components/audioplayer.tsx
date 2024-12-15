import { debug } from "@/lib/debug";
import React, { useEffect, useRef } from "react";

interface AudioPlayerProps {
  text: string;
  onError?: (error: Error) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, onError }) => {
  const audioContext = useRef<AudioContext | null>(null);
  const isPlaying = useRef(false);
  const audioQueue = useRef<AudioBuffer[]>([]);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContext.current) {
        audioContext.current = new AudioContext();
      }
      document.removeEventListener("click", initAudio);
    };

    document.addEventListener("click", initAudio);
    return () => {
      document.removeEventListener("click", initAudio);
      audioContext.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!text || !audioContext.current) return;

    const synthesizeSpeech = async () => {
      try {
        const response = await fetch(
          "https://texttospeech.googleapis.com/v1/text:synthesize",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_API_KEY!,
            },
            body: JSON.stringify({
              input: { text },
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

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const { audioContent } = await response.json();
        const audioBuffer = await decodeAudioData(audioContent);

        audioQueue.current.push(audioBuffer);
        if (!isPlaying.current) {
          playNextInQueue();
        }
      } catch (error) {
        debug.error("Speech synthesis error:", error);
        onError?.(error as Error);
      }
    };

    synthesizeSpeech();
  }, [text, onError]);

  const decodeAudioData = async (base64Audio: string) => {
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return await audioContext.current!.decodeAudioData(bytes.buffer);
  };

  const playNextInQueue = () => {
    if (audioQueue.current.length === 0) {
      isPlaying.current = false;
      return;
    }

    isPlaying.current = true;
    const audioBuffer = audioQueue.current.shift()!;
    const source = audioContext.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current!.destination);
    source.onended = playNextInQueue;
    source.start(0);
  };

  return null;
};
