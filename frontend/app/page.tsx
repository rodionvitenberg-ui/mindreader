'use client';
import { useEffect } from 'react';
import { useScanner } from '@/hooks/useScanner'; // Тот самый хук из прошлого шага
import TypewriterText from '@/components/TypewriterText';

export default function CameraScanner() {
  const { videoRef, status, aiThoughts, startCamera, triggerScan } = useScanner();

  // Запускаем камеру при открытии приложения
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
      
      {/* 2. Мягкая виньетка для контраста (чтобы белый текст всегда читался) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

      {/* 3. Центральная UI-зона (Кнопка или Анимация загрузки) */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-10">
        
        {status === 'idle' && (
          <button 
            onClick={() => triggerScan(true)}
            className="w-20 h-20 bg-white/20 backdrop-blur-md border-4 border-white rounded-full shadow-lg transition-transform active:scale-90 flex items-center justify-center"
          >
            <div className="w-14 h-14 bg-white rounded-full opacity-80" />
          </button>
        )}

        {status === 'scanning' && (
          <div className="flex flex-col items-center space-y-4 animate-pulse">
            <div className="w-16 h-16 border-t-4 border-white/80 border-solid rounded-full animate-spin" />
            <p className="text-white/80 font-medium tracking-widest text-sm uppercase drop-shadow-md">
              Синхронизация...
            </p>
          </div>
        )}
      </div>

      {/* 4. Плавающие пузыри с мыслями (Glassmorphism) */}
      {(status === 'typing' || status === 'done') && aiThoughts.length > 0 && (
        <div className="absolute bottom-1/3 left-4 right-4 flex flex-col items-center space-y-4 pointer-events-none z-20">
          {aiThoughts.map((thought, index) => (
            <div 
              key={index}
              className="animate-float px-6 py-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-xl max-w-sm text-center"
              style={{ animationDelay: `${index * 0.5}s` }} // Пузыри покачиваются вразнобой
            >
              <p className="text-white text-lg font-medium leading-relaxed drop-shadow-sm">
                {/* Печатаем мысли по очереди. Можно усложнить, добавив задержку старта для каждого следующего пузыря */}
                <TypewriterText text={thought} speed={40} />
              </p>
            </div>
          ))}
        </div>
      )}

    </main>
  );
}