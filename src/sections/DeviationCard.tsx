import type { Deviation } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Undo2, Wrench, XCircle, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  dev: Deviation;
  onAct: (id: string, action: 'fix' | 'cancel' | 'intentional') => void;
  onUndo: (id: string) => void;
}

const STATUS_META: Record<Deviation['status'], { label: string; className: string }> = {
  new: { label: 'Требует решения', className: 'border-amber-500/40 text-amber-400' },
  fixing: { label: 'Исправляю…', className: 'border-sky-500/40 text-sky-400' },
  fixed: { label: 'Исправлено', className: 'border-emerald-500/40 text-emerald-400' },
  cancelled: { label: 'Отменено вами', className: 'border-zinc-500/40 text-zinc-400' },
  intentional: { label: 'Намеренное отличие', className: 'border-violet-500/40 text-violet-400' },
};

export function DeviationCard({ dev, onAct, onUndo }: Props) {
  const meta = STATUS_META[dev.status];
  return (
    <Card className={cn('border', dev.status === 'new' ? 'border-amber-500/50' : 'border-border/60', dev.status === 'cancelled' && 'opacity-60')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', dev.status === 'new' ? 'text-amber-400' : 'text-muted-foreground')} />
            <div className="text-sm font-medium leading-snug">{dev.title}</div>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>{meta.label}</Badge>
        </div>

        <div className="grid gap-1.5 text-xs">
          <div className="rounded-md bg-card-foreground/5 px-2.5 py-1.5">
            <span className="text-muted-foreground">Эскиз: </span>{dev.sketch}
          </div>
          <div className="rounded-md bg-card-foreground/5 px-2.5 py-1.5">
            <span className="text-muted-foreground">Модель: </span>{dev.model}
          </div>
        </div>

        {dev.status === 'new' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={() => onAct(dev.id, 'fix')}>
              <Wrench className="h-3.5 w-3.5" /> Сделать самому
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAct(dev.id, 'cancel')}>
              <XCircle className="h-3.5 w-3.5" /> Отменить
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 border-violet-500/40 text-violet-300 hover:bg-violet-500/10" onClick={() => onAct(dev.id, 'intentional')}>
              <Hand className="h-3.5 w-3.5" /> Это намеренно
            </Button>
          </div>
        )}
        {dev.status === 'fixed' && dev.undoAvailable && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Изменение внесено в модель</span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onUndo(dev.id)}>
              <Undo2 className="h-3.5 w-3.5" /> Откатить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
