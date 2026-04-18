'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getViewerMode } from '@/lib/ar-viewer';
import { calculateDefaultOverlayPlacement, getOverlayRenderMetrics } from '@/lib/overlay-placement';
import type { Database } from '@/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export default function ARViewer({ projectId }: { projectId: string }) {
  const [projectData, setProjectData] = useState<ProjectRow | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.92);
  const [guideOpacity, setGuideOpacity] = useState(0.35);
  const [manualModeEnabled, setManualModeEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const trackedVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackedSceneRef = useRef<HTMLElement | null>(null);
  const trackedTargetVisibleRef = useRef(false);
  const trackedPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      const project = data as ProjectRow | null;
      if (!isMounted || !project) return;

      setProjectData(project);
      setManualModeEnabled(getViewerMode(project) === 'manual');

      const img = new Image();
      img.src = project.image_url;
      img.onload = () => {
        if (!isMounted) return;
        setPhotoDimensions({
          width: img.width,
          height: img.height,
        });
        setImageAspectRatio(img.height / img.width || 1);
      };

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = project.video_url;
      video.onloadedmetadata = () => {
        if (!isMounted) return;
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
    }

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const viewerMode = useMemo(() => getViewerMode(projectData), [projectData]);
  const activePlacement = useMemo(() => {
    if (!projectData || !photoDimensions || !videoDimensions) return null;

    if (
      typeof projectData.overlay_x === 'number' &&
      typeof projectData.overlay_y === 'number' &&
      typeof projectData.overlay_scale === 'number'
    ) {
      return {
        x: projectData.overlay_x,
        y: projectData.overlay_y,
        scale: projectData.overlay_scale,
      };
    }

    return calculateDefaultOverlayPlacement({
      photoWidth: photoDimensions.width,
      photoHeight: photoDimensions.height,
      videoWidth: videoDimensions.width,
      videoHeight: videoDimensions.height,
    });
  }, [photoDimensions, projectData, videoDimensions]);

  const overlayMetrics = useMemo(() => {
    if (!photoDimensions || !videoDimensions || !activePlacement) return null;

    return getOverlayRenderMetrics({
      photoWidth: photoDimensions.width,
      photoHeight: photoDimensions.height,
      videoWidth: videoDimensions.width,
      videoHeight: videoDimensions.height,
      placement: activePlacement,
    });
  }, [activePlacement, photoDimensions, videoDimensions]);

  useEffect(() => {
    if (viewerMode !== 'manual') return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    const cameraEl = cameraRef.current;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!cancelled && cameraEl) {
          cameraEl.srcObject = stream;
          await cameraEl.play();
        }
      } catch (err) {
        console.warn('Camera access denied or not available:', err);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (cameraEl) {
        cameraEl.srcObject = null;
      }
    };
  }, [viewerMode]);

  useEffect(() => {
    if (viewerMode !== 'tracked') return;

    let cancelled = false;

    async function loadLibraries() {
      await new Promise<void>((resolve) => {
        if ('AFRAME' in window) return resolve();
        const aframeScript = document.createElement('script');
        aframeScript.src = 'https://aframe.io/releases/1.4.2/aframe.min.js';
        aframeScript.onload = () => resolve();
        document.head.appendChild(aframeScript);
      });

      await new Promise<void>((resolve) => {
        if ('MINDAR' in window) return resolve();
        const mindarScript = document.createElement('script');
        mindarScript.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-aframe.prod.js';
        mindarScript.onload = () => resolve();
        document.head.appendChild(mindarScript);
      });

      if (!cancelled) {
        setLibrariesLoaded(true);
      }
    }

    loadLibraries();

    return () => {
      cancelled = true;
      setLibrariesLoaded(false);
    };
  }, [viewerMode]);

  const attemptTrackedPlayback = useCallback(async () => {
    const videoEl = trackedVideoRef.current;

    if (!videoEl || !trackedTargetVisibleRef.current) {
      return false;
    }

    videoEl.defaultMuted = true;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');

    if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return false;
    }

    try {
      await videoEl.play();
      setIsPlaying(true);
      return true;
    } catch (err) {
      console.warn('Tracked autoplay blocked:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (viewerMode !== 'tracked' || !librariesLoaded || !targetRef.current) return;

    const target = targetRef.current;
    const videoEl = trackedVideoRef.current;
    const sceneEl = trackedSceneRef.current;

    if (!videoEl) {
      return;
    }

    const handleTargetFound = () => {
      trackedTargetVisibleRef.current = true;

      if (trackedPauseTimeoutRef.current) {
        clearTimeout(trackedPauseTimeoutRef.current);
        trackedPauseTimeoutRef.current = null;
      }

      void attemptTrackedPlayback();
    };

    const handleTargetLost = () => {
      trackedTargetVisibleRef.current = false;

      if (trackedPauseTimeoutRef.current) {
        clearTimeout(trackedPauseTimeoutRef.current);
      }

      // MindAR can briefly lose the image on mobile while still effectively aligned.
      trackedPauseTimeoutRef.current = setTimeout(() => {
        videoEl.pause();
        setIsPlaying(false);
        trackedPauseTimeoutRef.current = null;
      }, 700);
    };

    const handleVideoReady = () => {
      void attemptTrackedPlayback();
    };

    const handleSceneReady = () => {
      void attemptTrackedPlayback();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void attemptTrackedPlayback();
      }
    };

    target.addEventListener('targetFound', handleTargetFound);
    target.addEventListener('targetLost', handleTargetLost);
    videoEl.addEventListener('loadeddata', handleVideoReady);
    videoEl.addEventListener('canplay', handleVideoReady);
    sceneEl?.addEventListener('loaded', handleSceneReady);
    sceneEl?.addEventListener('renderstart', handleSceneReady);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      target.removeEventListener('targetFound', handleTargetFound);
      target.removeEventListener('targetLost', handleTargetLost);
      videoEl.removeEventListener('loadeddata', handleVideoReady);
      videoEl.removeEventListener('canplay', handleVideoReady);
      sceneEl?.removeEventListener('loaded', handleSceneReady);
      sceneEl?.removeEventListener('renderstart', handleSceneReady);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (trackedPauseTimeoutRef.current) {
        clearTimeout(trackedPauseTimeoutRef.current);
        trackedPauseTimeoutRef.current = null;
      }

      trackedTargetVisibleRef.current = false;
    };
  }, [attemptTrackedPlayback, librariesLoaded, viewerMode]);

  const handleManualPlay = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.muted = false;
    videoRef.current.play().catch((err) => console.warn('Manual playback blocked:', err));
    setIsPlaying(true);
  }, []);

  const handleManualPause = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.pause();
    setIsPlaying(false);
  }, []);

  if (!projectData) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading experience...</div>
      </div>
    );
  }

  if (viewerMode === 'tracked' && !librariesLoaded) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Initializing tracked AR...</div>
      </div>
    );
  }

  if (viewerMode === 'tracked') {
    return (
      <div className="w-full h-screen overflow-hidden fixed inset-0 z-50 bg-black">
        <a-scene
          ref={trackedSceneRef}
          mindar-image={`imageTargetSrc: ${projectData.tracking_url};`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
        >
          <a-assets>
            <video
              id="ar-video"
              ref={trackedVideoRef}
              autoPlay
              crossOrigin="anonymous"
              src={projectData.video_url}
              preload="auto"
              loop
              playsInline
              muted
            />
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0" ref={targetRef}>
            {overlayMetrics && (
              <>
                <a-plane
                  material={`shader: flat; src: ${projectData.image_url}; opacity: 0.02; side: double; transparent: true;`}
                  position="0 0 0"
                  width={overlayMetrics.photoWidth}
                  height={overlayMetrics.photoHeight}
                />
                <a-plane
                  src="#ar-video"
                  material="shader: flat; side: double"
                  position={`${overlayMetrics.x * overlayMetrics.photoWidth} ${-overlayMetrics.y * overlayMetrics.photoHeight} 0.001`}
                  width={overlayMetrics.width}
                  height={overlayMetrics.height}
                />
              </>
            )}
          </a-entity>
        </a-scene>

        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
          <p className="text-white text-center text-sm font-medium tracking-wide">
            {isPlaying
              ? '✨ Locked on. Keep the photo in frame and tap anywhere for sound.'
              : '📸 Point your camera at the printed photo to lock the video in place.'}
          </p>
        </div>

        <div
          className="absolute inset-0 z-0"
          onClick={() => {
            const trackedVideo = trackedVideoRef.current;
            if (!trackedVideo) return;
            trackedVideo.muted = false;
            trackedVideo.play().catch(() => {});
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" style={{ touchAction: 'none' }}>
      <video
        ref={cameraRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 space-y-2">
        <p className="text-white text-center text-sm font-medium tracking-wide">
          {isPlaying
            ? '✨ Manual overlay mode. Keep the photo inside the frame for the cleanest effect.'
            : '📸 This project has no tracking file yet. Line up the frame and tap Play.'}
        </p>
        <p className="text-white/65 text-center text-xs">
          Best result: upload a MindAR `.mind` tracking file for automatic lock-on.
        </p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
        <div
          className="relative w-full max-w-[420px]"
          style={{ aspectRatio: `${1 / imageAspectRatio}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={projectData.image_url}
            alt="Alignment guide"
            className="absolute inset-0 w-full h-full object-cover rounded-[28px] transition-opacity duration-300"
            style={{
              opacity: guideOpacity,
              border: '3px solid rgba(255,255,255,0.72)',
              boxShadow: '0 0 40px rgba(255,255,255,0.16)',
            }}
          />

          {overlayMetrics && (
            <video
              ref={videoRef}
              src={projectData.video_url}
              crossOrigin="anonymous"
              loop
              playsInline
              muted
              preload="auto"
              className="absolute object-cover rounded-[28px] transition-opacity duration-300"
              style={{
                width: `${overlayMetrics.width * 100}%`,
                height: `${overlayMetrics.height * 100}%`,
                left: `${50 + overlayMetrics.x * 100}%`,
                top: `${50 + overlayMetrics.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity: isPlaying ? overlayOpacity : 0,
                boxShadow: '0 0 60px rgba(76, 172, 255, 0.16)',
              }}
            />
          )}

          <div
            className="absolute inset-0 rounded-[28px]"
            style={{ border: '3px solid rgba(255,255,255,0.86)' }}
          />

          <div className="absolute -top-1 -left-1 w-7 h-7 rounded-tl-md border-l-4 border-t-4 border-white" />
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-tr-md border-r-4 border-t-4 border-white" />
          <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-bl-md border-b-4 border-l-4 border-white" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-br-md border-b-4 border-r-4 border-white" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10 flex flex-col items-center gap-4">
        <div className="w-full max-w-sm rounded-2xl bg-white/8 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <label className="flex items-center gap-3 text-white/80 text-xs">
            <span className="w-24 shrink-0">Video blend</span>
            <input
              type="range"
              min="0.45"
              max="1"
              step="0.05"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="flex-1 pointer-events-auto"
            />
            <span className="w-10 text-right">{Math.round(overlayOpacity * 100)}%</span>
          </label>

          <label className="flex items-center gap-3 text-white/80 text-xs">
            <span className="w-24 shrink-0">Photo guide</span>
            <input
              type="range"
              min="0.15"
              max="0.65"
              step="0.05"
              value={guideOpacity}
              onChange={(e) => setGuideOpacity(Number(e.target.value))}
              className="flex-1 pointer-events-auto"
            />
            <span className="w-10 text-right">{Math.round(guideOpacity * 100)}%</span>
          </label>
        </div>

        <button
          onClick={isPlaying ? handleManualPause : handleManualPlay}
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

        <button
          onClick={() => setManualModeEnabled((value) => !value)}
          className="pointer-events-auto text-white/70 text-xs underline underline-offset-4"
        >
          {manualModeEnabled ? 'Hide manual mode note' : 'Show manual mode note'}
        </button>

        {manualModeEnabled && (
          <div className="max-w-sm rounded-2xl bg-black/50 border border-white/10 px-4 py-3 text-center text-white/70 text-xs leading-5">
            Manual mode is only a fallback for older projects. For a client-friendly experience, re-upload this photo with a MindAR tracking file so the video locks onto the print automatically.
          </div>
        )}

        <p className="text-white/40 text-xs">FrameAlive™</p>
      </div>
    </div>
  );
}
