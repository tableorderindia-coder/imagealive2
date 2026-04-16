// @ts-nocheck
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function ARViewer({ projectId }: { projectId: string }) {
  const [projectData, setProjectData] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [opacity, setOpacity] = useState(0.85);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch project data
  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (data) setProjectData(data);
    }
    loadProject();
  }, [projectId]);

  // Initialize rear camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cameraRef.current) {
          cameraRef.current.srcObject = stream;
          cameraRef.current.play();
        }
      } catch (err) {
        console.warn('Camera access denied or not available:', err);
      }
    }
    startCamera();

    return () => {
      // Cleanup camera stream on unmount
      if (cameraRef.current?.srcObject) {
        (cameraRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      // Fade guide after 2 seconds
      setTimeout(() => setShowGuide(false), 2000);
    }
  }, []);

  const handlePause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowGuide(true);
    }
  }, []);

  if (!projectData) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading experience...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden select-none" style={{ touchAction: 'none' }}>
      {/* Camera Feed (background) */}
      <video
        ref={cameraRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(1)' }}
      />

      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Center Frame Area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="relative" 
          style={{ 
            width: '80vw', 
            maxWidth: '400px',
            aspectRatio: 'auto',
          }}
        >
          {/* Guide Image (semi-transparent reference of the uploaded photo) */}
          {showGuide && (
            <img
              src={projectData.image_url}
              alt="Align guide"
              className="w-full h-auto rounded-lg transition-opacity duration-700"
              style={{ 
                opacity: isPlaying ? 0.15 : 0.4,
                border: '3px solid rgba(255,255,255,0.6)',
                boxShadow: '0 0 30px rgba(255,255,255,0.15)',
              }}
            />
          )}

          {/* Video Overlay (plays right on top of the guide) */}
          <video
            ref={videoRef}
            src={projectData.video_url}
            crossOrigin="anonymous"
            loop
            playsInline
            muted
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover rounded-lg transition-opacity duration-500"
            style={{ 
              opacity: isPlaying ? opacity : 0,
              border: '3px solid rgba(255,255,255,0.8)',
              boxShadow: '0 0 40px rgba(255,255,255,0.2), 0 0 80px rgba(100,150,255,0.1)',
            }}
          />

          {/* Decorative Frame Corners */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-sm pointer-events-none" style={{ borderWidth: '3px 0 0 3px' }} />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-sm pointer-events-none" style={{ borderWidth: '3px 3px 0 0' }} />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-sm pointer-events-none" style={{ borderWidth: '0 0 3px 3px' }} />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-sm pointer-events-none" style={{ borderWidth: '0 3px 3px 0' }} />
        </div>
      </div>

      {/* Top instruction bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <p className="text-white text-center text-sm font-medium tracking-wide">
          {isPlaying 
            ? '✨ Photo is alive! Tap pause to stop.' 
            : '📸 Align the frame over your printed photo, then tap Play'}
        </p>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-10 flex flex-col items-center gap-4">
        {/* Opacity slider (only when playing) */}
        {isPlaying && (
          <div className="flex items-center gap-3 w-full max-w-xs">
            <span className="text-white/60 text-xs">Blend</span>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-white/60 text-xs">{Math.round(opacity * 100)}%</span>
          </div>
        )}

        {/* Play / Pause button */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="pointer-events-auto py-3 px-10 rounded-full font-bold text-lg shadow-2xl transition-all duration-300 active:scale-95"
          style={{
            background: isPlaying 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white',
            boxShadow: isPlaying 
              ? '0 4px 30px rgba(239,68,68,0.4)' 
              : '0 4px 30px rgba(34,197,94,0.4)',
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <p className="text-white/40 text-xs">FrameAlive™</p>
      </div>
    </div>
  );
}
