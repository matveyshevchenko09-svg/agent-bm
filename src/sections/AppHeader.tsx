import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AppWindow, HardDrive, Hammer, History, Pause, Play, Server, UserRound, Wand2 } from 'lucide-react';
import type { Mode, Verbosity } from '@/types';
import type { Account } from '@/lib/store';

const VERBOSITY_LABELS = ['Минимум', 'Средний', 'Подробный'];

interface Props {
  verbosity: Verbosity;
  onVerbosity: (v: Verbosity) => void;
  onReset: () => void;
  user: Account;
  mode: Mode;
  onOpenSessions: () => void;
  onBuild: () => void;
  onManual: () => void;
  onPause: () => void;
  onResume: () => void;
  onContinueByAgent: () => void;
  onToggleBasis: () => void;
  basisOpen: boolean;
}

export function AppHeader({ verbosity, onVerbosity, onReset, user, mode, onOpenSessions, onBuild, onManual, onPause, onResume, onContinueByAgent, onToggleBasis, basisOpen }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-card/60 px-4 py-2.5 backdrop-blur">
      <button className="flex cursor-pointer items-center gap-2.5" onClick={onReset} title="Новый проект">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
          <Hammer size={18} />
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold leading-tight">Агент-БМ</div>
          <div className="text-[11px] text-muted-foreground leading-tight">БАЗИС-Мебельщик · демо-каркас v0.1</div>
        </div>
      </button>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-400">
          <Server className="h-3 w-3" /> Сервер: подключён
        </Badge>
        <Badge variant="outline" className="hidden gap-1.5 border-sky-500/40 text-sky-400 sm:inline-flex">
          <HardDrive className="h-3 w-3" /> БАЗИС: связь активна
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onBuild}
          disabled={mode === 'autonomous'}
          className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          title="АГЕНТ строит сам, прямо в БАЗИС — доступно в любой момент, когда есть эскиз"
        >
          <Hammer className="h-3.5 w-3.5" /> Агент построит сам
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onManual}
          disabled={mode === 'assist' || mode === 'autonomous'}
          className="gap-1.5 disabled:opacity-50"
          title="ВЫ строите сами в окне БАЗИС — агент наблюдает, подсказывает и ловит ошибки"
        >
          <UserRound className="h-3.5 w-3.5" /> Строить самому
        </Button>
        {mode === 'autonomous' && (
          <Button size="sm" variant="outline" onClick={onPause} className="gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10">
            <Pause className="h-3.5 w-3.5" /> Остановить
          </Button>
        )}
        {mode === 'paused' && (
          <Button size="sm" onClick={onResume} className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
            <Play className="h-3.5 w-3.5" /> Продолжить
          </Button>
        )}
        {(mode === 'assist' || mode === 'paused') && (
          <Button size="sm" variant="outline" onClick={onContinueByAgent} className="gap-1.5 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            title="Агент сверит вашу модель с эскизом и достроит с того места, где вы остановились">
            <Wand2 className="h-3.5 w-3.5" /> Продолжить у Агента
          </Button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground md:inline">
                Разговорчивость: <span className="text-foreground">{VERBOSITY_LABELS[verbosity]}</span>
              </span>
              <Slider
                className="w-28"
                min={0} max={2} step={1}
                value={[verbosity]}
                onValueChange={([v]) => onVerbosity(v as Verbosity)}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Насколько подробно агент комментирует работу</TooltipContent>
        </Tooltip>

        <Badge variant="outline" className="gap-1.5 border-border text-muted-foreground">
          <UserRound className="h-3 w-3" /> {user.name}
        </Badge>
        <Button
          variant="outline" size="sm" onClick={onToggleBasis}
          className={`gap-1.5 ${basisOpen ? 'border-amber-500/60 text-amber-400' : ''}`}
          title="Окно-прототип БАЗИС: видно, как агент строит, и можно строить самому"
        >
          <AppWindow className="h-3.5 w-3.5" /> Окно БАЗИС
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenSessions} className="gap-1.5">
          <History className="h-3.5 w-3.5" /> Сессии
        </Button>
      </div>
    </header>
  );
}
