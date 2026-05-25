import { useState, useRef, useCallback, useEffect } from 'react';
import { saveSession } from '@/lib/db'; // ДОБАВЛЕНО: Импорт базы данных

// Добавили статус 'holding' для удержания затвора
type ScanStatus = 'idle' | 'holding' | 'processing' | 'typing' | 'done';
type CameraErrorType = 'denied' | 'not-found' | 'unknown' | null;

export interface ScannerProfile {
  device_id: string;
  current_level: number;
  total_successful_scans: number;
  max_hold_seconds: number;
  extra_time_seconds: number;
  scans_remaining_to_level_up: number;
  next_level_required_total: number;
}

export const useScanner = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorType>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const [profile, setProfile] = useState<ScannerProfile | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  
  // ВЕБСОКЕТЫ: Заменили pollingIntervalRef на socketRef
  const socketRef = useRef<WebSocket | null>(null);
  
  const wakeLockRef = useRef<any>(null);
  const isCamLoadingRef = useRef(false);

  // Контроль реактивного конвейера
  const isHoldingRef = useRef<boolean>(false);
  const sessionStartTimeRef = useRef<number>(0);
  const sessionUuidRef = useRef<string>('');
  
  // Рефы для IndexedDB
  const recordedBlobRef = useRef<Blob | null>(null);
  const latestThoughtsRef = useRef<string[]>([]);

  useEffect(() => {
    let id = localStorage.getItem('mindreader_device_id');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : 'mr_uuid_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mindreader_device_id', id);
    }
    setDeviceId(id);
    fetchProfile(id);
  }, []);

  const fetchProfile = async (currentId: string) => {
    try {
      const res = await fetch(`/api/v1/scanner/profile/?device_id=${currentId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Ошибка синхронизации профиля:", err);
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn("Wake Lock сбой:", err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => { wakeLockRef.current = null; });
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  const startCamera = async (mode?: 'user' | 'environment') => {
    if (isCamLoadingRef.current) return;
    isCamLoadingRef.current = true;
    const targetMode = mode || facingMode;

    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('not-found');
        return;
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: targetMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.error(e.message));
      }
      await requestWakeLock();
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('denied');
      } else {
        setCameraError('not-found');
      }
    } finally {
      isCamLoadingRef.current = false;
    }
  };

  const toggleCamera = async () => {
    if (status !== 'idle') return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const startLocalRecording = () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream;
      if (!stream) return;
      if (typeof window === 'undefined' || !('MediaRecorder' in window)) return;

      videoChunksRef.current = [];
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const iosTypes = ['video/mp4;codecs=avc1', 'video/quicktime', 'video/mp4'];
        mimeType = iosTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      }
      if (!mimeType) return;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: mimeType });
        recordedBlobRef.current = blob; // Сохраняем для IndexedDB
        setRecordedVideoUrl(URL.createObjectURL(blob));
      };
      recorder.start();
    } catch (e) {
      console.warn("Сбой записи видео:", e);
    }
  };

  const captureFrame = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return resolve(null);

      const MAX_DIMENSION = 480; 
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;

      if (targetWidth > targetHeight) {
        if (targetWidth > MAX_DIMENSION) {
          targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
          targetWidth = MAX_DIMENSION;
        }
      } else {
        if (targetHeight > MAX_DIMENSION) {
          targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
          targetHeight = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82); 
      } else {
        resolve(null);
      }
    });
  };

  const startHolding = useCallback(() => {
    if (status !== 'idle') return;
    
    isHoldingRef.current = true;
    sessionStartTimeRef.current = Date.now();
    
    sessionUuidRef.current = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : 'session_' + Date.now() + Math.random().toString(36).substring(2, 9);
    
    setStatus('holding');
    setAiThoughts([]);
    latestThoughtsRef.current = [];
    setRecordedVideoUrl(null);
    recordedBlobRef.current = null;
    
    startLocalRecording();
    executeScanCycle(); 
  }, [status, deviceId]);

  const stopHolding = useCallback(() => {
    isHoldingRef.current = false;
  }, []);

  const executeScanCycle = async () => {
    const maxHoldMs = (profile?.max_hold_seconds || 3) * 1000;
    const elapsed = Date.now() - sessionStartTimeRef.current;
    
    if (!isHoldingRef.current || elapsed >= maxHoldMs) {
      triggerExtraTimePhase();
      return;
    }

    const capturedFrames: Blob[] = [];
    for (let i = 0; i < 3; i++) {
      const frameBlob = await captureFrame();
      if (frameBlob) capturedFrames.push(frameBlob);
      if (i < 2) await new Promise((r) => setTimeout(r, 400));
    }

    if (capturedFrames.length === 0) {
      triggerExtraTimePhase();
      return;
    }

    const formData = new FormData();
    capturedFrames.forEach((blob, index) => {
      formData.append('frames', blob, `burst_frame_${index}.jpg`);
    });
    formData.append('device_id', deviceId);
    formData.append('session_uuid', sessionUuidRef.current);

    try {
      const res = await fetch('/api/v1/scan/', { method: 'POST', body: formData });
      if (!res.ok) { triggerExtraTimePhase(); return; }
      const data = await res.json();
      
      // ВЕБСОКЕТЫ: Подключаемся к каналу вместо старта пуллинга
      if (data.scan_id) connectWebSocket(data.scan_id);
    } catch (err) {
      triggerExtraTimePhase();
    }
  };

  // ВЕБСОКЕТЫ: Новая функция подключения
  const connectWebSocket = (scanId: number) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const socket = new WebSocket(`${wsBaseUrl}/ws/scan/${scanId}/`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'failed') {
        socket.close();
        triggerExtraTimePhase();
        return;
      }
      
      if (data.status === 'completed') {
        socket.close();
        
        const thoughtsList = data.analysis?.thoughts || ["Хм, пусто в голове..."];
        
        // Синхронизируем стейт и реф для IndexedDB
        setAiThoughts(prev => {
          const updatedThoughts = [...prev, ...thoughtsList];
          latestThoughtsRef.current = updatedThoughts;
          return updatedThoughts;
        });
        
        setStatus('typing');

        if (deviceId) fetchProfile(deviceId);

        setTimeout(() => {
          const maxHoldMs = (profile?.max_hold_seconds || 3) * 1000;
          const elapsed = Date.now() - sessionStartTimeRef.current;
          
          if (isHoldingRef.current && elapsed < maxHoldMs) {
            setStatus('holding');
            executeScanCycle();
          } else {
            triggerExtraTimePhase();
          }
        }, 3000);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      socket.close();
      triggerExtraTimePhase();
    };
  };

  const triggerExtraTimePhase = () => {
    setStatus('processing');
    const extraSeconds = profile?.extra_time_seconds || 5;
    
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') { 
        mediaRecorderRef.current.stop(); 
      }
      setStatus('done');

      // Ждем 150мс сборки видео и кладем сессию в IndexedDB
      setTimeout(() => {
        saveSession({
          id: sessionUuidRef.current || `scan_${Date.now()}`,
          timestamp: Date.now(),
          targetName: 'UNKNOWN_ENTITY', // В будущем будем подтягивать из JSON
          emotion: 'Анализ завершен',
          videoBlob: recordedBlobRef.current,
          thoughts: latestThoughtsRef.current
        });
      }, 150);

    }, extraSeconds * 1000);
  };

  const resetScanner = useCallback(() => {
    setStatus('idle');
    setAiThoughts([]);
    setRecordedVideoUrl(null);
    isHoldingRef.current = false;
    
    recordedBlobRef.current = null;
    latestThoughtsRef.current = [];
    
    // ВЕБСОКЕТЫ: Закрываем соединение при сбросе
    if (socketRef.current) {
      socketRef.current.close();
    }
  }, []);

  return {
    videoRef,
    status,
    aiThoughts,
    recordedVideoUrl,
    cameraError,
    facingMode,
    profile,
    toggleCamera,
    startCamera,
    startHolding,
    stopHolding,
    resetScanner
  };
};