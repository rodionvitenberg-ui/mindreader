'use client';
import { useEffect, useState, useRef } from 'react';
import { useScanner } from '@/hooks/useScanner';
import TypewriterText from '@/components/TypewriterText';
import { motion, AnimatePresence } from 'framer-motion';
import { tv } from 'tailwind-variants';

// ИМПОРТ ЛАМПОВЫХ ИКОНОК PHOSPHOR
import { Gear, CameraRotate, X, ImageSquare } from '@phosphor-icons/react';

const hudButton = tv({
  base: 'backdrop-blur-xl border flex flex-col items-center justify-center text-white/90 transition-all active:scale-95 pointer-events-auto select-none rounded-full',
  variants: {
    size: {
      action: 'w-12 h-12 bg-white/5 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]',
      shutter: 'w-22 h-22 bg-white/10 border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.25)]'
    }
  }
});

export default function CameraScanner() {
  const { 
    videoRef, 
    status, 
    aiThoughts, 
    recordedVideoUrl, 
    cameraError, 
    toggleCamera,
    startCamera, 
    triggerScan, 
    resetScanner 
  } = useScanner();
  
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [poppedIndices, setPoppedIndices] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    startCamera();
  }, []);

  useEffect(() => {
    if (status === 'idle') {
      setPoppedIndices([]);
      setIsPressing(false);
    }
  }, [status]);

  const handleGalleryClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      alert(`Медиафайл "${e.target.files[0].name}" успешно выбран для анализа!`);
    }
  };

  const handleShutterStart = () => {
    if (status !== 'idle') return;
    setIsPressing(true);
    triggerScan(true);
  };
  
