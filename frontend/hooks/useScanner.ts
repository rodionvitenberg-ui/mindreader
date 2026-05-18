import { useState, useRef, useCallback } from 'react';

type ScanStatus = 'idle' | 'scanning' | 'typing' | 'done';

export const useScanner = () => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  
  // Рефы для работы с DOM и API напрямую, чтобы не вызывать лишних рендеров
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Инициализация камеры
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false // Для ТикТока звук не нужен, там будет наложена музыка
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Ошибка доступа к камере:", err);
    }
  };

  // 2. Фоновая запись видео
  const startLocalRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    videoChunksRef.current = [];
    
    // Подбор кодека (с фолбэком для Safari)
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
      // Здесь будет логика сохранения файла (например, вызов невидимого <a> тега для скачивания)
      console.log("Видео готово к сохранению:", url);
    };

    recorder.start();
  };

  // 3. Мгновенный и бесшумный снимок кадра
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
        // Сжимаем в JPEG (быстро кодируется, мало весит)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
      } else {
        resolve(null);
      }
    });
  };

  // 4. Главная функция сканирования
  const triggerScan = async (recordVideo: boolean = false) => {
    setStatus('scanning');
    
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
      // Отправляем на наш Django API
      const res = await fetch('/api/v1/scan/', { method: 'POST', body: formData });
      
      // ДОБАВЛЕНА ПРОВЕРКА: Если сервер вернул не 200/202, а ошибку (например, 500)
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

  // 5. Опрос сервера
  const startPolling = (scanId: number) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/scan/${scanId}/`);
        const data = await res.json();

        if (data.status === 'completed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setAiThoughts(data.analysis.thoughts);
          setStatus('typing'); // Переводим UI в режим печатной машинки
          
          // Останавливаем видео через пару секунд после получения результата,
          // чтобы захватить момент появления текста
          setTimeout(() => {
             if (mediaRecorderRef.current?.state === 'recording') {
                 mediaRecorderRef.current.stop();
             }
             setStatus('done');
          }, 3000);
        }
      } catch (err) {
        console.error("Ошибка пуллинга:", err);
      }
    }, 1500); // Опрашиваем раз в 1.5 секунды
  };

  return {
    videoRef,
    status,
    aiThoughts,
    startCamera,
    triggerScan
  };
};