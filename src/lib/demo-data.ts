import type { ProjectTz, BuildStage, Deviation } from '@/types';

// Демо-ТЗ, распознанное с бланка заказа (эскиз прихожей, присланный заказчиком)
export const DEMO_TZ: ProjectTz = {
  title: 'Прихожая по бланку заказа №1791',
  overall: [
    { key: 'w', label: 'Ширина общая', value: '2876 мм', confidence: 'confirmed', source: 'эскиз, размерная линия' },
    { key: 'h', label: 'Высота', value: '2600 мм', confidence: 'confirmed', source: 'эскиз, размерная линия' },
    { key: 'd', label: 'Глубина нижних модулей', value: '450 мм', confidence: 'confirmed', source: 'пометка «гл/б 450»' },
    { key: 'd2', label: 'Глубина верхних модулей', value: '—', confidence: 'assumption', source: 'на эскизе не указано' },
  ],
  composition: [
    { key: 'c1', label: 'Секция 1 (ш 960)', value: '4 полки, стойки', confidence: 'confirmed', source: 'проекция, выноска' },
    { key: 'c2', label: 'Секция 2 (ш 450)', value: '3 выдвижных ящика, тандембоксы', confidence: 'confirmed', source: 'таблица бланка + проекция' },
    { key: 'c3', label: 'Секция 3 (ш 600)', value: 'вешало, штанга', confidence: 'calculated', source: 'выноска «прихожая», типовой комплект' },
    { key: 'c4', label: 'Антресоли', value: 'по ширине 3 секций, фасады распашные', confidence: 'confirmed', source: 'верхняя проекция' },
    { key: 'c5', label: 'Фасады', value: 'ЛДСП Эггер U707 ST9, шёлк серый', confidence: 'confirmed', source: 'таблица бланка' },
  ],
  materials: [
    { key: 'm1', label: 'Корпус', value: 'ЛДСП 16, Кроношпан (по библиотеке)', confidence: 'confirmed', source: 'таблица бланка' },
    { key: 'm2', label: 'Кромка', value: 'ПВХ 0,8 в цвет корпуса', confidence: 'calculated', source: 'стандарт предприятия' },
    { key: 'm3', label: 'Петли', value: 'с доводчиком (библиотека)', confidence: 'confirmed', source: 'таблица бланка' },
    { key: 'm4', label: 'Ручки', value: 'профиль GOLA, до пола', confidence: 'confirmed', source: 'рукописная пометка «ручки… до пола»' },
  ],
  roomConstraints: [
    { key: 'r1', label: 'Батарея', value: 'левая стена, выступ ~120 мм', confidence: 'assumption', source: 'фото замера 2' },
    { key: 'r2', label: 'Дверца секции 3', value: 'проверить открывание — рядом простенок', confidence: 'calculated', source: 'фото замера 1' },
  ],
  unresolved: [
    { key: 'd2', question: 'Не нашёл на эскизе глубину верхних модулей (антресолей). По стандарту предприятия ставлю 350 мм — подтверждаете?' },
  ],
};

export const BUILD_STAGES: Omit<BuildStage, 'status'>[] = [
  { id: 's1', label: 'Каркас и стойки', detail: 'ЛДСП 16, конфирматы по правилу №12' },
  { id: 's2', label: 'Полки и ящики', detail: 'шаг полок по проёму, тандембоксы из комплекта' },
  { id: 's3', label: 'Фасады', detail: 'зазоры 2 мм по стандарту, петли с доводчиком' },
  { id: 's4', label: 'Кромки и присадка', detail: 'ПВХ 0,8; присадка под петли и направляющие' },
  { id: 's5', label: 'Проверка по правилам предприятия', detail: 'правила предприятия + Inspector БАЗИС' },
  { id: 's6', label: 'Завершение построения', detail: 'модель готова в БАЗИС, сохранение — за технологом' },
];

export const DEMO_DEVIATIONS: Omit<Deviation, 'id' | 'status' | 'ts'>[] = [
  {
    title: 'Несовпадение по наполнению секции 2',
    sketch: 'на эскизе предусмотрено 3 выдвижных ящика',
    model: 'в текущей модели построено 2 ящика',
  },
  {
    title: 'Риск по помещению',
    sketch: 'на фото замера — батарея у левой стены (выступ ~120 мм)',
    model: 'левая дверца открывается в сторону батареи',
  },
];

let counter = 0;
export const uid = () => `id_${Date.now()}_${++counter}`;

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
