import type { ProjectTz, TzField } from '@/types';

/**
 * Консультант по эскизу: отвечает СТРОГО из данных распознанного ТЗ.
 * Если информации на эскизе нет — честно отказывается и предлагает дозапрос,
 * ничего не «додумывает».
 */

function find(tz: ProjectTz, re: RegExp): TzField[] {
  const all = [...tz.overall, ...tz.composition, ...tz.materials, ...tz.roomConstraints];
  return all.filter((f) => re.test(f.label) || re.test(f.value));
}

function cite(fields: TzField[]): string {
  return fields.map((f) => `• ${f.label}: ${f.value} (источник: ${f.source})`).join('\n');
}

const REFUSAL = (topic: string) =>
  `На эскизе этого нет: я не вижу в бланке информации по запросу «${topic}». Придумывать не буду — по правилам предприятия я отвечаю только по эскизу и библиотеке. ` +
  `Могу зафиксировать это как открытый вопрос к заказу и спросить вас при формировании ТЗ.`;

export function consultBySketch(tz: ProjectTz, question: string): string {
  const q = question.toLowerCase();

  // Куда поставить / как разместить — только ограничения помещения и состав из ТЗ
  if (/куда|размест|располож|поставить|поставлю|установ/i.test(q)) {
    const room = tz.roomConstraints;
    const comp = find(tz, /секци|фасад|антресол/i);
    let out = 'Отвечаю по эскизу и замерам, без домыслов.\n\nЧто ограничивает расстановку (с фото замеров):\n';
    out += room.length ? cite(room) : '• ограничений не распознано';
    out += '\n\nСостав по эскизу (что где стоит):\n' + cite(comp);
    out += '\n\nЕсли нужно решение по конкретному элементу — уточните, о каком речь, я проверю его по эскизу.';
    return out;
  }

  // Что использовать — только материалы/фурнитура из ТЗ (библиотека предприятия)
  if (/что (мне )?использов|какой материал|какую фурнитур|из чего|чем кром/i.test(q)) {
    const mats = tz.materials;
    if (!mats.length) return REFUSAL('материалы/фурнитура');
    return 'По эскизу и библиотеке предприятия (стороннего не предлагаю):\n' + cite(mats);
  }

  // Тематические запросы по элементам
  const topics: [RegExp, string][] = [
    [/ящик/i, 'ящик'],
    [/фасад|дверц|дверь/i, 'фасад'],
    [/петл/i, 'петл'],
    [/ручк/i, 'ручк'],
    [/полк/i, 'полк'],
    [/антресол/i, 'антресол'],
    [/батаре|радиатор|труб|розетк/i, 'батаре'],
    [/кромк/i, 'кромк'],
    [/штанг|вешал/i, 'штанг'],
    [/габарит|размер|ширин|высот|глубин/i, ''],
  ];
  for (const [re, key] of topics) {
    if (re.test(q)) {
      const found = key ? find(tz, new RegExp(key, 'i')) : [...tz.overall];
      if (found.length) {
        return 'Вот что сказано об этом на эскизе (другого не знаю):\n' + cite(found);
      }
      return REFUSAL(question.slice(0, 60));
    }
  }

  // Ничего не совпало — честный отказ
  return REFUSAL(question.slice(0, 60));
}
