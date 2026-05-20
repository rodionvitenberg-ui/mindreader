import { useState, useRef, useCallback } from 'react';

type ScanStatus = 'idle' | 'scanning' | 'typing' | 'done';

export const useScanner = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  // ДОБАВЛЕНО: Ссылка на локальный видеофайл в памяти браузера
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Ошибка доступа к камере:", err);
    }
  };

  const startLocalRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    videoChunksRef.current = [];
    
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4'; 
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      // ИЗМЕНЕНИЕ: Сохраняем url в стейт для UI
      setRecordedVideoUrl(url);
      console.log("Видео готово к сохранению:", url);
    };

    recorder.start();
  };

  const captureFrame = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve(null);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
      } else {
        resolve(null);
      }
    });
  };

  const triggerScan = async (recordVideo: boolean = false) => {
    setStatus('scanning');
    setRecordedVideoUrl(null); // Сбрасываем старое видео перед новым сканом
    
    if (recordVideo) {
      startLocalRecording();
    }

    const frameBlob = await captureFrame();
    if (!frameBlob) {
        setStatus('idle');
        return;
    }

    const formData = new FormData();
    formData.append('frames', frameBlob, 'scan.jpg');

    try {
      const res = await fetch('/api/v1/scan/', { method: 'POST', body: formData });
      
      if (!res.ok) {
        const textError = await res.text();
        console.error("Ошибка от сервера:", textError);
        setStatus('idle');
        return;
      }

      const data = await res.json();
      if (data.scan_id) {
        startPolling(data.scan_id);
      }
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
             if (mediaRecorderRef.current?.state === 'recording') {
                 mediaRecorderRef.current.stop();
             }
             setStatus('done');
          }, 3000);
        } else if (data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setStatus('idle');
          alert("Связь с астралом прервана. Попробуйте еще раз.");
        }
      } catch (err) {
        console.error("Ошибка пуллинга:", err);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setStatus('idle');
      }
    }, 1500);
  };

  // ДОБАВЛЕНО: Сброс сканера в начальное состояние для повторного сканирования
  const resetScanner = useCallback(() => {
    setStatus('idle');
    setAiThoughts([]);
    setRecordedVideoUrl(null);
  }, []);

  return {
    videoRef,
    status,
    aiThoughts,
    recordedVideoUrl, // Экспортируем ссылку на видео
    startCamera,
    triggerScan,
    resetScanner     // Экспортируем функцию сброса
  };
};