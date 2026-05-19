import React, { useEffect, useRef } from 'react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check your permissions.");
      onClose();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to Blob and then File
        canvas.toBlob((blob) => {
          if (blob) {
            const fileName = `camera_capture_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            onCapture(file);
            stopCamera();
            onClose();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#171717] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <h2 className="text-xl font-bold text-[#F5F5F5]">Take a Photo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Camera View */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          ></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>

        {/* Controls */}
        <div className="px-6 py-6 flex items-center justify-center bg-[#171717]">
          <button 
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-1 cursor-pointer hover:scale-105 transition-transform shadow-lg border-[3px] border-[#7C3AED]"
          >
            <div className="w-full h-full rounded-full bg-[#7C3AED]"></div>
          </button>
        </div>
      </div>
    </div>
  );
};
