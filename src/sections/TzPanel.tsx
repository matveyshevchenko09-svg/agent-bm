import type { ProjectTz, TzField, BuildStage } from '@/types';
import { CONFIDENCE_META } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function FieldRow({ f }: { f: TzField }) {
  const meta = CONFIDENCE_META[f.confidence];
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{f.label}</div>
        <div className="text-sm font-medium break-words">{f.value}</div>
        <div className="text-[10px] text-muted-foreground/70">источник: {f.source}</div>
      </div>
      <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>{meta.label}</Badge>
    </div>
  );
}

function FieldGroup({ title, fields }: { title: string; fields: TzField[] }) {
  if (!fields.length) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="divide-y divide-border/40">
        {fields.map((f) => <FieldRow key={f.key} f={f} />)}
      </div>
    </div>
  );
}

export function TzPanel({ tz }: { tz: ProjectTz | null }) {
  if (!tz) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          ТЗ появится здесь после распознавания эскиза
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{tz.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <FieldGroup title="Габариты" fields={tz.overall} />
        <FieldGroup title="Состав" fields={tz.composition} />
        <FieldGroup title="Материалы и фурнитура" fields={tz.materials} />
        <FieldGroup title="Ограничения помещения" fields={tz.roomConstraints} />
        {tz.unresolved.map((u) => (
          <div key={u.key} className={cn(
            'rounded-lg border p-3 text-xs',
            u.answer ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5',
          )}>
            <div className="font-medium">{u.answer ? 'Вопрос закрыт' : 'Требуется ваш ответ'}</div>
            <div className="mt-1 text-muted-foreground">{u.question}</div>
            {u.answer && <div className="mt-1 text-emerald-400">Ответ: {u.answer}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function StagesPanel({ stages }: { stages: BuildStage[] }) {
  if (!stages.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Построение в БАЗИС</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {stages.map((s) => (
          <div key={s.id} className="flex items-start gap-2.5">
            {s.status === 'done' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : s.status === 'active' ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-400" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <div>
              <div className={cn('text-sm', s.status === 'pending' && 'text-muted-foreground/60')}>{s.label}</div>
              {s.status !== 'pending' && s.detail && (
                <div className="text-[11px] text-muted-foreground">{s.detail}</div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
