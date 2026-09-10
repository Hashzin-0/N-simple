'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface LibrasCameraProps {
  onLandmarks: (landmarks: { x: number; y: number; z: number }[]) => void;
  isActive: boolean;
  onToggle: () => void;
}

export default function LibrasCamera({ onLandmarks, isActive, onToggle }: LibrasCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Acesso à câmera negado. Permita o acesso nas configurações do navegador.');
        } else if (err.name === 'NotFoundError') {
          setError('Nenhuma câmera encontrada no dispositivo.');
        } else {
          setError(`Erro ao acessar câmera: ${err.message}`);
        }
      } else {
        setError('Erro desconhecido ao acessar câmera.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startCameraRef = useRef(startCamera);
  useEffect(() => {
    startCameraRef.current = startCamera;
  });

  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        startCameraRef.current();
      });
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, stopCamera]);

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-auto"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-32 bg-gradient-to-br from-white/5 to-white/10">
            <Camera className="w-8 h-8 text-white/40" />
          </div>
        )}

        {/* Status indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-white/30'}`} />
          <span className="text-xs text-white/70">
            {isActive ? 'Câmera ativa' : 'Câmera inativa'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          isActive
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isActive ? (
          <>
            <CameraOff className="w-4 h-4" />
            Desligar Câmera
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Ligar Câmera
          </>
        )}
      </button>
    </div>
  );
}
