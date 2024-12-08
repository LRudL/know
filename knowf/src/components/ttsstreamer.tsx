import React, { useEffect, useRef, useState } from 'react';

interface TTSStreamerProps {
  text: string;
}

export const TTSStreamer: React.FC<TTSStreamerProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  
  useEffect(() => {
    //websocketRef.current = new WebSocket('ws://localhost:8000/ws/tts');
    console.log('[TTSStreamer] Initializing WebSocket connection');
    websocketRef.current = new WebSocket('ws://127.0.0.1:8000/ws/tts');
    audioContextRef.current = new AudioContext();
    
    websocketRef.current.onopen = () => {
      console.log('[TTSStreamer] WebSocket connection established');
    };
    
    websocketRef.current.onmessage = async (event) => {
      try {
        console.log('[TTSStreamer] Received audio data');
        const audioData = await event.data.arrayBuffer();
        console.log(`[TTSStreamer] Audio data size: ${audioData.byteLength} bytes`);
        const audioBuffer = await audioContextRef.current!.decodeAudioData(audioData);
        audioQueueRef.current.push(audioBuffer);
        
        if (!isPlaying) {
          playNextInQueue();
        }
      } catch (error) {
        console.error('[TTSStreamer] Error processing audio data:', error);
      }
    };
    
    return () => {
      websocketRef.current?.close();
      audioContextRef.current?.close();
    };
  }, []);
  
  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      setIsPlaying(false);
      return;
    }
    
    setIsPlaying(true);
    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = playNextInQueue;
    source.start(0);
  };
  
  useEffect(() => {
    if (text && websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ text }));
    }
  }, [text]);
  
  return (
    <div className="p-4">
      <div className="text-sm text-gray-600">
        {isPlaying ? 'Playing audio...' : 'Waiting for audio...'}
      </div>
    </div>
  );
};