import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Cpu, FolderOpen, LogOut, Pencil, Plus, Trash2, X } from 'lucide-react';
import { listSessions, deleteSession, renameSession, type Account, type SessionMeta } from '@/lib/store';
import { useState } from 'react';

interface Props {
  user: Account;
  onOpen: (sessionId: string | null) => void; // null = новая сессия
  onLogout: () => void;
}

export function SessionsScreen({ user, onOpen, onLogout }: Props) {
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const sessions = listSessions(user.login);

  const startRename = (s: SessionMeta) => { setEditingId(s.id); setEditTitle(s.title); };
  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      renameSession(user.login, editingId, editTitle.trim());
    }
    setEditingId(null);
    setTick((t) => t + 1);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
          <Cpu size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Агент-БМ</div>
          <div className="text-[11px] text-muted-foreground leading-tight">
            {user.name} · {user.role}
          </div>
        </div>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" /> Выйти
        </Button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-base font-semibold">Мои сессии</h1>
          <Button onClick={() => onOpen(null)} className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400">
            <Plus className="h-4 w-4" /> Новая сессия
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Сессий пока нет. Нажмите «Новая сессия», чтобы начать работу с агентом.
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100dvh-180px)]">
            <div className="space-y-2">
              {sessions.map((s: SessionMeta) => (
                <Card key={s.id} className="transition-colors hover:border-amber-500/40">
                  <CardContent className="flex items-center gap-3 p-3.5">
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-400" />
                    {editingId === s.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" aria-label="Сохранить название" onClick={commitRename}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Отмена" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => onOpen(s.id)}
                      >
                        <div className="truncate text-sm font-medium">{s.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </button>
                    )}
                    {editingId !== s.id && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                        aria-label="Переименовать сессию"
                        onClick={() => startRename(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      aria-label="Удалить сессию"
                      onClick={() => { deleteSession(user.login, s.id); setTick((t) => t + 1); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Память и обучение агента общие для предприятия и не зависят от сессий.
        </p>
      </div>
      <span className="hidden">{tick}</span>
    </div>
  );
}
