'use client';
import { useEffect, useState } from 'react';
import { useScanner } from '@/hooks/useScanner';
import TypewriterText from '@/components/TypewriterText';
import { motion, AnimatePresence } from 'framer-motion';
import { tv } from 'tailwind-variants';
import ArchiveSheet from '@/components/ArchiveSheet';

// Ламповые иконки Phosphor
import { Gear, CameraRotate, X, Archive } from '@phosphor-icons/react';

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
    cameraError, 
    profile,
    toggleCamera, 
    startCamera, 
    startHolding, 
    stopHolding, 
    resetScanner 
  } = useScanner();
  
  const [poppedIndices, setPoppedIndices] = useState<number[]>([]);
  const [isPressing, setIsPressing] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  useEffect(() => {
    startCamera();
  }, []);

  useEffect(() => {
    if (status === 'idle') {
      setPoppedIndices([]);
      setIsPressing(false);
    }
  }, [status]);

  // Сборные методы контроля реактивного зажатия
  const handleShutterStart = () => {
    if (status !== 'idle') return;
    setIsPressing(true);
    startHolding();
  };

  const handleShutterEnd = () => {
    setIsPressing(false);
    stopHolding();
  };
  
  const handleBubbleDoubleClick = (index: number) => {
    setPoppedIndices((prev) => [...prev, index]);
  };

  return (
    <main className="relative w-full h-[100dvh] bg-black overflow-hidden select-none">

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

      {/* ВЕРХНИЙ DEBUG-ИНДИКАТОР ПРОГРЕССИИ (Для отладки баланса админки) */}
      {profile && (status === 'idle' || status === 'holding') && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 inset-x-4 z-30 flex items-center justify-between px-4 py-2.5 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl pointer-events-none"
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Scanner Core</span>
            <span className="text-xs font-bold text-white/90">LVL {profile.current_level}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Hold Limit</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{profile.max_hold_seconds}.0s</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Next Core Up</span>
            <span className="text-xs font-bold text-white/80">
              {profile.scans_remaining_to_level_up > 0 ? `${profile.scans_remaining_to_level_up} scans` : 'MAX'}
            </span>
          </div>
        </motion.div>
      )}

      {/* ПРИЦЕЛЬНАЯ РАМКА (Framing Guide) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-6">
        {(status === 'idle' || status === 'holding') && (
          <>
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-20 px-5 py-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/90 text-xs font-medium tracking-wide text-center"
            >
              {status === 'holding' ? "Scanning matrix..." : "Place target inside frame & hold shutter"}
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
              <div className={`w-4 h-4 border rounded-full ${status === 'holding' ? 'border-emerald-500/40 bg-emerald-500/10 animate-ping' : 'border-white/20 animate-pulse'}`} />
            </motion.div>
          </>
        )}
      </div>

      {/* СИММЕТРИЧНЫЙ HUD УПРАВЛЕНИЯ */}
      <div className="absolute bottom-0 inset-x-0 w-full p-6 pb-12 flex items-center justify-between pointer-events-none z-10">
        
        {/* ЛЕВЫЙ БЛОК: Отмена (при сканировании) ИЛИ Настройки + Смена камеры */}
        <div className="w-1/4 flex justify-start items-center space-x-2">
          {status !== 'idle' ? (
            <button onClick={resetScanner} className={hudButton({ size: 'action' })} title="Cancel scan">
              <X size={22} weight="light" />
            </button>
          ) : (
            <>
              <button onClick={() => alert('Settings coming soon!')} className={hudButton({ size: 'action' })}>
                <Gear size={22} weight="light" />
              </button>
              <button onClick={toggleCamera} className={hudButton({ size: 'action' })} title="Flip camera">
                <CameraRotate size={22} weight="light" />
              </button>
            </>
          )}
        </div>

        {/* ЦЕНТРАЛЬНЫЙ БЛОК: Затвор */}
        <div className="w-2/4 flex flex-col items-center justify-center relative">
          {(status === 'idle' || status === 'holding') && (
            <div className="relative flex items-center justify-center">
              
              {/* Пунктирное кольцо с фиксом типизации для Framer Motion */}
              <motion.div 
                animate={{ 
                  scale: isPressing ? 1.15 : 1.05, 
                  rotate: isPressing ? 360 : 0 
                }}
                transition={
                  isPressing
                    ? { type: "tween", ease: "linear", duration: profile?.max_hold_seconds || 3, repeat: Infinity }
                    : { type: "spring", duration: 0.4 }
                }
                className="absolute inset-0 -m-3 border-2 border-dashed border-white/30 rounded-full pointer-events-none"
              />
              
              {isPressing && <div className="absolute inset-0 -m-3 bg-white/5 rounded-full blur-md animate-ping" />}
              
              {/* БРОНЕБОЙНЫЙ ИНТЕРФЕЙС УДЕРЖАНИЯ: Убрали тег button, заблокировали системный драг и контекстные меню мобилок */}
              <div 
                onMouseDown={(e) => { e.preventDefault(); handleShutterStart(); }}
                onTouchStart={(e) => { e.preventDefault(); handleShutterStart(); }}
                onMouseUp={(e) => { e.preventDefault(); handleShutterEnd(); }}
                onTouchEnd={(e) => { e.preventDefault(); handleShutterEnd(); }}
                onContextMenu={(e) => e.preventDefault()} 
                className={`${hudButton({ size: 'shutter' })} select-none touch-none cursor-pointer`}
                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              >
                <motion.div animate={{ scale: isPressing ? 0.85 : 1 }} className="w-16 h-16 bg-white rounded-full shadow-inner flex items-center justify-center pointer-events-none">
                  <div className="w-6 h-6 bg-gray-900/10 rounded-full border border-gray-950/20" />
                </motion.div>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center space-y-3 pb-2">
              <div className="w-12 h-12 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
              <p className="text-white/60 font-semibold tracking-widest text-[9px] uppercase">Processing AI</p>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center space-y-2 w-full max-w-[140px] pointer-events-auto">
              <button onClick={resetScanner} className="w-full py-2.5 bg-white text-black font-bold rounded-2xl shadow-xl text-xs tracking-wider uppercase">
                Got it 👍
              </button>
            </div>
          )}
        </div>

        {/* ПРАВЫЙ БЛОК: Секретный Архив Сохраненных Моментов */}
        <div className="w-1/4 flex justify-end">
          {status === 'idle' && (
            <button 
              onClick={() => setIsArchiveOpen(true)} 
              className={hudButton({ size: 'action' })} 
              title="Saved moments"
            >
              <Archive size={22} weight="light" />
            </button>
          )}
        </div>

      </div>

      {/* ПАРЯЩИЙ МАРМЕЛЯДНЫЙ ПУЗЫРЬ МЫСЛЕЙ */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden">
        <AnimatePresence>
          {(status === 'typing' || status === 'done' || status === 'holding') &&
            aiThoughts.map((thought, index) => {
              if (poppedIndices.includes(index)) return null;

              return (
                <motion.div
                  key={index}
                  onClick={(e: any) => {
                    e.stopPropagation();
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

      {/* КОМПОНЕНТ ШТОРКИ АРХИВА */}
      <ArchiveSheet isOpen={isArchiveOpen} setIsOpen={setIsArchiveOpen} />
    </main>
  );
}