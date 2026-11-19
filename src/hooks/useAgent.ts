import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage, Deviation, JournalEntry, Mode, ProjectTz, BuildStage,
  UploadedImage, Verbosity, JournalKind,
} from '@/types';
import { DEMO_TZ, BUILD_STAGES, DEMO_DEVIATIONS, uid, delay } from '@/lib/demo-data';
import { consultBySketch } from '@/lib/consult';
import { collidesWith, partRect, freeSpotRightOf } from '@/lib/scene-geo';

const LS_JOURNAL = 'bazis-agent:journal';
const LS_VERBOSITY = 'bazis-agent:verbosity';

const TECHNOLOG_NAME = 'Технолог (вы)';

/** Разбор команды постановки элемента: «поставь ещё 1 ящик влево внизу», «добавь 2 полки справа вверху» */
const KIND_MAP: [RegExp, string][] = [
  [/ящик/i, 'Ящик'], [/полк/i, 'Полка'], [/дверц|фасад/i, 'Фасад'], [/панел/i, 'Панель'], [/шкаф/i, 'Шкаф'],
];
export function parsePlacementCommand(text: string): { kind: string; pos: string; count: number; posLabel: string } | null {
  if (!/поставь|добавь|размести|вставь|пристрой/i.test(text)) return null;
  const kind = KIND_MAP.find(([re]) => re.test(text))?.[1];
  if (!kind) return null;
  const horiz = /влево|слева|левее/i.test(text) ? 'l' : /вправо|справа|правее/i.test(text) ? 'r' : 'c';
  const vert = /вверх|наверх|сверху/i.test(text) ? 't' : /вниз|снизу/i.test(text) ? 'b' : 'c';
  const pos = vert + horiz;
  const num = text.match(/(\d+)\s*(?:шт|штук)?/i);
  const count = num ? Math.min(6, parseInt(num[1], 10)) : 1;
  const posLabel =
    (vert === 't' ? 'сверху' : vert === 'b' ? 'снизу' : 'по центру по высоте') + ', ' +
    (horiz === 'l' ? 'слева' : horiz === 'r' ? 'справа' : 'по центру');
  return { kind, pos, count, posLabel };
}

