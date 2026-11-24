import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Clock,
  FlipHorizontal,
  Send,
  Sparkles,
  Type,
  Upload,
  VideoOff,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LensPreset {
  id: string;
  name: string;
  filterCss: string;
  overlayKind: 'none' | 'halo' | 'shades' | 'stamp' | 'prism' | 'frame';
}

const LENS_PRESETS: LensPreset[] = [
  { id: 'natural', name: 'Natural', filterCss: 'none', overlayKind: 'none' },
  {
    id: 'golden',
    name: 'Golden Hour',
    filterCss: 'sepia(0.28) saturate(1.35) contrast(1.06) brightness(1.04)',
    overlayKind: 'halo',
  },
  {
    id: 'noir',
    name: 'Mono 35mm',
    filterCss: 'grayscale(1) contrast(1.22) brightness(0.98)',
    overlayKind: 'stamp',
  },
  {
    id: 'prism',
    name: 'Prism Cool',
    filterCss: 'hue-rotate(-14deg) saturate(1.25) contrast(1.08)',
    overlayKind: 'prism',
  },
  {
    id: 'shades',
    name: 'Sunlit Shades',
    filterCss: 'saturate(1.2) contrast(1.05)',
    overlayKind: 'shades',
  },
  {
    id: 'vintage',
    name: 'Instant Frame',
    filterCss: 'sepia(0.2) contrast(1.1) brightness(1.02)',
    overlayKind: 'frame',
  },
];

const STUDIO_BACKDROPS = [
  '/src/assets/images/story_golden_hour_1795511540973.jpg',
  '/src/assets/images/story_coffee_studio_1795511540917.jpg',
  '/src/assets/images/story_city_rooftop_1795511542219.jpg',
  '/src/assets/images/story_neon_skate_1795511542074.jpg',
];

interface CameraLensStudioProps {
  partner: UserProfile;
  onSendSnap: (payload: {
    mediaUrl: string;
    caption: string;
    lensName: string;
    ttlSeconds: number;
  }) => Promise<void>;
  onPostStory: (payload: {
    mediaUrl: string;
    caption: string;
    lensName: string;
  }) => Promise<void>;
}

