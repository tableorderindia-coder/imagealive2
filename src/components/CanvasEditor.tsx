'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text } from 'react-konva';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import { calculateDefaultOverlayPlacement, getOverlayRenderMetrics } from '@/lib/overlay-placement';
import type { Database } from '@/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type OverlayPlacement = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  startX: number;
  startY: number;
  origin: OverlayPlacement;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getAssetName = (url: string | null | undefined) => {
  if (!url) return 'Not available';

  const rawName = url.split('/').pop() ?? url;

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
};

export default function CanvasEditor({ projectId }: { projectId: string }) {
  const [projectData, setProjectData] = useState<ProjectRow | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [qrImg, setQrImg] = useState<HTMLImageElement | null>(null);
  const [hideQR, setHideQR] = useState(false);
  const [qrSize, setQrSize] = useState(150);
  const [qrOpacity, setQrOpacity] = useState(1);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [placement, setPlacement] = useState<OverlayPlacement | null>(null);
  const [placementStatus, setPlacementStatus] = useState('');
  const [isSavingPlacement, setIsSavingPlacement] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const CANVAS_WIDTH = 595;
  const CANVAS_HEIGHT = 842;

  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      const project = data as ProjectRow | null;
      if (!project) return;

      setProjectData(project);
      setPlacement({
        x: project.overlay_x ?? 0,
        y: project.overlay_y ?? 0,
        scale: project.overlay_scale ?? 1,
      });

      const viewUrl = `${window.location.origin}/view/${projectId}`;
      const qr = await QRCode.toDataURL(viewUrl, { margin: 1, width: 150 });

      const pImg = new window.Image();
      pImg.crossOrigin = 'Anonymous';
      pImg.src = project.image_url;
      pImg.onload = () => setPhotoImg(pImg);

      const qImg = new window.Image();
      qImg.crossOrigin = 'Anonymous';
      qImg.src = qr;
      qImg.onload = () => setQrImg(qImg);

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.src = project.video_url;
      video.onloadedmetadata = () => {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
    }

    loadProject();
  }, [projectId]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      setPlacement({
        x: clamp(dragState.origin.x + (event.clientX - dragState.startX) / dragState.width, -1.2, 1.2),
        y: clamp(dragState.origin.y + (event.clientY - dragState.startY) / dragState.height, -1.2, 1.2),
        scale: dragState.origin.scale,
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const defaultPlacement = useMemo(() => {
    if (!photoImg || !videoDimensions) return null;

    return calculateDefaultOverlayPlacement({
      photoWidth: photoImg.naturalWidth,
      photoHeight: photoImg.naturalHeight,
      videoWidth: videoDimensions.width,
      videoHeight: videoDimensions.height,
    });
  }, [photoImg, videoDimensions]);

  const activePlacement = placement ?? defaultPlacement;

  const overlayMetrics = useMemo(() => {
    if (!photoImg || !videoDimensions || !activePlacement) return null;

    return getOverlayRenderMetrics({
      photoWidth: photoImg.naturalWidth,
      photoHeight: photoImg.naturalHeight,
      videoWidth: videoDimensions.width,
      videoHeight: videoDimensions.height,
      placement: activePlacement,
    });
  }, [activePlacement, photoImg, videoDimensions]);

  const imageAssetName = useMemo(() => getAssetName(projectData?.image_url), [projectData?.image_url]);
  const videoAssetName = useMemo(() => getAssetName(projectData?.video_url), [projectData?.video_url]);
  const trackingAssetName = useMemo(() => getAssetName(projectData?.tracking_url), [projectData?.tracking_url]);

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (!previewRef.current || !activePlacement) return;

    const rect = previewRef.current.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: activePlacement,
      width: rect.width,
      height: rect.height,
    };

    setPlacement(activePlacement);
    setPlacementStatus('Dragging overlay...');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSavePlacement = async () => {
    if (!activePlacement) return;

    setIsSavingPlacement(true);
    setPlacementStatus('');

    const { data, error } = await supabase
      .from('projects')
      .update({
        overlay_x: activePlacement.x,
        overlay_y: activePlacement.y,
        overlay_scale: activePlacement.scale,
      })
      .eq('id', projectId)
      .select('*')
      .single();

    setIsSavingPlacement(false);

    if (error) {
      setPlacementStatus(error.message);
      return;
    }

    setProjectData(data as ProjectRow);
    setPlacementStatus('Placement saved. The AR viewer will use this layout.');
  };

  const handleResetPlacement = () => {
    if (!defaultPlacement) return;

    setPlacement(defaultPlacement);
    setPlacementStatus('Placement reset to the default fit.');
  };

  const exportPDF = async () => {
    if (!containerRef.current) return;

    const canvas = await html2canvas(containerRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`FrameAlive-${projectId}.pdf`);
  };

  if (!projectData) {
    return <div className="text-white text-center p-10">Loading project...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl mx-auto p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Editor</h2>
        <p className="text-gray-400">
          Tune where the video sits inside the photo, then save it once. The tracked AR view will reuse the same layout.
        </p>
      </div>

      <div className="w-full grid gap-6 lg:grid-cols-[minmax(0,420px),minmax(0,1fr)] items-start">
        <div className="bg-gray-900/90 p-4 rounded-3xl border border-gray-700 shadow-xl">
          <h3 className="text-white font-semibold mb-3">AR Placement Preview</h3>
          <p className="text-gray-400 text-sm mb-4">
            Drag the video to place it inside the printed photo, then use the scale slider to size it like a living frame.
          </p>

          <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/75 space-y-1">
            <p><strong className="text-white">Image:</strong> {imageAssetName}</p>
            <p><strong className="text-white">Image size:</strong> {photoImg ? `${photoImg.naturalWidth} x ${photoImg.naturalHeight}` : 'Loading...'}</p>
            <p><strong className="text-white">Video:</strong> {videoAssetName}</p>
            <p><strong className="text-white">Video size:</strong> {videoDimensions ? `${videoDimensions.width} x ${videoDimensions.height}` : 'Loading...'}</p>
            <p><strong className="text-white">Tracking file:</strong> {projectData?.tracking_url ? trackingAssetName : 'No .mind file attached'}</p>
            <p><strong className="text-white">Expected target size:</strong> {photoImg ? `${photoImg.naturalWidth} x ${photoImg.naturalHeight}` : 'Matches the uploaded image'}</p>
            <p className="text-white/50">The .mind file itself does not expose a trusted width and height here, so it should be generated from this exact image file.</p>
          </div>

          <div
            ref={previewRef}
            className="relative w-full overflow-hidden rounded-[28px] bg-black touch-none select-none border border-white/10"
            style={{
              aspectRatio: photoImg ? `${photoImg.naturalWidth} / ${photoImg.naturalHeight}` : '3 / 4',
            }}
          >
            {photoImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={projectData.image_url}
                alt="Photo preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {overlayMetrics && (
              <video
                src={projectData.video_url}
                autoPlay
                loop
                muted
                playsInline
                onPointerDown={handleOverlayPointerDown}
                className="absolute object-cover rounded-2xl border-2 border-emerald-300/80 shadow-2xl cursor-grab active:cursor-grabbing pointer-events-auto"
                style={{
                  width: `${overlayMetrics.width * 100}%`,
                  height: `${overlayMetrics.height * 100}%`,
                  left: `${50 + overlayMetrics.x * 100}%`,
                  top: `${50 + overlayMetrics.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
          </div>

          <div className="mt-4 space-y-4">
            <label className="flex flex-col text-gray-300 text-sm">
              <span>Overlay scale: {Math.round((activePlacement?.scale ?? 1) * 100)}%</span>
              <input
                type="range"
                min="0.15"
                max="1.6"
                step="0.01"
                value={activePlacement?.scale ?? 1}
                onChange={(event) =>
                  setPlacement({
                    x: activePlacement?.x ?? 0,
                    y: activePlacement?.y ?? 0,
                    scale: Number(event.target.value),
                  })
                }
                className="mt-2"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleSavePlacement}
                disabled={!activePlacement || isSavingPlacement}
                className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white font-semibold py-3 transition"
              >
                {isSavingPlacement ? 'Saving...' : 'Save AR Placement'}
              </button>
              <button
                onClick={handleResetPlacement}
                disabled={!defaultPlacement}
                className="rounded-xl border border-white/15 text-white/80 px-4 py-3 hover:bg-white/5 transition"
              >
                Reset
              </button>
            </div>

            {placementStatus && (
              <p className="text-sm text-emerald-300">{placementStatus}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
            <label className="flex items-center justify-center gap-2 text-white cursor-pointer hover:text-gray-300 w-max mx-auto mb-3">
              <input
                type="checkbox"
                checked={hideQR}
                onChange={(event) => setHideQR(event.target.checked)}
                className="w-4 h-4 cursor-pointer accent-blue-500"
              />
              Completely Hide QR Code
            </label>

            {!hideQR && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm mt-2 border-t border-gray-700 pt-3">
                <label className="flex flex-col text-gray-300 w-full">
                  <span>QR Size: {qrSize}px</span>
                  <input type="range" min="30" max="300" value={qrSize} onChange={(event) => setQrSize(Number(event.target.value))} className="mt-1" />
                </label>
                <label className="flex flex-col text-gray-300 w-full">
                  <span>QR Opacity: {Math.round(qrOpacity * 100)}%</span>
                  <input type="range" min="0.05" max="1" step="0.05" value={qrOpacity} onChange={(event) => setQrOpacity(Number(event.target.value))} className="mt-1" />
                </label>
              </div>
            )}
          </div>

          <div className="bg-white p-2 rounded-md shadow-2xl overflow-hidden" style={{ width: CANVAS_WIDTH + 16 }}>
            <div ref={containerRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#fff', position: 'relative' }}>
              <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <Layer>
                  <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="white" />

                  {photoImg && (
                    <KonvaImage
                      image={photoImg}
                      x={50}
                      y={50}
                      width={CANVAS_WIDTH - 100}
                      height={(photoImg.height / photoImg.width) * (CANVAS_WIDTH - 100)}
                      draggable
                    />
                  )}

                  {!hideQR && qrImg && (
                    <KonvaImage
                      image={qrImg}
                      x={CANVAS_WIDTH - qrSize - 30}
                      y={CANVAS_HEIGHT - qrSize - 30}
                      width={qrSize}
                      height={qrSize}
                      opacity={qrOpacity}
                      draggable
                    />
                  )}

                  {!hideQR && (
                    <Text
                      text="Scan this QR code and point your camera at the photo to bring it to life!"
                      x={50}
                      y={CANVAS_HEIGHT - 100}
                      width={CANVAS_WIDTH - 250}
                      fontSize={16}
                      fill="#333"
                      align="left"
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={exportPDF}
              className="py-3 px-8 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg transition-transform hover:scale-105"
            >
              Download Print-Ready PDF
            </button>

            <a
              href={`/view/${projectId}`}
              target="_blank"
              className="py-3 px-8 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 text-center"
            >
              Test Viewer Page Link
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