/** Откат по разговорной команде: «откати на 4 этап», «откат к фасадам» */
const STAGE_ALIASES: [RegExp, number][] = [
  [/каркас|стойк/i, 1], [/полк|перегород/i, 2], [/фасад|дверц/i, 3],
  [/кромк|присад/i, 4], [/провер/i, 5], [/заверш|габарит/i, 6],
];
function parseRollback(text: string): number | null {
  if (!/откат|отмени этап|верни/i.test(text)) return null;
  const num = text.match(/(\d)\s*(этап)?/i);
  if (num) return Math.max(1, Math.min(6, parseInt(num[1], 10)));
  const byName = STAGE_ALIASES.find(([re]) => re.test(text));
  return byName ? byName[1] : null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(), role: 'technolog', ts: Date.now(),
      text: 'Здравствуйте! Пришлите фото бланка заказа, эскиза или замеров — сформирую ТЗ и предложу режимы: построю сам или буду помогать вам в БАЗИС-Мебельщик.',
    },
  ]);
  const [mode, setMode] = useState<Mode>('idle');
  const [tz, setTz] = useState<ProjectTz | null>(null);
  const [stages, setStages] = useState<BuildStage[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  // Элементы, которые технолог добавил сам в окне-прототипе БАЗИС.
  // pos — позиция по голосовой команде (сетка 3×3), x/y — точные координаты (клик/перетаскивание на чертеже)
  const [userParts, setUserParts] = useState<{ id: string; kind: string; pos?: string; x?: number; y?: number }[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>(() => load(LS_JOURNAL, []));
  const [verbosity, setVerbosity] = useState<Verbosity>(() => load(LS_VERBOSITY, 1));
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  // Подтверждение ответа на вопрос агента: «Записал X. Подтверждаете?»
  const [pendingConfirm, setPendingConfirm] = useState<{ valueStr: string; corrected: boolean } | null>(null);
  // Элементы технолога, по которым уже спрашивали «подогнать или исправить»
  const askedFit = useRef<Set<string>>(new Set());

  useEffect(() => { localStorage.setItem(LS_JOURNAL, JSON.stringify(journal)); }, [journal]);
  useEffect(() => { localStorage.setItem(LS_VERBOSITY, JSON.stringify(verbosity)); }, [verbosity]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const say = useCallback((role: ChatMessage['role'], text: string, extra?: Partial<ChatMessage>) => {
    setMessages((m) => [...m, { id: uid(), role, text, ts: Date.now(), ...extra }]);
  }, []);

  const log = useCallback((kind: JournalKind, text: string, author = 'Агент') => {
    setJournal((j) => [...j, { id: uid(), kind, text, author, ts: Date.now() }]);
  }, []);

  // Прокладки на функции, объявленные ниже (стоп/продолжай/откат из диалога)
  const pauseFnRef = useRef<() => void>(() => {});
  const resumeFnRef = useRef<() => void>(() => {});
  const runStagesFnRef = useRef<(from: number) => void>(() => {});
  const restartFnRef = useRef<() => void>(() => {});
  const startFnRef = useRef<() => void>(() => {});

  /** Пользователь отправил сообщение и/или изображения */
  const sendUser = useCallback(async (text: string, images: UploadedImage[]) => {
    const t = text.trim();

    // «Стоп» — останавливает построение словом, без кнопки (работает и во время построения, поэтому ДО проверки busy)
    if (/^(стоп|останови|остановись|стой|хватит)([\s,.!]|$)/i.test(t) && mode === 'autonomous') {
      if (text.trim() || images.length) {
        setMessages((m) => [...m, { id: uid(), role: 'user', text, ts: Date.now(), attachments: images }]);
      }
      pauseFnRef.current();
      return;
    }
    // «Продолжай» — возобновляет после остановки
    if (/^(продолжай|дальше|продолжить|продолжим|погнали)([\s,.!]|$)/i.test(t)) {
      if (mode === 'paused') {
        if (text.trim() || images.length) {
          setMessages((m) => [...m, { id: uid(), role: 'user', text, ts: Date.now(), attachments: images }]);
        }
        resumeFnRef.current();
        return;
      }
      if (mode === 'done') {
        say('technolog', 'Построение уже завершено — продолжать нечего. Могу: отредактировать размеры («измени глубину на 280»), откатить этап («откати на 3 этап») или начать новый проект.');
        return;
      }
    }
    if (busy) return;
    if (text.trim() || images.length) {
      setMessages((m) => [...m, { id: uid(), role: 'user', text, ts: Date.now(), attachments: images }]);
    }

    // Откат: «откати на 4 этап», «откат к фасадам» — проверяем ДО подтверждения, чтобы команда не «утонула» в нём
    const rbStage = t ? parseRollback(t) : null;
    if (rbStage !== null) {
      setPendingConfirm(null);
      if (!stages.length && mode !== 'done') {
        say('technolog', 'Откатывать пока нечего — построение ещё не начиналось. Пришлите эскиз или запустите построение.');
        return;
      }
      const fromIdx = rbStage - 1;
      setStages(BUILD_STAGES.map((s, j) => ({ ...s, status: j < fromIdx ? 'done' as const : j === fromIdx ? 'active' as const : 'pending' as const })));
      pauseRef.current = false;
      stageIdx.current = fromIdx;
      setMode('autonomous');
      setBusy(true);
      say('konstruktor', `Откатил построение к этапу ${rbStage} «${BUILD_STAGES[fromIdx].label}». Перестраиваю с этого места — этапы до него сохранены. Скажите «стоп», если хотите вмешаться самому — потом подхвачу.`);
      log('undo', `Откат построения к этапу ${rbStage} «${BUILD_STAGES[fromIdx].label}» по команде технолога`, TECHNOLOG_NAME);
      void runStagesFnRef.current(fromIdx);
      return;
    }
    if (/откат|отмени|верни/i.test(t) && !rbStage) {
      say('technolog', 'Уточните, куда откатить: номер этапа («откати на 4 этап») или название («откат к фасадам»). Этапы: 1 Каркас, 2 Полки, 3 Фасады, 4 Кромки и присадка, 5 Проверка, 6 Завершение.');
      return;
    }

    // Построение по слову: «построй», «перестрой заново» — работает в любом состоянии после ТЗ
    // (раньше «построй» в завершённой сессии уходило в консультацию и ничего не строило)
    if (/постро|перестро|выстрой|заново|сначала/i.test(t) && tz && (mode === 'done' || mode === 'paused')) {
      restartFnRef.current();
      return;
    }
    if (/построй|выстрой|начинай строить/i.test(t) && tz && (mode === 'tz_ready' || mode === 'assist')) {
      startFnRef.current();
      return;
    }

    // Подтверждение ответа на вопрос агента: «Записал: 250 мм. Подтверждаете?»
    if (pendingConfirm && tz) {
      if (/^(да|подтверждаю|верно|ага|ок|окей|конечно|точно)([\s,.!]|$)/i.test(t)) {
        const { valueStr, corrected } = pendingConfirm;
        setPendingConfirm(null);
        setTz((prev) => prev && {
          ...prev,
          overall: prev.overall.map((f) => f.key === 'd2' ? { ...f, value: valueStr, confidence: 'confirmed' as const, source: 'решение технолога' } : f),
          unresolved: prev.unresolved.map((u) => ({ ...u, answer: `${valueStr} (подтверждено)` })),
        });
        if (corrected) {
          log('decision', `Технолог изменил глубину верхних модулей: 350 → ${valueStr} (подтверждено, приоритет слова технолога)`, TECHNOLOG_NAME);
        }
        setBusy(true);
        await delay(700);
        say('technolog', `Зафиксировал: глубина верхних модулей — ${valueStr}. ТЗ сформировано полностью. Выберите режим работы:`, {
          actions: [
            { id: uid(), label: 'Агент построит сам', kind: 'primary', event: 'mode_autonomous' },
            { id: uid(), label: 'Буду строить сам (с подсказками)', kind: 'ghost', event: 'mode_assist' },
          ],
        });
        setBusy(false);
        return;
      }
      if (/^(нет|не|отмена|неправильно|неверно)([\s,.!]|$)/i.test(t)) {
        setPendingConfirm(null);
        say('technolog', 'Понял, не записываю. Тогда уточните: какая глубина верхних модулей (в мм)?');
        return;
      }
      // Новое значение вместо «да/нет» — считаем его ответом и снова просим подтвердить
      const m2 = t.match(/(\d{2,4})\s*(мм|mm|см|cm)?/i);
      if (m2) {
        let v = parseInt(m2[1], 10);
        if (/см|cm/i.test(m2[2] ?? '')) v *= 10;
        setPendingConfirm({ valueStr: `${v} мм`, corrected: true });
        say('technolog', `Так, записал: глубина верхних модулей — ${v} мм. Подтверждаете? (да/нет)`);
        return;
      }
      say('technolog', 'Подтвердите, пожалуйста: «да» — записываю, «нет» — не записываю. Или назовите своё значение в мм.');
      return;
    }

    // Если ждём ответ на вопрос по ТЗ — принимаем, повторяем как поняли и ПРОСИМ подтвердить.
    // Правило: слово технолога — приоритет; его значение берём вместо стандарта.
    if (mode === 'tz_ready' && tz?.unresolved.some((u) => !u.answer) && t) {
      const m = t.match(/(\d{2,4})\s*(мм|mm|см|cm)?/i);
      let depthMm = 350; // стандарт предприятия
      let corrected = false;
      if (m && !/^(да|подтверждаю|ага|ок)([\s,.!]|$)/i.test(t)) {
        let v = parseInt(m[1], 10);
        if (/см|cm/i.test(m[2] ?? '')) v *= 10;
        if (v !== depthMm) { depthMm = v; corrected = true; }
      }
      const valueStr = `${depthMm} мм`;
      setPendingConfirm({ valueStr, corrected });
      await delay(400);
      say('technolog', `Понял вас так: глубина верхних модулей — ${valueStr}${corrected ? ' (ваше значение вместо стандарта 350 мм)' : ''}. Подтверждаете? (да/нет)`);
      return;
    }

    // Первичный приём входа
    if (mode === 'idle' && (images.length || /постро|сделай|эскиз|замер|заказ/i.test(t))) {
      setMode('intake');
      setBusy(true);
      await delay(800);
      say('technolog', 'Получил ' + (images.length ? `${images.length} изображ.` : 'задание') + '. Распознаю бланк: нормализую поворот, читаю проекции, размеры, пометки и таблицу материалов…');
      await delay(1600);
      say('technolog', 'Распознал изделие: прихожая 2876×2600. Сверил материалы с библиотекой предприятия — ЛДСП Эггер U707, Кроношпан, петли с доводчиком и тандембоксы найдены, артикулы утверждены.');
      await delay(900);
      setTz(DEMO_TZ);
      setMode('tz_ready');
      log('decision', 'Сформировано ТЗ по бланку заказа №1791 (распознавание с изображений)');
      say('technolog', 'Сводка ТЗ — на панели справа. Один вопрос: ' + DEMO_TZ.unresolved[0].question);
      setBusy(false);
      return;
    }

    // Команда постановки элемента (голосом или текстом): «поставь ещё 1 ящик влево внизу»
    const cmd = t ? parsePlacementCommand(t) : null;
    if (cmd) {
      if (!tz) {
        say('technolog', 'Понял команду, но модели ещё нет: сначала пришлите эскиз — сформирую ТЗ, и я начну ставить элементы куда скажете.');
        return;
      }
      for (let i = 0; i < cmd.count; i++) {
        setUserParts((p) => [...p, { id: uid(), kind: cmd.kind, pos: cmd.pos }]);
      }
      log('decision', `По команде технолога добавлено: ${cmd.kind} × ${cmd.count} (${cmd.posLabel})`, TECHNOLOG_NAME);
      say('konstruktor', `Выполнил: ${cmd.kind.toLowerCase()} × ${cmd.count} — ${cmd.posLabel}. Элемент стоит в модели (видно в окне БАЗИС). Если не туда — скажите, передвину.`);
      return;
    }

    // Правка размера после построения: «измени глубину на 280», «переделай ширину 3000»
    const editM = t.match(/(глубин|ширин|высот)\w*\D{0,20}(\d{2,4})/i);
    if (editM && tz && (mode === 'done' || mode === 'paused' || mode === 'assist')) {
      const dimWord = editM[1].toLowerCase();
      const v = parseInt(editM[2], 10);
      const key = dimWord.startsWith('глубин') ? 'd2' : dimWord.startsWith('ширин') ? 'd1' : 'd3';
      setTz((prev) => prev && {
        ...prev,
        overall: prev.overall.map((f) => f.key === key ? { ...f, value: `${v} мм`, confidence: 'confirmed' as const, source: 'правка технолога после построения' } : f),
      });
      log('decision', `Правка после построения: ${dimWord} = ${v} мм`, TECHNOLOG_NAME);
      say('konstruktor', `Принял правку: ${dimWord}а — ${v} мм. Внёс в ТЗ как ваше решение. Если нужно перестроить часть модели — скажите «откати на N этап», перестрою.`);
      return;
    }

    // Свободная консультация — строго по данным эскиза (ТЗ)
    if (tz && t && (mode === 'tz_ready' || mode === 'assist' || mode === 'done')) {
      setBusy(true);
      await delay(700);
      say('technolog', consultBySketch(tz, t));
      setBusy(false);
      return;
    }
    if (!tz && t && mode === 'idle') {
      say('technolog', 'Чтобы советовать, мне нужен эскиз: я отвечаю только по данным бланка и замеров, ничего не придумываю. Пришлите фото бланка заказа или эскиза.');
      return;
    }
    // Непонятное/ошибочное — честно переспрашиваю и подсказываю, что умею
    say('technolog', 'Не совсем понял, что вы имеете в виду — перефразируйте. Я умею: строить по эскизу, ставить элементы («поставь ящик влево внизу»), откатывать («откати на 3 этап»), останавливаться («стоп»), продолжать («продолжай»), менять размеры («измени глубину на 280») и отвечать на вопросы по эскизу.');
  }, [busy, mode, tz, stages, pendingConfirm, say, log]);

  // Управление автономным построением: пауза/продолжение с любого этапа
  const stageIdx = useRef(0);
  const pauseRef = useRef(false);

  /** Прогон этапов построения, начиная с startIdx. Останавливается на паузе, продолжается с того же этапа. */
  const runStages = useCallback(async (startIdx: number) => {
    for (let i = startIdx; i < BUILD_STAGES.length; i++) {
      if (pauseRef.current) { stageIdx.current = i; return; }
      const st = BUILD_STAGES[i];
      await delay(verbosity === 0 ? 1100 : verbosity === 1 ? 1700 : 2200);
      if (pauseRef.current) { stageIdx.current = i; return; }
      setStages((prev) => prev.map((p, j) => ({ ...p, status: j < i ? 'done' : j === i ? 'active' : 'pending' })));
      if (verbosity >= 1) {
        say('konstruktor', `Этап «${st.label}»: ${st.detail}.`);
      }
      await delay(verbosity === 0 ? 900 : 1400);
      if (pauseRef.current) { stageIdx.current = i; return; }
      setStages((prev) => prev.map((p, j) => ({ ...p, status: j <= i ? 'done' : 'pending' })));
      log('build', `Этап «${st.label}» выполнен`);
    }
    if (pauseRef.current) { stageIdx.current = BUILD_STAGES.length; return; }
    say('sborschik', 'Проверка завершена: пересечений нет, панели закреплены, все материалы и фурнитура — из библиотеки предприятия. Ограничение помещения учтено: левая дверца перенавешена, батарея не мешает открыванию.');
    say('konstruktor', 'Построение завершено — модель готова прямо в БАЗИС-Мебельщик. Сохраните проект как обычно, куда вам нужно. Протокол построения записан в журнал.');
    log('decision', 'Построение завершено, модель передана технологу (автономный режим)');
    setMode('done');
    setBusy(false);
  }, [verbosity, say, log]);

  /** Запуск автономного режима — доступен в любой момент, когда есть ТЗ */
  const startAutonomous = useCallback(async () => {
    if (busy && mode === 'autonomous') return;
    if (!tz) {
      say('technolog', 'Чтобы строить самому, мне нужен эскиз. Пришлите фото бланка заказа — я сформирую ТЗ и сразу начну.');
      return;
    }
    if (mode === 'autonomous') return;
    if (mode === 'done') {
      say('technolog', 'Построение уже завершено. Могу перестроить с нужного этапа — скажите «откати на N этап», или начните новый проект.');
      return;
    }
    setPendingConfirm(null);
    pauseRef.current = false;
    stageIdx.current = 0;
    // Перед построением убираем элементы с помех (батарея и т.п.) — строим без косяков
    const moved: string[] = [];
    setUserParts((prev) => prev.map((it, idx) => {
      const o = collidesWith(it, idx);
      if (!o) return it;
      const r = partRect(it, idx);
      const spot = freeSpotRightOf(o, r.y);
      moved.push(`${it.kind} — с «${o.label}» на свободное место`);
      warnedParts.current.delete(it.id);
      return { ...it, x: spot.x, y: spot.y, pos: undefined };
    }));
    setMode('autonomous');
    setBusy(true);
    if (moved.length) {
      say('sborschik', `Перед построением проверил помехи с фото замеров. Ваши элементы стояли на препятствиях — передвинул, чтобы не было косяков: ${moved.join('; ')}.`);
      log('fix', `Перед построением убраны элементы с помех: ${moved.join('; ')}`);
    }
    say('konstruktor', 'Режим «Построить самому». Начинаю построение в БАЗИС-Мебельщик. Строю только из библиотеки предприятия; каждый шаг пишу в протокол. В любой момент можете нажать «Остановить» — продолжу с того же этапа.');
    setStages(BUILD_STAGES.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
    log('build', 'Старт автономного построения в БАЗИС-Мебельщик');
    void runStages(0);
  }, [busy, mode, tz, say, log, runStages]);

  /** Остановить построение на текущем этапе */
  const pauseBuild = useCallback(() => {
    if (mode !== 'autonomous') return;
    pauseRef.current = true;
    setMode('paused');
    setBusy(false);
    say('konstruktor', 'Остановился, как вы просили. Прогресс сохранён — нажмите «Продолжить», и я пойду дальше с того же этапа. Можете также строить сами: я подхвачу с того места, где вы закончите.');
    log('decision', 'Автономное построение остановлено технологом', TECHNOLOG_NAME);
  }, [mode, say, log]);

  /** Продолжить построение с этапа, на котором остановились */
  const resumeBuild = useCallback(() => {
    if (mode !== 'paused') return;
    pauseRef.current = false;
    setMode('autonomous');
    setBusy(true);
    say('konstruktor', 'Продолжаю построение с сохранённого этапа.');
    log('build', 'Построение возобновлено технологом', TECHNOLOG_NAME);
    void runStages(stageIdx.current);
  }, [mode, say, log, runStages]);

  // Связываем прокладки с реальными функциями (объявлены выше по коду)
  pauseFnRef.current = pauseBuild;
  resumeFnRef.current = resumeBuild;
  runStagesFnRef.current = (from: number) => { void runStages(from); };
  startFnRef.current = startAutonomous;

  /** Полная перестройка по команде «построй заново» — с нуля, с учётом правок ТЗ */
  const restartBuild = useCallback(() => {
    if (!tz) return;
    pauseRef.current = false;
    stageIdx.current = 0;
    setPendingConfirm(null);
    setMode('autonomous');
    setBusy(true);
    setStages([]);
    say('konstruktor', 'Понял: перестраиваю модель с нуля — по эскизу и последним правкам ТЗ, включая ваши решения. Строю из библиотеки предприятия.');
    log('build', 'Перестройка модели с нуля по команде технолога', TECHNOLOG_NAME);
    void runStages(0);
  }, [tz, say, log, runStages]);
  restartFnRef.current = restartBuild;

  /** «Продолжить у Агента»: технолог строил сам — агент подхватывает модель и доводит до конца */
  const continueByAgent = useCallback(() => {
    if (!tz) {
      say('technolog', 'Чтобы подхватить работу, мне нужен эскиз. Пришлите фото бланка заказа — сформирую ТЗ и продолжу строить.');
      return;
    }
    if (mode === 'autonomous' || mode === 'done') return;
    if (mode === 'paused') { resumeBuild(); return; }
    // Смотрим, что уже построено: выполненные этапы не повторяем
    const doneCount = stages.filter((s) => s.status === 'done').length;
    pauseRef.current = false;
    stageIdx.current = doneCount;
    setMode('autonomous');
    setBusy(true);
    if (stages.length === 0) {
      setStages(BUILD_STAGES.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
    }
    const partsNote = userParts.length > 0
      ? ` Вижу на поле сборки ваши элементы (${userParts.length} шт.) — встраиваю их в модель, удалять не буду.`
      : '';
    say('konstruktor', (doneCount > 0
      ? `Принял работу у вас. Сверил вашу модель с эскизом и ТЗ: этапов выполнено — ${doneCount} из ${BUILD_STAGES.length}. Продолжаю со следующего этапа, переделывать ваше не буду.`
      : 'Принял работу у вас. Сверил текущую модель с эскизом и ТЗ — продолжаю построение с первого этапа, строю только из библиотеки предприятия.') + partsNote);
    log('build', `Агент подхватил построение после технолога (этапов: ${doneCount}, элементов технолога: ${userParts.length})`, TECHNOLOG_NAME);
    setUserParts([]); // элементы технолога встроены в модель
    void runStages(doneCount);
  }, [tz, mode, stages, userParts, say, log, resumeBuild, runStages]);

  /** Технолог сам добавил элемент в окне-прототипе БАЗИС */
  const addUserPart = useCallback((kind: string, x?: number, y?: number) => {
    const part = { id: uid(), kind, x, y };
    setUserParts((p) => {
      const next = [...p, part];
      const idx = next.length - 1;
      checkPartCollision(part, idx);
      checkSketchFit(part, idx);
      return next;
    });
    log('decision', `Технолог вручную добавил в модель: ${kind}`, TECHNOLOG_NAME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  /** Перетаскивание элемента технолога по чертежу */
  const moveUserPart = useCallback((id: string, x: number, y: number) => {
    setUserParts((p) => {
      const next = p.map((it) => (it.id === id ? { ...it, x, y, pos: undefined } : it));
      const idx = next.findIndex((it) => it.id === id);
      if (idx >= 0) {
        checkPartCollision(next[idx], idx);
        checkSketchFit(next[idx], idx);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Актуальный режим для колбэков с пустыми зависимостями (иначе видят устаревший mode)
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /** Если технолог изменил модель ПОСЛЕ построения — спрашиваем: подогнать под его решение или исправить по эскизу */
  const checkSketchFit = (part: { id: string; kind: string; pos?: string; x?: number; y?: number }, idx: number) => {
    if (modeRef.current !== 'done') return; // сверяем с эскизом только когда модель уже построена
    if (collidesWith(part, idx)) return; // про помехи говорит коллизия
    if (askedFit.current.has(part.id)) return;
    askedFit.current.add(part.id);
    say('technolog', `Вижу, вы сами изменили модель: «${part.kind}». По эскизу и замерам этого элемента не было. Как поступить?`, {
      actions: [
        { id: uid(), label: 'Подгони проект под моё решение', kind: 'primary', event: `fit_user:${part.id}` },
        { id: uid(), label: 'Исправь по эскизу и замерам', kind: 'ghost', event: `fix_sketch:${part.id}` },
      ],
    });
    log('deviation', `Отклонение от эскиза (ручное изменение технолога): ${part.kind}`);
  };

  /** Технолог подтвердил своё изменение — проект подгоняется под него */
  const fitUserChange = useCallback((partId: string) => {
    const part = userParts.find((p) => p.id === partId);
    say('konstruktor', `Принял: «${part?.kind ?? 'элемент'}» остаётся — подогнал проект под ваше решение, записал в ТЗ как изменение от технолога. Приоритет за вами.`);
    log('decision', `Изменение технолога принято как новое ТЗ: ${part?.kind ?? partId}`, TECHNOLOG_NAME);
  }, [userParts, say, log]);

  /** Исправить по эскизу: убрать самодельный элемент */
  const fixSketchChange = useCallback((partId: string) => {
    const part = userParts.find((p) => p.id === partId);
    setUserParts((p) => p.filter((it) => it.id !== partId));
    say('konstruktor', `Исправил по эскизу и замерам: «${part?.kind ?? 'элемент'}» убран, модель снова соответствует эскизу.`);
    log('fix', `Модель возвращена к эскизу: убран элемент технолога ${part?.kind ?? partId}`);
  }, [userParts, say, log]);

  // Предупреждения о коллизиях — один раз на элемент, пока он на помехе
  const warnedParts = useRef<Set<string>>(new Set());
  const checkPartCollision = useCallback((part: { id: string; kind: string; pos?: string; x?: number; y?: number }, idx: number) => {
    const o = collidesWith(part, idx);
    if (o && !warnedParts.current.has(part.id)) {
      warnedParts.current.add(part.id);
      say('sborschik', `Внимание: элемент «${part.kind}» встал на помеху «${o.label}» (с фото замеров). Так строить нельзя — потом не откроется или не встанет, как та дверца. Передвинуть его на свободное место?`, {
        actions: [
          { id: uid(), label: 'Передвинуть элемент', kind: 'primary', event: `fix_collision:${part.id}` },
          { id: uid(), label: 'Оставить как есть', kind: 'ghost', event: `keep_collision:${part.id}` },
        ],
      });
      log('deviation', `Коллизия: «${part.kind}» пересекается с помехой «${o.label}»`);
    }
    if (!o) warnedParts.current.delete(part.id);
  }, [say, log]);

  /** Передвинуть элемент с помехи на свободное место (по кнопке из предупреждения) */
  const fixCollision = useCallback((partId: string) => {
    setUserParts((p) => {
      const idx = p.findIndex((it) => it.id === partId);
      if (idx < 0) return p;
      const part = p[idx];
      const o = collidesWith(part, idx);
      if (!o) return p;
      const r = partRect(part, idx);
      const spot = freeSpotRightOf(o, r.y);
      say('konstruktor', `Передвинул «${part.kind}» с помехи «${o.label}» на свободное место правее. Проверьте в окне БАЗИС.`);
      log('fix', `Элемент «${part.kind}» передвинут с помехи «${o.label}»`, 'Агент');
      warnedParts.current.delete(partId);
      return p.map((it) => (it.id === partId ? { ...it, x: spot.x, y: spot.y, pos: undefined } : it));
    });
  }, [say, log]);

  /** Запуск режима помощи (ручное строительство технологом под наблюдением агента) */
  const startAssist = useCallback(() => {
    if (!tz) {
      say('technolog', 'Чтобы вы строили сами, а я помогал, мне нужен эскиз. Пришлите фото бланка заказа — сформирую ТЗ.');
      return;
    }
    if (mode === 'assist' || mode === 'autonomous') return;
    setPendingConfirm(null);
    setMode('assist');
    say('technolog', 'Режим «Строить самому»: стройте в окне БАЗИС (или в настоящем БАЗИС) — я наблюдаю за моделью, сверяю с эскизом и ТЗ. О несовпадениях сообщу карточкой. Устанете — нажмите «Продолжить у Агента», дострою с вашего места.');
    log('decision', 'Включён режим ручного строительства: наблюдение за моделью');
    DEMO_DEVIATIONS.forEach((d, i) => {
      later(6000 + i * 14000, () => {
        setDeviations((prev) => {
          if (prev.some((p) => p.title === d.title)) return prev;
          return [...prev, { ...d, id: uid(), status: 'new', ts: Date.now() }];
        });
        log('deviation', `Обнаружено несовпадение: ${d.title}`);
      });
    });
  }, [tz, mode, say, log]);

  const actDeviation = useCallback(async (id: string, action: 'fix' | 'cancel' | 'intentional') => {
    const dev = deviations.find((d) => d.id === id);
    if (!dev || dev.status !== 'new') return;
    if (action === 'fix') {
      setDeviations((p) => p.map((d) => (d.id === id ? { ...d, status: 'fixing' } : d)));
      say('konstruktor', `Исправляю: ${dev.title.toLowerCase()}… Перед изменением сделан снапшот проекта — откат доступен.`);
      await delay(2200);
      setDeviations((p) => p.map((d) => (d.id === id ? { ...d, status: 'fixed', undoAvailable: true } : d)));
      log('fix', `Исправлено агентом: ${dev.title}`);
      say('konstruktor', 'Готово. Модель снова соответствует эскизу.');
    } else if (action === 'cancel') {
      setDeviations((p) => p.map((d) => (d.id === id ? { ...d, status: 'cancelled' } : d)));
      log('decision', `Отклонено исправление (пользователь): ${dev.title}`, TECHNOLOG_NAME);
    } else {
      setDeviations((p) => p.map((d) => (d.id === id ? { ...d, status: 'intentional' } : d)));
      log('decision', `Отличие от эскиза подтверждено как намеренное: ${dev.title}`, TECHNOLOG_NAME);
    }
  }, [deviations, say, log]);

  const undoFix = useCallback((id: string) => {
    setDeviations((p) => p.map((d) => (d.id === id ? { ...d, status: 'new', undoAvailable: false } : d)));
    log('undo', 'Откат изменения агента по снапшоту проекта', TECHNOLOG_NAME);
    say('konstruktor', 'Изменение откачено к снапшоту. Карточка возвращена в исходное состояние.');
  }, [say, log]);

  const resetAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pauseRef.current = false;
    stageIdx.current = 0;
    setMode('idle');
    setTz(null);
    setStages([]);
    setDeviations([]);
    setUserParts([]);
    setPendingConfirm(null);
    askedFit.current.clear();
    setBusy(false);
    say('system', 'Новый проект. Пришлите эскиз или задание.');
  }, [say]);

  /** Снимок состояния сессии для сохранения */
  const getSnapshot = useCallback(() => ({ messages, mode, tz, stages, deviations, userParts }),
    [messages, mode, tz, stages, deviations, userParts]);

  /** Восстановление сессии из сохранённых данных (null = новая сессия) */
  const restore = useCallback((data: { messages: ChatMessage[]; mode: Mode; tz: ProjectTz | null; stages: BuildStage[]; deviations: Deviation[]; userParts?: ({ id: string; kind: string; pos?: string; x?: number; y?: number } | string)[] } | null) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pauseRef.current = false;
    stageIdx.current = 0;
    setBusy(false);
    if (!data) {
      setMessages([{ id: uid(), role: 'technolog', ts: Date.now(), text: 'Здравствуйте! Пришлите фото бланка заказа, эскиза или замеров — сформирую ТЗ и предложу режимы: построю сам или буду помогать вам в БАЗИС-Мебельщик.' }]);
      setMode('idle');
      setTz(null);
      setStages([]);
      setDeviations([]);
      setUserParts([]);
      setPendingConfirm(null);
      askedFit.current.clear();
      return;
    }
    setMessages(data.messages ?? []);
    // Если сессия закрылась на активном построении — считаем его остановленным:
    // продолжить можно кнопкой «Продолжить» с последнего выполненного этапа.
    // Промежуточное состояние «распознаю эскиз» при повторном открытии тупиковое —
    // возвращаем в исходное, чтобы сессия гарантированно открывалась рабочей.
    const restoredMode: Mode =
      data.mode === 'autonomous' ? 'paused'
      : data.mode === 'intake' ? 'idle'
      : (data.mode ?? 'idle');
    stageIdx.current = (data.stages ?? []).filter((s) => s.status === 'done').length;
    setMode(restoredMode);
    setTz(data.tz ?? null);
    setStages((data.stages ?? []).map((s) => s.status === 'active' ? { ...s, status: 'pending' as const } : s));
    setDeviations(data.deviations ?? []);
    setPendingConfirm(null);
    askedFit.current.clear();
    // совместимость со старыми сессиями: элементы могли сохраниться строками "Вид|позиция"
    setUserParts((data.userParts ?? []).map((p) => {
      if (typeof p !== 'string') return p;
      const [kind, pos] = p.split('|');
      return { id: uid(), kind, pos };
    }));
  }, []);

  return {
    messages, mode, tz, stages, deviations, journal, verbosity, busy, userParts,
    canBuild: tz !== null,
    setVerbosity, sendUser, startAutonomous, startAssist, actDeviation, undoFix, resetAll,
    pauseBuild, resumeBuild, continueByAgent, addUserPart, moveUserPart, fixCollision,
    fitUserChange, fixSketchChange,
    keepCollision: (partId: string) => {
      warnedParts.current.add(partId);
      log('decision', 'Технолог оставил элемент на помехе — отмечено как намеренное', TECHNOLOG_NAME);
    },
    getSnapshot, restore,
    clearJournal: () => setJournal([]),
  };
}
