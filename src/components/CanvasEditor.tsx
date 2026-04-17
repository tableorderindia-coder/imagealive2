'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text } from 'react-konva';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export default function CanvasEditor({ projectId }: { projectId: string }) {
  const [projectData, setProjectData] = useState<ProjectRow | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [qrImg, setQrImg] = useState<HTMLImageElement | null>(null);
  const [hideQR, setHideQR] = useState(false);
  const [qrSize, setQrSize] = useState(150);
  const [qrOpacity, setQrOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // A4 aspect ratio at screen resolution suitable for manipulation
  const CANVAS_WIDTH = 595;
  const CANVAS_HEIGHT = 842;

  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      const project = data as ProjectRow | null;
      if (project) {
        setProjectData(project);
        
        // Generate QR code
        const viewUrl = `${window.location.origin}/view/${projectId}`;
        const qr = await QRCode.toDataURL(viewUrl, { margin: 1, width: 150 });

        // Load photo
        const pImg = new window.Image();
        pImg.crossOrigin = 'Anonymous';
        pImg.src = project.image_url;
        pImg.onload = () => setPhotoImg(pImg);

        // Load QR
        const qImg = new window.Image();
        qImg.crossOrigin = 'Anonymous';
        qImg.src = qr;
        qImg.onload = () => setQrImg(qImg);
      }
    }
    loadProject();
  }, [projectId]);

  const exportPDF = async () => {
    if (!containerRef.current) return;
    
    // Use html2canvas to capture the visual output layer around the canvas
    const canvas = await html2canvas(containerRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    // A4 dimensions in mm
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
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Editor</h2>
        <p className="text-gray-400">Your photo and the generated AR code are placed on a standard A4 layout. Click &apos;Download PDF&apos; to export and print.</p>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow mt-4 max-w-lg mx-auto border border-gray-700">
          <label className="flex items-center justify-center gap-2 text-white cursor-pointer hover:text-gray-300 w-max mx-auto mb-3">
            <input type="checkbox" checked={hideQR} onChange={(e) => setHideQR(e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500" />
            Completely Hide QR Code
          </label>

          {!hideQR && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm mt-2 border-t border-gray-700 pt-3">
              <label className="flex flex-col text-gray-300 w-full">
                <span>QR Size: {qrSize}px (Micro QR)</span>
                <input type="range" min="30" max="300" value={qrSize} onChange={(e) => setQrSize(Number(e.target.value))} className="mt-1" />
              </label>
              <label className="flex flex-col text-gray-300 w-full">
                <span>Blend Opacity: {Math.round(qrOpacity * 100)}%</span>
                <input type="range" min="0.05" max="1" step="0.05" value={qrOpacity} onChange={(e) => setQrOpacity(Number(e.target.value))} className="mt-1" />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-2 rounded-md shadow-2xl overflow-hidden" style={{ width: CANVAS_WIDTH + 16 }}>
        <div ref={containerRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#fff', position: 'relative' }}>
          <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
            <Layer>
              {/* White background */}
              <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="white" />
              
              {/* Main Photo placed conditionally */}
              {photoImg && (
                <KonvaImage 
                  image={photoImg} 
                  x={50} y={50} 
                  width={CANVAS_WIDTH - 100} 
                  height={(photoImg.height / photoImg.width) * (CANVAS_WIDTH - 100)} 
                  draggable 
                />
              )}

              {/* QR Code placed dynamically */}
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

      <button 
        onClick={exportPDF} 
        className="py-3 px-8 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        Download Print-Ready PDF
      </button>

      <a 
        href={`/view/${projectId}`} 
        target="_blank" 
        className="text-blue-400 hover:text-blue-300 underline text-sm"
      >
        Test Viewer Page Link
      </a>
    </div>
  );
}
