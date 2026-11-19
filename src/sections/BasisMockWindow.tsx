import { useRef, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { BuildStage, Mode } from '@/types';
import { VB_W, VB_H, PART_W, PART_H, collidesWith, partRect } from '@/lib/scene-geo';

/**
 * Окно-прототип «БАЗИС-Мебельщик»: стилизовано под интерфейс настоящего БАЗИС.
 * Технолог может: создавать элементы кликом по чертежу, перетаскивать их мышью,
 * растягивать окно за угол и разворачивать на весь экран.
 * Это НЕ настоящий БАЗИС — стенд для проверки логики агента.
 */

export interface UserPart {
  id: string;
  kind: string;
  pos?: string;
  x?: number;
  y?: number;
}

interface Props {
  stages: BuildStage[];
  userParts: UserPart[];
  mode: Mode;
  hasTz: boolean;
  onAddPart: (kind: string, x?: number, y?: number) => void;
  onMovePart: (id: string, x: number, y: number) => void;
  onClose: () => void;
}

const WOOD = '#d9b48c';
const WOOD_DARK = '#8a6b4a';
const EDGE = '#3f3f46';

function doneCount(stages: BuildStage[]) {
  return stages.filter((s) => s.status === 'done').length;
}

const TREE_ITEMS = [
  { label: 'Каркас и стойки', stage: 1 },
  { label: 'Полки и перегородки', stage: 2 },
  { label: 'Фасады', stage: 3 },
  { label: 'Кромки и присадка', stage: 4 },
  { label: 'Проверка (Inspector)', stage: 5 },
  { label: 'Габариты', stage: 6 },
];

const TOOLBAR_GLYPHS = ['▣', '✚', '▤', '◫', '⬒', '⌖', '↔', '⤢', '✂', '⏷', '⚙'];
const PART_KINDS = ['Панель', 'Полка', 'Фасад', 'Ящик'];

// Защита от нулевых размеров вьюпорта (фоновые вкладки)
const vw = () => window.innerWidth || 1280;
const vh = () => window.innerHeight || 800;

export function BasisMockWindow({ stages, userParts, mode, hasTz, onAddPart, onMovePart, onClose }: Props) {
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [width, setWidth] = useState(640);
  const [maximized, setMaximized] = useState(false);
  const [tool, setTool] = useState<string | null>(null); // выбранный элемент для постановки кликом
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ startX: number; startW: number } | null>(null);
  const partDrag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- перетаскивание окна ---
  const onHeaderDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeaderMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.max(0, Math.min(vw() - 300, e.clientX - drag.current.dx)),
      y: Math.max(0, Math.min(vh() - 200, e.clientY - drag.current.dy)),
    });
  };
  const onHeaderUp = () => { drag.current = null; };

  // --- растягивание окна за угол ---
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    resize.current = { startX: e.clientX, startW: width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current) return;
    setWidth(Math.max(440, Math.min(vw() - 40, resize.current.startW + (e.clientX - resize.current.startX))));
  };
  const onResizeUp = () => { resize.current = null; };

  // --- координаты клика/мишени в системе viewBox ---
  const toViewBox = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((clientX - r.left) / r.width) * VB_W, y: ((clientY - r.top) / r.height) * VB_H };
  };

  // --- постановка элемента кликом по чертежу ---
  const onSceneClick = (e: React.MouseEvent) => {
    if (!tool || partDrag.current) return;
    const p = toViewBox(e.clientX, e.clientY);
    onAddPart(tool, Math.round(p.x - PART_W / 2), Math.round(p.y - PART_H / 2));
  };

  // --- перетаскивание элемента ---
  const onPartDown = (e: React.PointerEvent, part: UserPart, idx: number) => {
    e.stopPropagation();
    const r = partRect(part, idx);
    const p = toViewBox(e.clientX, e.clientY);
    partDrag.current = { id: part.id, dx: p.x - r.x, dy: p.y - r.y };
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
  };
  const onPartMove = (e: React.PointerEvent) => {
    if (!partDrag.current) return;
    const p = toViewBox(e.clientX, e.clientY);
    onMovePart(
      partDrag.current.id,
      Math.round(Math.max(0, Math.min(VB_W - PART_W, p.x - partDrag.current.dx))),
      Math.round(Math.max(0, Math.min(VB_H - PART_H, p.y - partDrag.current.dy))),
    );
  };
  const onPartUp = () => {
    // небольшая задержка сброса, чтобы клик по сцене не сработал после перетаскивания
    setTimeout(() => { partDrag.current = null; }, 0);
  };

  const n = doneCount(stages);
  const building = mode === 'autonomous';
  const activeStage = stages.find((s) => s.status === 'active')?.label;

  return (
    <div
      className="fixed z-50 overflow-hidden rounded-sm border border-zinc-500 shadow-2xl shadow-black/70"
      style={maximized
        ? { left: 8, top: 8, width: vw() - 16 }
        : { left: pos.x, top: pos.y, width }}
    >
      {/* Заголовок окна */}
      <div
        className="flex cursor-move select-none items-center gap-2 bg-gradient-to-b from-[#3a3f4a] to-[#2b2f38] px-2.5 py-1.5"
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-[#c83b3b] text-[9px] font-bold text-white">Б</div>
        <div className="flex-1 text-[11px] text-zinc-200">
          БАЗИС-Мебельщик x64 — [Прихожая_1791.b3d] <span className="text-amber-400">— ПРОТОТИП-СТЕНД</span>
        </div>
        <div className={`mr-1 h-2 w-2 rounded-full ${building ? 'animate-pulse bg-amber-400' : n > 0 ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
        <button
          className="rounded-sm px-1.5 text-zinc-300 hover:bg-zinc-600"
          title={maximized ? 'Вернуть размер' : 'Развернуть'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMaximized((v) => !v)}
        >
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          className="rounded-sm px-1.5 text-zinc-300 hover:bg-red-600 hover:text-white"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Меню */}
      <div className="flex gap-3 border-b border-zinc-400 bg-[#ece9e2] px-2.5 py-1 text-[11px] text-zinc-800">
        {['Файл', 'Правка', 'Вид', 'Модель', 'Фурнитура', 'Сервис', 'Окно', 'Справка'].map((m) => (
          <span key={m} className="cursor-default rounded-sm px-1 hover:bg-[#d4e3f5]">{m}</span>
        ))}
      </div>

      {/* Панель инструментов */}
      <div className="flex items-center gap-1 border-b border-zinc-400 bg-[#e2ded6] px-2 py-1">
        {TOOLBAR_GLYPHS.map((g, i) => (
          <div
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-zinc-400 bg-gradient-to-b from-white to-[#d8d4cc] text-[11px] text-zinc-700 shadow-sm"
            title="Инструмент (в прототипе неактивен)"
          >
            {g}
          </div>
        ))}
        <div className="mx-2 h-5 w-px bg-zinc-400" />
        <span className="text-[10px] text-zinc-600">
          {tool ? `Постановка: ${tool} — кликните по полю чертежа` : 'Слой: Корпусная мебель · Материал: ЛДСП 16'}
        </span>
      </div>

      <div className="flex bg-[#d6d2ca]" style={{ maxHeight: 'calc(100vh - 170px)' }}>
        <div className="w-[150px] shrink-0 border-r border-zinc-400 bg-[#f4f2ee] p-1.5">
          <div className="mb-1 border-b border-zinc-300 pb-1 text-[10px] font-semibold text-zinc-700">Модель</div>
          <div className="text-[10px] leading-4 text-zinc-800">
            <div className="font-semibold">▾ Прихожая 2876×2600</div>
            {TREE_ITEMS.map((t) => (
              <div key={t.label} className={`pl-3 ${n >= t.stage ? 'text-zinc-900' : 'text-zinc-400'}`}>
                {n >= t.stage ? '☑' : '☐'} {t.label}
              </div>
            ))}
            <div className="mt-1 pl-3 text-sky-700">▸ Элементы технолога: {userParts.length}</div>
          </div>
          <div className="mt-2 border-t border-zinc-300 pt-1.5">
            <div className="mb-1 text-[10px] font-semibold text-zinc-700">Поставить самому:</div>
            {PART_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => setTool((t) => (t === kind ? null : kind))}
                className={`mb-1 block w-full rounded-[3px] border px-1.5 py-0.5 text-left text-[10px] ${
                  tool === kind
                    ? 'border-sky-600 bg-[#d4e3f5] text-sky-900'
                    : 'border-zinc-400 bg-gradient-to-b from-white to-[#ddd9d0] text-zinc-800 hover:from-[#eaf3fd] hover:to-[#d4e3f5]'
                }`}
              >
                + {kind}
              </button>
            ))}
            <div className="text-[9px] leading-3 text-zinc-500">
              Выберите элемент и кликните по полю — встанет туда. Готовый элемент можно таскать мышью.
            </div>
          </div>
        </div>

        {/* Поле чертежа — масштаб ограничен, при любом размере окна чертёж остаётся читаемым */}
        <div className="flex flex-1 items-start justify-center overflow-auto bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={`block bg-white ${tool ? 'cursor-crosshair' : ''}`}
          style={{ width: '100%', maxWidth: 760, height: 'auto', maxHeight: 'calc(100vh - 190px)' }}
          onClick={onSceneClick}
        >
          <defs>
            <pattern id="bgrid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#e8e8e8" strokeWidth="0.5" />
            </pattern>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#dc2626" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={VB_W} height={VB_H} fill="url(#bgrid)" />

          {/* оси координат */}
          <g strokeWidth="1.4">
            <line x1="24" y1="376" x2="64" y2="376" stroke="#dc2626" />
            <line x1="24" y1="376" x2="24" y2="336" stroke="#16a34a" />
          </g>
          <text x="66" y="380" fontSize="9" fill="#dc2626">X</text>
          <text x="18" y="332" fontSize="9" fill="#16a34a">Y</text>

          {/* контур помещения и батарея */}
          <rect x="120" y="24" width="290" height="352" fill="none" stroke="#9ca3af" strokeDasharray="5 4" />
          <rect x="124" y="318" width="76" height="52" fill="url(#hatch)" opacity="0.35" />
          <rect x="124" y="318" width="76" height="52" fill="none" stroke="#dc2626" strokeWidth="1" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={130 + i * 15} y1="322" x2={130 + i * 15} y2="366" stroke="#dc2626" strokeWidth="2.5" />
          ))}
          <text x="128" y="312" fontSize="9" fill="#dc2626">Батарея Ø76 (с фото замеров)</text>

          {/* ===== Изделие по этапам ===== */}
          {n >= 1 && (
            <g stroke={EDGE} strokeWidth="1.5" fill={WOOD}>
              <rect x="196" y="86" width="10" height="258" />
              <rect x="422" y="86" width="10" height="258" />
              <rect x="196" y="86" width="236" height="10" />
              <rect x="196" y="334" width="236" height="10" />
              <rect x="275" y="86" width="10" height="248" />
              <rect x="353" y="86" width="10" height="248" />
              <rect x="196" y="344" width="236" height="14" fill={WOOD_DARK} />
              <rect x="200" y="90" width="228" height="250" fill="none" strokeDasharray="3 3" strokeWidth="0.7" />
            </g>
          )}
          {n >= 2 && (
            <g stroke={EDGE} strokeWidth="1.2" fill={WOOD}>
              <rect x="206" y="150" width="69" height="8" />
              <rect x="206" y="235" width="69" height="8" />
              <rect x="285" y="130" width="68" height="8" />
              <rect x="363" y="170" width="59" height="8" />
              <rect x="363" y="255" width="59" height="8" />
            </g>
          )}
          {n >= 3 && (
            <g stroke={EDGE} strokeWidth="1.2" fill="#e6c9a3">
              <rect x="198" y="88" width="75" height="120" />
              <rect x="287" y="88" width="64" height="254" />
              <rect x="365" y="88" width="55" height="120" />
              <rect x="262" y="140" width="3" height="18" fill={EDGE} stroke="none" />
              <rect x="292" y="190" width="3" height="18" fill={EDGE} stroke="none" />
              <rect x="370" y="140" width="3" height="18" fill={EDGE} stroke="none" />
              <circle cx="270" cy="100" r="2" fill="#52525b" stroke="none" />
              <circle cx="270" cy="196" r="2" fill="#52525b" stroke="none" />
            </g>
          )}
          {n >= 4 && (
            <g fill="#7c3aed">
              {[110, 150, 190, 230, 270, 310].map((y) => (
                <g key={y}>
                  <circle cx="201" cy={y} r="1.6" />
                  <circle cx="427" cy={y} r="1.6" />
                </g>
              ))}
              <text x="206" y="80" fontSize="8" fill="#7c3aed">присадка Ø5/Ø8</text>
            </g>
          )}
          {n >= 5 && (
            <g>
              <rect x="192" y="82" width="244" height="266" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeDasharray="6 3" />
              <rect x="338" y="60" width="86" height="14" fill="#16a34a" rx="2" />
              <text x="344" y="70" fontSize="9" fill="#ffffff">Inspector: OK</text>
            </g>
          )}
          {n >= 6 && (
            <g stroke="#6b7280" strokeWidth="0.8" fill="#374151" fontSize="10">
              <line x1="196" y1="366" x2="432" y2="366" />
              <line x1="196" y1="362" x2="196" y2="370" />
              <line x1="432" y1="362" x2="432" y2="370" />
              <text x="288" y="380" stroke="none">2876</text>
              <line x1="452" y1="86" x2="452" y2="344" />
              <line x1="448" y1="86" x2="456" y2="86" />
              <line x1="448" y1="344" x2="456" y2="344" />
              <text x="392" y="220" stroke="none" transform="rotate(90 452 215)">2600</text>
            </g>
          )}

          {/* элементы технолога — перетаскиваемые */}
          {userParts.map((p, i) => {
            const r = partRect(p, i);
            const hit = collidesWith(p, i); // элемент на помехе — красный
            const stroke = hit ? '#dc2626' : '#0284c7';
            return (
              <g
                key={p.id}
                className="cursor-move"
                onPointerDown={(e) => onPartDown(e, p, i)}
                onPointerMove={onPartMove}
                onPointerUp={onPartUp}
              >
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
                  fill={hit ? '#dc262622' : '#0ea5e922'} stroke={stroke} strokeWidth={hit ? 2 : 1.4} />
                {p.kind === 'Ящик' && <rect x={r.x + r.w / 2 - 8} y={r.y + 4} width="16" height="2.5" fill={stroke} />}
                <text x={r.x + 4} y={r.y + r.h - 5} fontSize="9" fill={stroke} pointerEvents="none">
                  {hit ? `⚠ ${p.kind}` : p.kind}
                </text>
                {hit && (
                  <text x={r.x} y={r.y - 4} fontSize="8" fill="#dc2626" pointerEvents="none">
                    мешает: {hit.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      {/* Строка состояния + ручка растягивания */}
      <div className="relative flex items-center gap-3 border-t border-zinc-400 bg-[#ece9e2] px-2.5 py-1 text-[10px] text-zinc-700">
        <span>X: 1432.5&nbsp;&nbsp;Y: 860.0</span>
        <span>Масштаб 1:10</span>
        <span className="flex-1 text-center font-medium">
          {building ? `Агент-БМ: ${activeStage ?? 'построение…'}` : mode === 'paused' ? 'Построение остановлено' : n >= 6 ? 'Модель готова' : hasTz ? 'Ожидание команды' : 'Нет эскиза'}
        </span>
        <span className="text-zinc-500">стенд, не БАЗИС</span>
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          title="Растянуть окно"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-zinc-500">
            <path d="M14 16 L16 14 M10 16 L16 10 M6 16 L16 6" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
