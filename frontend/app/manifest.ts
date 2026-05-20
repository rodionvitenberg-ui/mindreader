import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PetMind — Читатель Мыслей Питомцев',
    short_name: 'PetMind',
    description: 'Узнайте, о чем думает ваш питомец с помощью ИИ',
    start_url: '/',
    display: 'standalone', // Запуск во весь экран, без адресной строки браузера
    background_color: '#0b0f19', // Цвет заставки приложения (наш темный фон)
    theme_color: '#0b0f19',
    orientation: 'portrait', // Жесткая портретная ориентация камеры
    icons: [
      {
        src: '/file.svg', // Пока используем стандартный, потом заменим на логотип
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}