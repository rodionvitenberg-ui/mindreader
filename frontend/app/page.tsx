'use client';
import { useEffect, useState } from 'react';
import { useScanner } from '@/hooks/useScanner';
import TypewriterText from '@/components/TypewriterText';

export default function CameraScanner() {
  const { videoRef, status, aiThoughts, recordedVideoUrl, startCamera, triggerScan, resetScanner } = useScanner();
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  useEffect(() => {
    startCamera();
  }, []);

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden select-none">
      
      {/* 1. Живая камера */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="absolute inset-0 w-full h-full object-cover" 
      />
      
      {/* 2. Мягкая кинематографичная виньетка */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

      {/* 3. Центральная UI-зона управления */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-10">
        
        {status === 'idle' && (
          <button 
            onClick={() => triggerScan(true)} // Включаем запись видео при клике
            className="w-20 h-20 bg-white/20 backdrop-blur-md border-4 border-white rounded-full shadow-lg transition-transform active:scale-90 flex items-center justify-center"
          >
            <div className="w-14 h-14 bg-white rounded-full opacity-80" />
          </button>
        )}

        {status === 'scanning' && (
          <div className="flex flex-col items-center space-y-4 animate-pulse">
            <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 font-medium tracking-widest text-xs uppercase drop-shadow-md">
              Слушаем мысли...
            </p>
          </div>
        )}

        {/* Когда всё готово, плавно показываем кнопки действий */}
        {status === 'done' && (
          <div className="flex flex-col items-center space-y-3 w-full px-6 transition-all duration-500 ease-out translate-y-0 opacity-100">
            {recordedVideoUrl && (
              <button
                onClick={() => setShowVideoPreview(true)}
                className="w-full max-w-xs py-4 bg-white text-black font-semibold rounded-2xl shadow-xl transition-all active:scale-95 text-center text-sm tracking-wide"
              >
                Посмотреть мгновение
              </button>
            )}
            <button
              onClick={resetScanner}
              className="w-full max-w-xs py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium rounded-2xl transition-all active:scale-95 text-center text-sm tracking-wide"
            >
              Сканировать снова
            </button>
          </div>
        )}
      </div>

      {/* 4. Парящие пузыри с мыслями */}
      {(status === 'typing' || status === 'done') && aiThoughts.length > 0 && (
        <div className="absolute bottom-1/3 left-4 right-4 flex flex-col items-center space-y-4 pointer-events-none z-20">
          {aiThoughts.map((thought, index) => (
            <div 
              key={index}
              className="animate-float px-6 py-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-xl max-w-sm text-center"
              style={{ animationDelay: `${index * 0.5}s` }}
            >
              <p className="text-white text-lg font-medium leading-relaxed drop-shadow-sm">
                <TypewriterText text={thought} speed={40} />
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 5. Ламповый полноэкранный плеер для превью записанного ролика */}
      {showVideoPreview && recordedVideoUrl && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl z-50 flex flex-col justify-between p-6 transition-all duration-300">
          <div className="flex justify-between items-center w-full pt-4">
            <h3 className="text-white/80 font-medium tracking-wide">Записанное мгновение</h3>
            <button 
              onClick={() => setShowVideoPreview(false)}
              className="text-white/60 hover:text-white text-sm font-medium px-3 py-1 rounded-full bg-white/10"
            >
              Закрыть
            </button>
          </div>

          {/* Видео превью */}
          <div className="w-full h-[65vh] rounded-3xl overflow-hidden shadow-2xl border border-white/10 my-auto bg-black">
            <video 
              src={recordedVideoUrl} 
              controls 
              autoPlay 
              loop 
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Кнопка "Сохранить на телефон" */}
          <div className="w-full flex justify-center pb-6">
            <a
              href={recordedVideoUrl}
              download="pet-moment.mp4"
              className="w-full max-w-xs py-4 bg-white text-black font-semibold rounded-2xl shadow-xl active:scale-95 text-center text-sm"
            >
              Сохранить в галерею смартфона
            </a>
          </div>
        </div>
      )}

    </main>
  );
}