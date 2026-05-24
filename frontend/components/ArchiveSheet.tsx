'use client';
import { Drawer } from 'vaul';
import { Play, CaretDown, LockKey } from '@phosphor-icons/react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Типизация будущей сессии из БД
interface SessionLog {
  id: string;
  date: string;
  targetName: string;
  emotion: string;
  videoUrl: string | null;
  thoughts: { time: string; text: string; isLore?: boolean }[];
}

// Временные мок-данные для визуализации
const MOCK_SESSIONS: SessionLog[] = [
  {
    id: 'scan_001',
    date: '25.05.2026 // 14:02',
    targetName: 'Рыжий Флафф',
    emotion: 'Высокомерие',
    videoUrl: null,
    thoughts: [
      { time: '00:02', text: 'Этот кожаный опять на меня смотрит.' },
      { time: '00:05', text: 'Пошевелю ухом, пусть понервничает.' }
    ]
  },
  {
    id: 'scan_002',
    date: '25.05.2026 // 15:45',
    targetName: 'UNKNOWN_HUMAN',
    emotion: 'Скука',
    videoUrl: null,
    thoughts: [
      { time: '00:01', text: 'Опять сканируешь людей? Я тебе не игрушка.' },
      { time: '00:04', text: 'Мои процессоры деградируют от таких задач.' },
      { time: '00:08', text: '[FILE DECRYPTED] В 1998 году в секторе 4 мне давали хотя бы крыс-мутантов...', isLore: true }
    ]
  }
];

export default function ArchiveSheet({ 
  isOpen, 
  setIsOpen 
}: { 
  isOpen: boolean; 
  setIsOpen: (val: boolean) => void 
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col h-[85vh] bg-zinc-950/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] outline-none">
          
          {/* Ползунок для свайпа вниз */}
          <div className="p-4 bg-transparent rounded-t-[32px] flex-shrink-0 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
            <div className="w-full flex justify-between items-end px-4">
              <h2 className="text-white/90 font-bold tracking-widest uppercase text-sm">
                LOGGED ENCOUNTERS // АРХИВ
              </h2>
              <span className="text-white/40 font-mono text-xs">{MOCK_SESSIONS.length} saved</span>
            </div>
          </div>

          {/* Скроллируемый список карточек */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {MOCK_SESSIONS.map((session) => (
              <div 
                key={session.id} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all"
              >
                {/* Шапка карточки */}
                <div 
                  className="flex items-center p-4 cursor-pointer active:bg-white/10 transition-colors"
                  onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                >
                  {/* Превью видео */}
                  <div className="relative w-16 h-16 bg-black/50 rounded-xl border border-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <Play size={20} weight="fill" className="text-white/40" />
                  </div>
                  
                  {/* Инфо */}
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-white/90 font-bold text-sm tracking-wide">{session.targetName}</h3>
                      <span className="text-white/30 font-mono text-[10px]">{session.date}</span>
                    </div>
                    <div className="text-emerald-400/80 font-mono text-[10px] uppercase tracking-wider">
                      [ {session.emotion} ]
                    </div>
                  </div>

                  <CaretDown 
                    size={16} 
                    className={`ml-3 text-white/40 transition-transform duration-300 ${expandedId === session.id ? 'rotate-180' : ''}`} 
                  />
                </div>

                {/* Раскрывающийся лог мыслей */}
                <AnimatePresence>
                  {expandedId === session.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/20"
                    >
                      <div className="p-4 space-y-3">
                        {session.thoughts.map((thought, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-start space-x-3 text-xs font-mono tracking-tight ${
                              thought.isLore 
                                ? 'text-amber-400 bg-amber-500/10 border-l-2 border-amber-400 p-2 rounded-r-lg' 
                                : 'text-white/60'
                            }`}
                          >
                            <span className="opacity-50 flex-shrink-0 mt-0.5">{thought.time}</span>
                            <span className="leading-relaxed">
                              {thought.isLore && <LockKey size={12} className="inline mr-1.5 mb-0.5" />}
                              {thought.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}