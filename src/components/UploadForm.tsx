'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '@/types/database';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

export default function UploadForm() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Read files directly from the DOM refs — avoids React 19 state-reset issues
    const photo = photoInputRef.current?.files?.[0] ?? null;
    const video = videoInputRef.current?.files?.[0] ?? null;
    const trackingFile = trackingInputRef.current?.files?.[0] ?? null;

    if (!photo || !video) {
      setStatus('error');
      setMessage('Please upload both a Photo and a Video.');
      return;
    }

    try {
      setStatus('uploading');
      setMessage('Uploading photo...');

      const uniqueId = uuidv4();
      const photoName = `${uniqueId}-${photo.name}`;
      const videoName = `${uniqueId}-${video.name}`;
      const trackingName = trackingFile ? `${uniqueId}-${trackingFile.name}` : null;

      // Upload Photo
      const { error: photoErr } = await supabase.storage.from('images').upload(photoName, photo);
      if (photoErr) throw photoErr;
      const photoUrl = supabase.storage.from('images').getPublicUrl(photoName).data.publicUrl;

      // Upload Video
      setMessage('Uploading video...');
      const { error: vidErr } = await supabase.storage.from('videos').upload(videoName, video);
      if (vidErr) throw vidErr;
      const videoUrl = supabase.storage.from('videos').getPublicUrl(videoName).data.publicUrl;

      let trackingUrl = '';
      if (trackingFile && trackingName) {
        setMessage('Uploading tracking file...');
        const { error: trackingErr } = await supabase.storage.from('tracking').upload(trackingName, trackingFile);
        if (trackingErr) throw trackingErr;
        trackingUrl = supabase.storage.from('tracking').getPublicUrl(trackingName).data.publicUrl;
      }

      setMessage('Saving project...');
      const projectRecord: ProjectInsert = {
        image_url: photoUrl,
        video_url: videoUrl,
        tracking_url: trackingUrl,
        overlay_x: 0,
        overlay_y: 0,
        overlay_scale: 1,
      };
      const { data, error: dbErr } = await supabase.from('projects').insert(projectRecord).select().single();

      if (dbErr) throw dbErr;

      setStatus('success');
      setMessage('Success! Redirecting to editor...');
      
      router.push(`/editor/${data.id}`);

    } catch (err: unknown) {
      console.error(err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'An error occurred during upload.');
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-8 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
      <h2 className="text-3xl font-bold mb-2 text-white text-center tracking-tight">Create your AR Frame</h2>
      <p className="text-white/50 text-center text-sm mb-6">Upload a photo and a video — we&apos;ll make the photo come alive!</p>
      
      <form onSubmit={handleUpload} className="space-y-6">
        <div className="p-5 rounded-xl bg-black/20 border border-white/10 transition-all hover:bg-black/30">
          <h3 className="text-lg font-semibold text-white/90 mb-4">📸 Select your Media</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Target Photo (Image)</label>
              <input 
                ref={photoInputRef}
                type="file" 
                accept="image/*" 
                className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition"
              />
              <p className="text-xs text-white/40 mt-1">This is the photo you&apos;ll print. The video will play on top of it.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">AR Video</label>
              <input 
                ref={videoInputRef}
                type="file" 
                accept="video/*" 
                className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-700 transition"
              />
              <p className="text-xs text-white/40 mt-1">This video will play when someone views your photo through the camera. Large files are allowed, though smaller videos still load faster on phones.</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-black/20 border border-emerald-400/20 transition-all hover:bg-black/30">
          <h3 className="text-lg font-semibold text-white/90 mb-2">🎯 Tracking File for Auto Lock-On</h3>
          <p className="text-xs text-white/55 mb-4">
            Optional, but strongly recommended for real clients. Generate a MindAR <code className="bg-black/40 px-1 py-0.5 rounded">.mind</code> file from your photo using
            {' '}
            <a
              href="https://hiukim.github.io/mind-ar-js-doc/tools/compile/"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300 hover:text-emerald-200 underline"
            >
              the official compiler
            </a>
            , then upload it here so the video locks onto the printed photo automatically.
          </p>
          <input
            ref={trackingInputRef}
            type="file"
            accept=".mind,application/octet-stream"
            className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 transition"
          />
          <p className="text-xs text-white/40 mt-2">If you skip this, the viewer falls back to manual alignment mode.</p>
        </div>

        {status === 'error' && (
          <div className="p-3 rounded bg-red-500/20 text-red-200 border border-red-500/30 text-sm">
            {message}
          </div>
        )}
        
        {status === 'uploading' && (
          <div className="p-3 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30 text-sm animate-pulse flex items-center justify-center space-x-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>{message}</span>
          </div>
        )}

        {status === 'success' && (
          <div className="p-3 rounded bg-green-500/20 text-green-200 border border-green-500/30 text-sm">
            {message}
          </div>
        )}

        <button 
          type="submit" 
          disabled={status === 'uploading' || status === 'success'}
          className="w-full py-3 px-4 rounded-xl font-bold shadow-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
        >
          {status === 'uploading' ? 'Processing...' : '✨ Bring Photo to Life'}
        </button>
      </form>
    </div>
  );
}
