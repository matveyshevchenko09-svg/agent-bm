import type { JournalEntry, JournalKind } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const KIND_META: Record<JournalKind, { label: string; className: string }> = {
  deviation: { label: 'Отклонение', className: 'border-amber-500/40 text-amber-400' },
  fix: { label: 'Исправление', className: 'border-emerald-500/40 text-emerald-400' },
  decision: { label: 'Решение', className: 'border-sky-500/40 text-sky-400' },
  build: { label: 'Построение', className: 'border-zinc-500/40 text-zinc-300' },
  undo: { label: 'Откат', className: 'border-violet-500/40 text-violet-400' },
};

export function JournalPanel({ journal, onClear }: { journal: JournalEntry[]; onClear: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[11px] text-muted-foreground">Записей: {journal.length} · хранится на сервере (демо — локально)</span>
        {journal.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-muted-foreground" onClick={onClear}>
            <Trash2 className="h-3 w-3" /> Очистить
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {journal.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Журнал пуст</div>
        ) : (
          <div className="space-y-2 pr-2">
            {[...journal].reverse().map((e) => (
              <div key={e.id} className="rounded-lg border border-border/50 bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px]', KIND_META[e.kind].className)}>{KIND_META[e.kind].label}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(e.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {e.author}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-relaxed">{e.text}</div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
