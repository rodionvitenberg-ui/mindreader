import { useState, useRef, useCallback, useEffect } from 'react';

type ScanStatus = 'idle' | 'scanning' | 'typing' | 'done';
type CameraErrorType = 'denied' | 'not-found' | 'unknown' | null;

export const useScanner = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorType>(null);
  
  // ДОБАВЛЕНО: Состояние направления камеры ('environment' - задняя, 'user' - фронтальная)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  const isCamLoadingRef = useRef(false);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log("Wake Lock активирован");
      } catch (err) {
        console.warn("Wake Lock сбой:", err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
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

  // Модернизированный запуск камеры с поддержкой динамического режима (mode)
  const startCamera = async (mode?: 'user' | 'environment') => {
    if (isCamLoadingRef.current) {
      console.log("Запрос камеры заблокирован: процесс инициализации активен.");
      return;
    }
    isCamLoadingRef.current = true;

    // Определяем текущий активный режим
    const targetMode = mode || facingMode;

    try {
      setCameraError(null);
      console.log(`Инициализация камеры. Режим: ${targetMode}`);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('not-found');
        return;
      }

      // Жестко тушим предыдущий стрим, чтобы освободить аппаратный поток смартфона
      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: targetMode, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.error("Ошибка при video.play(): " + e.message));
      }
      
      await requestWakeLock();
      
    } catch (err: any) {
      console.error("Ошибка доступа к камере:", err.name, "->", err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('denied');
      } else {
        setCameraError('not-found');
      }
    } finally {
      isCamLoadingRef.current = false;
    }
  };

  // ДОБАВЛЕНО: Функция безопасного переключения камеры (Flip)
  const toggleCamera = async () => {
    if (status !== 'idle') return; // Запрещаем переключение во время сканирования
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    
    // Асинхронно обновляем стейт и детерминированно перезапускаем поток
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
        const supportedType = iosTypes.find(type => MediaRecorder.isTypeSupported(type));
        mimeType = supportedType || '';
      }

      if (!mimeType) return;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: mimeType });
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

      // ИНДУСТРИАЛЬНЫЙ СТАНДАРТ: Ограничиваем максимальную сторону кадра для ИИ
      const MAX_DIMENSION = 480; 
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;

      // Рассчитываем пропорции, сохраняя Aspect Ratio кадра
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
        // Отрисовываем уменьшенную копию кадра
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Сжатие 0.82 — идеальный баланс между весом файла и читаемостью для нейросети
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82); 
      } else {
        resolve(null);
      }
    });
  };

  // МОДЕРНИЗИРОВАНО: Логика серийной съемки (Burst Capture из 3-х кадров)
  const triggerScan = async (recordVideo: boolean = false) => {
    if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.videoWidth === 0) {
      await startCamera();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setStatus('scanning');
    setRecordedVideoUrl(null);
    
    if (recordVideo) {
      startLocalRecording();
    }

    const capturedFrames: Blob[] = [];
    console.log("Запуск серийной съемки раскадровки (3 кадра)...");

    // Цикл высокоскоростного захвата временных срезов
    for (let i = 0; i < 3; i++) {
      const frameBlob = await captureFrame();
      if (frameBlob) {
        capturedFrames.push(frameBlob);
        console.log(`Кадр ${i + 1}/3 успешно буферизирован.`);
      }
      
      // Задаем тактическую паузу в 450мс между кадрами для фиксации динамики
      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    }

    if (capturedFrames.length === 0) {
        console.error("Не удалось получить кадры для анализа.");
        setStatus('idle');
        return;
    }

    // Пакуем всю серию снимков в один FormData контейнер
    const formData = new FormData();
    capturedFrames.forEach((blob, index) => {
      formData.append('frames', blob, `burst_frame_${index}.jpg`);
    });

    try {
      const res = await fetch('/api/v1/scan/', { method: 'POST', body: formData });
      if (!res.ok) { setStatus('idle'); return; }
      const data = await res.json();
      if (data.scan_id) { startPolling(data.scan_id); }
    } catch (err) {
      console.error("Ошибка сети:", err);
      setStatus('idle');
    }
  };

  const startPolling = (scanId: number) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/scan/${scanId}/`);
        const data = await res.json().catch(() => null);
        if (!data) {
           if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
           setStatus('idle');
           return;
        }
        if (data.status === 'completed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setAiThoughts(data.analysis.thoughts);
          setStatus('typing');
          setTimeout(() => {
             if (mediaRecorderRef.current?.state === 'recording') { mediaRecorderRef.current.stop(); }
             setStatus('done');
          }, 3000);
        } else if (data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setStatus('idle');
        }
      } catch (err) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setStatus('idle');
      }
    }, 1500);
  };

  const resetScanner = useCallback(() => {
    setStatus('idle');
    setAiThoughts([]);
    setRecordedVideoUrl(null);
  }, []);

  return {
    videoRef,
    status,
    aiThoughts,
    recordedVideoUrl,
    cameraError,
    facingMode,       // Экспортируем режим, чтобы UI знал, какая камера активна
    toggleCamera,     // Функция-флиппер для кнопки селфи
    startCamera,
    triggerScan,
    resetScanner
  };
};