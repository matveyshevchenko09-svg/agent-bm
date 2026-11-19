export type AgentRole = 'technolog' | 'konstruktor' | 'sborschik' | 'system';
export type Mode = 'idle' | 'intake' | 'tz_ready' | 'autonomous' | 'paused' | 'assist' | 'done';
export type Verbosity = 0 | 1 | 2; // минимум / средний / подробный
export type Confidence = 'confirmed' | 'calculated' | 'assumption';

export interface ChatMessage {
  id: string;
  role: AgentRole | 'user';
  text: string;
  ts: number;
  attachments?: UploadedImage[];
  actions?: ChatAction[];
}

export interface ChatAction {
  id: string;
  label: string;
  kind: 'primary' | 'ghost' | 'danger';
  event: string; // 'mode_autonomous' | 'mode_assist' | 'answer_tz' | 'fix_collision:<id>' | ...
}

export interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface TzField {
  key: string;
  label: string;
  value: string;
  confidence: Confidence;
  source: string;
}

export interface ProjectTz {
  title: string;
  overall: TzField[];
  composition: TzField[];
  materials: TzField[];
  roomConstraints: TzField[];
  unresolved: { key: string; question: string; answer?: string }[];
}

export type DeviationStatus = 'new' | 'fixing' | 'fixed' | 'cancelled' | 'intentional';

export interface Deviation {
  id: string;
  title: string;
  sketch: string; // что на эскизе
  model: string; // что в модели
  status: DeviationStatus;
  ts: number;
  undoAvailable?: boolean;
}

export type JournalKind = 'deviation' | 'fix' | 'decision' | 'build' | 'undo';

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  text: string;
  author: string; // агент или имя технолога
  ts: number;
}

export interface BuildStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
  detail?: string;
}

export const ROLE_NAMES: Record<AgentRole, string> = {
  technolog: 'Агент-БМ',
  konstruktor: 'Агент-БМ',
  sborschik: 'Агент-БМ',
  system: 'Агент-БМ',
};

export const CONFIDENCE_META: Record<Confidence, { label: string; className: string }> = {
  confirmed: { label: 'Подтверждено', className: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  calculated: { label: 'Рассчитано', className: 'text-sky-400 border-sky-500/40 bg-sky-500/10' },
  assumption: { label: 'Предположение', className: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
};
