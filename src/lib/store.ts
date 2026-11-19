// Локальное хранилище аккаунтов и сессий (демо; позже переедет на сервер предприятия).
// Обучение (журнал/память) хранится глобально и НЕ привязано к сессиям.

export interface Account {
  login: string;
  password: string;
  name: string;
  role: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  manual?: boolean; // название задано вручную — автосохранение его не перезаписывает
}

const ACCOUNTS_KEY = 'bazis-agent:accounts';
const CURRENT_USER_KEY = 'bazis-agent:currentUser';
const sessionsKey = (user: string) => `bazis-agent:sessions:${user}`;
const sessionDataKey = (user: string, id: string) => `bazis-agent:session:${user}:${id}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Аккаунты по умолчанию (демо). */
const DEFAULT_ACCOUNTS: Account[] = [
  { login: 'admin', password: '0000', name: 'Admin', role: 'Главный технолог' },
];

export function getAccounts(): Account[] {
  const accs = read<Account[]>(ACCOUNTS_KEY, []);
  if (!accs.length) {
    write(ACCOUNTS_KEY, DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }
  return accs;
}

export function authenticate(login: string, password: string): Account | null {
  const acc = getAccounts().find(
    (a) => a.login.toLowerCase() === login.trim().toLowerCase() && a.password === password,
  );
  return acc ?? null;
}

export function getCurrentUser(): Account | null {
  return read<Account | null>(CURRENT_USER_KEY, null);
}

export function setCurrentUser(acc: Account | null) {
  write(CURRENT_USER_KEY, acc);
}

export function listSessions(userLogin: string): SessionMeta[] {
  return read<SessionMeta[]>(sessionsKey(userLogin), []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadSessionData<T>(userLogin: string, id: string): T | null {
  return read<T | null>(sessionDataKey(userLogin, id), null);
}

export function saveSessionData(userLogin: string, id: string, title: string, data: unknown) {
  write(sessionDataKey(userLogin, id), data);
  const list = read<SessionMeta[]>(sessionsKey(userLogin), []);
  const existing = list.find((s) => s.id === id);
  // Если технолог сам назвал сессию — сохраняем его название
  const meta: SessionMeta = existing?.manual
    ? { ...existing, updatedAt: Date.now() }
    : { id, title, updatedAt: Date.now() };
  const next = existing ? list.map((s) => (s.id === id ? meta : s)) : [...list, meta];
  write(sessionsKey(userLogin), next);
}

/** Переименовать сессию (ручное название больше не перезаписывается автосохранением) */
export function renameSession(userLogin: string, id: string, title: string) {
  const list = read<SessionMeta[]>(sessionsKey(userLogin), []);
  write(sessionsKey(userLogin), list.map((s) => (s.id === id ? { ...s, title, manual: true, updatedAt: Date.now() } : s)));
}

export function deleteSession(userLogin: string, id: string) {
  const list = read<SessionMeta[]>(sessionsKey(userLogin), []);
  write(sessionsKey(userLogin), list.filter((s) => s.id !== id));
  localStorage.removeItem(sessionDataKey(userLogin, id));
}
