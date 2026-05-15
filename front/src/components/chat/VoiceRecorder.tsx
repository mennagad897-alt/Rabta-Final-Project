import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, onCancel }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0);
  const [hasStarted, setHasStarted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setHasStarted(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (isCancelledRef.current) return;
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          onRecordingComplete(audioBlob, recordingTimeRef.current);
        };

        mediaRecorder.start();
        
        timerIntervalRef.current = setInterval(() => {
          recordingTimeRef.current += 1;
          setRecordingTime(recordingTimeRef.current);
        }, 1000);
        
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Could not access microphone. Please check permissions.');
        setHasStarted(false);
        if (mounted) onCancel();
      }
    };

    init();

    return () => {
      mounted = false;
      isCancelledRef.current = true;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);



  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setHasStarted(false);
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center w-full gap-3 py-1 animate-in fade-in zoom-in-95 duration-200">
      {hasStarted ? (
        <div className="flex items-center justify-between w-full bg-red-50 dark:bg-red-500/10 px-4 py-1.5 rounded-full border border-red-100 dark:border-red-500/20">
          <div className="flex items-center gap-2 text-red-500 font-medium">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            {formatTime(recordingTime)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Cancel"
            >
              <span className="material-icons-round text-xl">delete</span>
            </button>
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm"
              title="Stop Recording"
            >
              <span className="material-icons-round text-sm">stop</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
