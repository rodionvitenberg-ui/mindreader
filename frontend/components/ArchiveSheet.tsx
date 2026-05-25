'use client';
import { Drawer } from 'vaul';
import { Play, CaretDown, LockKey, Trash } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, SessionLog } from '../lib/db';

interface ArchiveSheetProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

// Расширяем интерфейс для UI (чтобы хранить временную ссылку на видео)
interface SessionUI extends SessionLog {
  videoUrl: string | null;
  dateStr: string;
}

export default function ArchiveSheet({ isOpen, setIsOpen }: ArchiveSheetProps) {
  const [sessions, setSessions] = useState<SessionUI[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Подгружаем реальные данные из IndexedDB при каждом открытии шторки
  useEffect(() => {
    if (isOpen) {
      loadArchive();
    } else {
      // Очищаем временные URL, чтобы не было утечек памяти
      sessions.forEach(s => { if (s.videoUrl) URL.revokeObjectURL(s.videoUrl); });
      setSessions([]);
      setExpandedId(null);
    }
  }, [isOpen]);

  const loadArchive = async () => {
    const data = await getSessions();
    const uiData: SessionUI[] = data.map(session => {
      // Превращаем бинарный Blob обратно в воспроизводимое видео
      const url = session.videoBlob ? URL.createObjectURL(session.videoBlob) : null;
      
      // Форматируем дату (напр: 25.05.2026 // 14:02)
      const d = new Date(session.timestamp);
      const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()} // ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      return { ...session, videoUrl: url, dateStr };
    });
    setSessions(uiData);
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col h-[85vh] bg-zinc-950/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] outline-none">
          
          {/* Ползунок для свайпа вниз (Drag Handle) */}
          <div className="p-4 bg-transparent rounded-t-[32px] flex-shrink-0 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
            <div className="w-full flex justify-between items-end px-4">
              <h2 className="text-white/90 font-bold tracking-widest uppercase text-sm">
                LOGGED ENCOUNTERS // АРХИВ
              </h2>
              <span className="text-white/40 font-mono text-xs">{sessions.length} saved</span>
            </div>
          </div>

          {/* Скроллируемый список карточек */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {sessions.length === 0 ? (
              <div className="text-center text-white/30 font-mono text-xs mt-10 uppercase tracking-widest">
                No logs found. Database is empty.
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all">
                  
                  {/* Шапка карточки */}
                  <div 
                    className="flex items-center p-4 cursor-pointer active:bg-white/10 transition-colors"
                    onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                  >
                    {/* Видео-превью */}
                    <div className="relative w-16 h-16 bg-black rounded-xl border border-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {session.videoUrl ? (
                        <video src={session.videoUrl} className="w-full h-full object-cover opacity-60" muted />
                      ) : (
                        <Play size={20} weight="fill" className="text-white/20" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play size={20} weight="fill" className="text-white/60 drop-shadow-md" />
                      </div>
                    </div>
                    
                    {/* Инфо */}
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-white/90 font-bold text-sm tracking-wide">{session.targetName}</h3>
                        <span className="text-white/30 font-mono text-[10px]">{session.dateStr}</span>
                      </div>
                      <div className="text-emerald-400/80 font-mono text-[10px] uppercase tracking-wider">
                        [ {session.emotion} ]
                      </div>
                    </div>

                    <CaretDown size={16} className={`ml-3 text-white/40 transition-transform duration-300 ${expandedId === session.id ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Раскрывающийся лог мыслей и видеоплеер */}
                  <AnimatePresence>
                    {expandedId === session.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/40"
                      >
                        <div className="p-4 space-y-4">
                          
                          {/* Полноценный плеер для просмотра */}
                          {session.videoUrl && (
                            <div className="w-full rounded-xl overflow-hidden border border-white/10">
                              <video src={session.videoUrl} controls playsInline className="w-full h-auto" />
                            </div>
                          )}

                          {/* Текстовый лог */}
                          <div className="space-y-3 pt-2">
                            {session.thoughts.map((thought, idx) => {
                              // В будущем мы добавим флаг isLore прямо с бэкенда. Пока имитируем для теста:
                              const isLore = thought.includes('[FILE') || thought.includes('Зон');
                              return (
                                <div key={idx} className={`flex items-start space-x-3 text-xs font-mono tracking-tight ${isLore ? 'text-amber-400 bg-amber-500/10 border-l-2 border-amber-400 p-2 rounded-r-lg' : 'text-white/60'}`}>
                                  <span className="opacity-40 flex-shrink-0 mt-0.5">SEQ_{idx+1}</span>
                                  <span className="leading-relaxed">
                                    {isLore && <LockKey size={12} className="inline mr-1.5 mb-0.5" />}
                                    {thought}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}