const handleBubbleDoubleClick = (index: number) => {
    setPoppedIndices((prev) => [...prev, index]);
  };

  const bubblePositions = [
    { bottom: '38%', left: '8%', right: '8%' },
    { bottom: '52%', left: '12%', right: '6%' },
    { bottom: '24%', left: '6%', right: '14%' },
  ];

  return (
    <main className="relative w-full h-[100dvh] bg-black overflow-hidden select-none">
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*,video/*" 
        className="hidden" 
      />

      {cameraError && (
        <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-8 text-center text-white">
          <h2 className="text-xl font-semibold mb-2">Камера недоступна</h2>
          <button onClick={() => startCamera()} className="px-6 py-3 bg-white text-black font-semibold rounded-2xl text-sm">
            Обновить поток
          </button>
        </div>
      )}

      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none z-0" />

      {/* ПРИЦЕЛЬНАЯ РАМКА */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-6">
        {status === 'idle' && (
          <>
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-16 px-5 py-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/90 text-xs font-medium tracking-wide text-center"
            >
              Place pet inside the frame & hold shutter
            </motion.div>

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-72 h-72 rounded-[40px] relative flex items-center justify-center"
            >
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-[24px]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-[24px]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-[24px]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-[24px]" />
              <div className="w-4 h-4 border border-white/20 rounded-full animate-pulse" />
            </motion.div>
          </>
        )}
      </div>

      {/* СИММЕТРИЧНЫЙ HUD С СЕМЕЙСТВОМ PHOSPHOR */}
      <div className="absolute bottom-0 inset-x-0 w-full p-6 pb-12 flex items-center justify-between pointer-events-none z-10">
        
        {/* ЛЕВЫЙ БЛОК: Отмена (при сканировании) ИЛИ Настройки + Смена камеры (в простое) */}
        <div className="w-1/4 flex justify-start items-center space-x-2">
          {status !== 'idle' ? (
            <button onClick={resetScanner} className={hudButton({ size: 'action' })} title="Cancel scan">
              {/* Phosphor X (крестик отмены) */}
              <X size={22} weight="light" />
            </button>
          ) : (
            <>
              <button onClick={() => alert('Settings coming soon!')} className={hudButton({ size: 'action' })}>
                {/* Phosphor Gear (шестеренка) */}
                <Gear size={22} weight="light" />
              </button>
              <button onClick={toggleCamera} className={hudButton({ size: 'action' })} title="Flip camera">
                {/* Phosphor CameraRotate (разворот стрима) */}
                <CameraRotate size={22} weight="light" />
              </button>
            </>
          )}
        </div>

        {/* ЦЕНТРАЛЬНЫЙ БЛОК: Затвор */}
        <div className="w-2/4 flex flex-col items-center justify-center relative">
          {status === 'idle' && (
            <div className="relative flex items-center justify-center">
              <motion.div 
                animate={{ scale: isPressing ? 1.15 : 1.05, rotate: isPressing ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className="absolute inset-0 -m-3 border-2 border-dashed border-white/30 rounded-full pointer-none"
              />
              {isPressing && <div className="absolute inset-0 -m-3 bg-white/5 rounded-full blur-md animate-ping" />}
              <button 
                onMouseDown={handleShutterStart}
                onTouchStart={handleShutterStart}
                className={hudButton({ size: 'shutter' })}
              >
                <motion.div animate={{ scale: isPressing ? 0.85 : 1 }} className="w-16 h-16 bg-white rounded-full shadow-inner flex items-center justify-center">
                  <div className="w-6 h-6 bg-gray-900/10 rounded-full border border-gray-950/20" />
                </motion.div>
              </button>
            </div>
          )}

          {status === 'scanning' && (
            <div className="flex flex-col items-center space-y-3 pb-2">
              <div className="w-12 h-12 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
              <p className="text-white/60 font-semibold tracking-widest text-[9px] uppercase">Processing</p>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center space-y-2 w-full max-w-[140px] pointer-events-auto">
              {recordedVideoUrl && (
                <button onClick={() => setShowVideoPreview(true)} className="w-full py-3 bg-white text-black font-bold rounded-2xl shadow-xl text-xs tracking-wider uppercase">
                  Moment 🎬
                </button>
              )}
              <button onClick={resetScanner} className="w-full py-2 bg-white/10 backdrop-blur-md border border-white/15 text-white/90 font-medium rounded-2xl text-[10px] tracking-wider uppercase">
                Reset 🔄
              </button>
            </div>
          )}
        </div>

        {/* ПРАВЫЙ БЛОК: Импорт из галереи */}
        <div className="w-1/4 flex justify-end">
          {status === 'idle' && (
            <button onClick={handleGalleryClick} className={hudButton({ size: 'action' })} title="Import from gallery">
              {/* Phosphor ImageSquare (галерея картинок) */}
              <ImageSquare size={22} weight="light" />
            </button>
          )}
        </div>

      </div>

      {/* ПАРЯЩИЙ МАРМЕЛЯДНЫЙ ПУЗЫРЬ МЫСЛЕЙ */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden">
        <AnimatePresence>
          {(status === 'typing' || status === 'done') &&
            aiThoughts.map((thought, index) => {
              if (poppedIndices.includes(index)) return null;

              return (
                <motion.div
                  key={index}
                  
                  // ЧЕТКИЙ ИСПРАВЛЕННЫЙ ИНТЕРФЕЙС ТАЧЕЙ С ЗАЩИТОЙ ДЛЯ TS
                  onClick={(e: any) => {
                    e.stopPropagation(); // Блокируем проваливание клика на слои камеры под пузырем
                    
                    // Нативный счетчик кликов: 2 означает быстрый двойной тап
                    if (e.detail === 2) {
                      handleBubbleDoubleClick(index);
                    }
                  }}
                  
                  drag
                  dragConstraints={{ left: -30, right: 30, top: -40, bottom: 40 }}
                  dragElastic={0.4}
                  dragTransition={{ bounceStiffness: 200, bounceDamping: 15 }}
                  initial={{ scale: 0, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: [0, -10, 4, -6, 0], x: [0, 6, -6, 4, 0] }}
                  exit={{ scale: 1.3, opacity: 0, filter: "blur(12px)", transition: { duration: 0.2, ease: "easeOut" } }}
                  transition={{
                    type: "spring",
                    stiffness: 80,
                    damping: 12,
                    y: { repeat: Infinity, duration: 4.5, ease: "easeInOut" },
                    x: { repeat: Infinity, duration: 5.5, ease: "easeInOut" }
                  }}
                  className="absolute bottom-[38%] left-8 right-8 px-6 py-5 bg-gradient-to-br from-white/18 via-white/6 to-transparent backdrop-blur-xl border border-white/25 rounded-[32px] shadow-[0_25px_60px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(255,255,255,0.45)] text-center pointer-events-auto cursor-grab active:cursor-grabbing"
                >
                  <p className="text-white text-base font-medium leading-relaxed tracking-wide drop-shadow-md">
                    <TypewriterText text={thought} speed={30} />
                  </p>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* ПОЛНОЭКРАННЫЙ ПЛЕЕР */}
      {showVideoPreview && recordedVideoUrl && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-50 flex flex-col justify-between p-6">
          <div className="flex justify-between items-center w-full pt-4">
            <h3 className="text-white/80 font-medium tracking-wide">Записанное мгновение</h3>
            <button onClick={() => setShowVideoPreview(false)} className="text-white/60 hover:text-white text-xs font-medium px-4 py-1.5 rounded-full bg-white/10">
              Закрыть
            </button>
          </div>
          <div className="w-full h-[65vh] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 my-auto bg-black">
            <video src={recordedVideoUrl} controls autoPlay loop playsInline className="w-full h-full object-cover" />
          </div>
          <div className="w-full flex justify-center pb-6">
            <a href={recordedVideoUrl} download="pet-moment.mp4" className="w-full max-w-xs py-4 bg-white text-black font-semibold rounded-2xl shadow-xl text-center text-sm">
              Сохранить в галерею
            </a>
          </div>
        </div>
      )}

    </main>
  );
}