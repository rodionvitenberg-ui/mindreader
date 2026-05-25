import { get, update } from 'idb-keyval';

export interface SessionLog {
  id: string;
  timestamp: number;
  targetName: string;
  emotion: string;
  videoBlob: Blob | null;
  thoughts: string[];
}

const STORE_KEY = 'mindreader_sessions';

// Функция сохранения новой сессии (добавляет в начало списка)
export const saveSession = async (session: SessionLog) => {
  try {
    await update(STORE_KEY, (val) => {
      const arr = val ? (val as SessionLog[]) : [];
      return [session, ...arr];
    });
    console.log('✅ Сессия успешно сохранена в IndexedDB Archive');
  } catch (error) {
    console.error('❌ Ошибка сохранения сессии в IndexedDB:', error);
  }
};

// Функция получения всех сессий
export const getSessions = async (): Promise<SessionLog[]> => {
  try {
    const val = await get(STORE_KEY);
    return val ? (val as SessionLog[]) : [];
  } catch (error) {
    console.error('❌ Ошибка чтения IndexedDB:', error);
    return [];
  }
};