export function CameraLensStudio({
  partner,
  onSendSnap,
  onPostStory,
}: CameraLensStudioProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [backdropIndex, setBackdropIndex] = useState(0);
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [activeLens, setActiveLens] = useState<LensPreset>(LENS_PRESETS[0]);
  const [caption, setCaption] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);

  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<number>(10);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function enableLiveCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera access is unavailable in this browser. Using Studio Scene mode.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setUploadedSrc(null);
    } catch {
      setCameraError('Camera permission declined or no webcam attached. Studio Scene mode active.');
      setCameraActive(false);
    }
  }

  function stopLiveCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        stopLiveCamera();
        setUploadedSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function drawLensOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    if (activeLens.overlayKind === 'halo') {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 8;
      ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.22, w * 0.18, h * 0.038, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (activeLens.overlayKind === 'shades') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      const y = h * 0.36;
      const lensW = w * 0.18;
      const lensH = h * 0.08;
      ctx.beginPath();
      ctx.roundRect(w * 0.29, y, lensW, lensH, 14);
      ctx.roundRect(w * 0.53, y, lensW, lensH, 14);
      ctx.fill();
      ctx.fillRect(w * 0.47, y + lensH * 0.25, w * 0.06, 8);
    } else if (activeLens.overlayKind === 'prism') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      grad.addColorStop(0.5, 'rgba(250, 204, 21, 0.08)');
      grad.addColorStop(1, 'rgba(244, 63, 94, 0.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (activeLens.overlayKind === 'stamp') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 20px "JetBrains Mono", monospace';
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(`REC · ${stamp}`, 28, h - 32);
    } else if (activeLens.overlayKind === 'frame') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 28;
      ctx.strokeRect(14, 14, w - 28, h - 28);
    }

    if (caption.trim()) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(0, h * 0.68, w, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption.trim().slice(0, 48), w / 2, h * 0.68 + 32);
    }
    ctx.restore();
  }

  async function handleCapture() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 720;
    const height = 960;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = activeLens.filterCss;

    if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
      const vid = videoRef.current;
      const vw = vid.videoWidth || width;
      const vh = vid.videoHeight || height;
      const scale = Math.max(width / vw, height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;

      ctx.save();
      if (mirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(vid, dx, dy, dw, dh);
      ctx.restore();
    } else {
      const imgSrc = uploadedSrc || STUDIO_BACKDROPS[backdropIndex];
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const scale = Math.max(width / img.width, height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
          resolve();
        };
        img.onerror = () => {
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(0, 0, width, height);
          resolve();
        };
        img.src = imgSrc;
      });
    }

    ctx.filter = 'none';
    drawLensOverlay(ctx, width, height);
    setCapturedUrl(canvas.toDataURL('image/jpeg', 0.84));
  }

  async function handleDeliverToPartner() {
    if (!capturedUrl) return;
    setSending(true);
    try {
      await onSendSnap({
        mediaUrl: capturedUrl,
        caption: caption.trim() || `${activeLens.name} snap`,
        lensName: activeLens.name,
        ttlSeconds,
      });
      setCapturedUrl(null);
      setCaption('');
      setFeedback(`Snap sent to ${partner.displayName}`);
      setTimeout(() => setFeedback(null), 2200);
    } finally {
      setSending(false);
    }
  }

  async function handlePublishStory() {
    if (!capturedUrl) return;
    setSending(true);
    try {
      await onPostStory({
        mediaUrl: capturedUrl,
        caption: caption.trim(),
        lensName: activeLens.name,
      });
      setCapturedUrl(null);
      setCaption('');
      setFeedback('Added to Our 24h Stories');
      setTimeout(() => setFeedback(null), 2200);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 overflow-y-auto items-center lg:items-stretch justify-center">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Camera Viewfinder Frame */}
      <div className="relative w-full max-w-[420px] aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl shrink-0">
        {capturedUrl ? (
          <img
            src={capturedUrl}
            alt="Captured snap preview"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : cameraActive ? (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ filter: activeLens.filterCss }}
            className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
          />
        ) : (
          <img
            src={uploadedSrc || STUDIO_BACKDROPS[backdropIndex]}
            alt="Studio scene backdrop"
            referrerPolicy="no-referrer"
            style={{ filter: activeLens.filterCss }}
            className="w-full h-full object-cover"
          />
        )}

        {!capturedUrl && activeLens.overlayKind === 'halo' && (
          <div className="pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 w-32 h-7 rounded-full border-4 border-amber-400 shadow-[0_0_24px_rgba(250,204,21,0.75)]" />
        )}
        {!capturedUrl && activeLens.overlayKind === 'shades' && (
          <div className="pointer-events-none absolute top-[35%] left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="w-16 h-9 rounded-xl bg-slate-950/90 border border-white/20" />
            <div className="w-4 h-1.5 bg-slate-950/90" />
            <div className="w-16 h-9 rounded-xl bg-slate-950/90 border border-white/20" />
          </div>
        )}
        {!capturedUrl && activeLens.overlayKind === 'prism' && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-sky-500/20 via-transparent to-rose-500/20" />
        )}
        {!capturedUrl && activeLens.overlayKind === 'frame' && (
          <div className="pointer-events-none absolute inset-3 border-[10px] border-white/95 rounded-2xl" />
        )}
        {!capturedUrl && activeLens.overlayKind === 'stamp' && (
          <div className="pointer-events-none absolute bottom-24 left-5 font-mono text-xs text-white/90 tracking-wider">
            REC · 35MM
          </div>
        )}

        {!capturedUrl && caption.trim() && (
          <div className="pointer-events-none absolute bottom-[26%] inset-x-0 bg-slate-950/75 py-2.5 px-4 text-center text-white font-semibold text-sm">
            {caption}
          </div>
        )}

        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          {capturedUrl ? (
            <button
              type="button"
              onClick={() => setCapturedUrl(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 text-white text-xs font-medium hover:bg-black/80 min-h-[40px]"
            >
              <X className="w-4 h-4" />
              Retake
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {cameraActive ? (
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 text-white text-xs font-medium hover:bg-black/80 min-h-[40px]"
                >
                  <VideoOff className="w-3.5 h-3.5" />
                  Studio Scene
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enableLiveCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 min-h-[40px]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Use Live Camera
                </button>
              )}
            </div>
          )}

          {!capturedUrl && (
            <div className="flex items-center gap-2">
              {cameraActive ? (
                <button
                  type="button"
                  onClick={() => setMirrored((m) => !m)}
                  aria-label="Flip camera mirror"
                  className="p-2.5 rounded-xl bg-black/60 text-white hover:bg-black/80 min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedSrc(null);
                    setBackdropIndex((i) => (i + 1) % STUDIO_BACKDROPS.length);
                  }}
                  className="px-3 py-2 rounded-xl bg-black/60 text-white text-xs font-medium hover:bg-black/80 min-h-[40px]"
                >
                  Next Scene
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload photo"
                className="p-2.5 rounded-xl bg-black/60 text-white hover:bg-black/80 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowCaptionInput((s) => !s)}
                aria-label="Toggle caption"
                className={`p-2.5 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  showCaptionInput ? 'bg-amber-400 text-slate-950' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
              >
                <Type className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {!capturedUrl && (
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent space-y-3">
            {showCaptionInput && (
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={48}
                placeholder="Add caption text..."
                className="w-full px-3.5 py-2 rounded-xl bg-black/70 border border-white/20 text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
              />
            )}

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {LENS_PRESETS.map((lens) => (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => setActiveLens(lens)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    activeLens.id === lens.id
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-black/55 text-white/85 hover:bg-black/75'
                  }`}
                >
                  {lens.name}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleCapture}
                aria-label="Capture Snap"
                className="w-16 h-16 rounded-full border-4 border-white bg-amber-400 hover:bg-amber-300 active:scale-95 transition-transform flex items-center justify-center shadow-lg"
              >
                <span className="w-12 h-12 rounded-full border-2 border-slate-950/20" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Options */}
      <div className="w-full max-w-[420px] lg:max-w-sm flex flex-col justify-center space-y-5">
        {feedback && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {feedback}
          </div>
        )}

        {cameraError && (
          <div className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            {cameraError}
          </div>
        )}

        {capturedUrl ? (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Send to {partner.displayName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lens applied: {activeLens.name}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                <Clock className="w-3.5 h-3.5" />
                Disappearing Timer
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 10, label: '10 sec' },
                  { val: 86400, label: '24 hours' },
                  { val: 0, label: 'Keep' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setTtlSeconds(opt.val)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                      ttlSeconds === opt.val
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={handleDeliverToPartner}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 transition-colors min-h-[44px]"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : `Send Snap to ${partner.displayName}`}
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={handlePublishStory}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              Post to Our 24h Stories
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold">Private Camera & Lenses</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Take a quick snap with live filters and send it directly to{' '}
              <strong>{partner.displayName}</strong>—nobody else can ever see what you share here.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div>Active lens · {activeLens.name}</div>
              <div>Recipient · {partner.displayName} only</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
