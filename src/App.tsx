import { useEffect, useRef, useState } from 'react';
import { AppHeader } from '@/sections/AppHeader';
import { ChatSection } from '@/sections/ChatSection';
import { TzPanel, StagesPanel } from '@/sections/TzPanel';
import { DeviationCard } from '@/sections/DeviationCard';
import { JournalPanel } from '@/sections/JournalPanel';
import { AuthScreen } from '@/sections/AuthScreen';
import { SessionsScreen } from '@/sections/SessionsScreen';
import { BasisMockWindow } from '@/sections/BasisMockWindow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAgent } from '@/hooks/useAgent';
import { uid } from '@/lib/demo-data';
import {
  getCurrentUser, setCurrentUser, loadSessionData, saveSessionData,
  type Account,
} from '@/lib/store';
import './App.css';

function Workspace({ user, sessionId, onOpenSessions }: {
  user: Account;
  sessionId: string;
  onOpenSessions: () => void;
}) {
  const agent = useAgent();
  const [basisOpen, setBasisOpen] = useState(false);
  const newDeviations = agent.deviations.filter((d) => d.status === 'new').length;
  const saveTimer = useRef<number | null>(null);
  const loaded = useRef(false);

  // Загрузка сессии при открытии
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const data = loadSessionData<Parameters<typeof agent.restore>[0]>(user.login, sessionId);
    agent.restore(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user.login]);

  // Автосохранение сессии (память агента при этом общая и от сессий не зависит)
  useEffect(() => {
    if (!loaded.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const snap = agent.getSnapshot();
      const firstUserMsg = snap.messages.find((m) => m.role === 'user')?.text?.trim();
      const title = snap.tz?.title || (firstUserMsg ? firstUserMsg.slice(0, 60) : 'Новая сессия');
      saveSessionData(user.login, sessionId, title, snap);
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.messages, agent.mode, agent.tz, agent.stages, agent.deviations, agent.userParts]);

  const onChatAction = (event: string) => {
    if (event === 'mode_autonomous') agent.startAutonomous();
    if (event === 'mode_assist') agent.startAssist();
    if (event.startsWith('fix_collision:')) agent.fixCollision(event.slice('fix_collision:'.length));
    if (event.startsWith('keep_collision:')) agent.keepCollision(event.slice('keep_collision:'.length));
    if (event.startsWith('fit_user:')) agent.fitUserChange(event.slice('fit_user:'.length));
    if (event.startsWith('fix_sketch:')) agent.fixSketchChange(event.slice('fix_sketch:'.length));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh">
      <AppHeader
        verbosity={agent.verbosity}
        onVerbosity={agent.setVerbosity}
        onReset={agent.resetAll}
        user={user}
        onOpenSessions={onOpenSessions}
        mode={agent.mode}
        onBuild={agent.startAutonomous}
        onManual={() => { agent.startAssist(); setBasisOpen(true); }}
        onPause={agent.pauseBuild}
        onResume={agent.resumeBuild}
        onContinueByAgent={agent.continueByAgent}
        onToggleBasis={() => setBasisOpen((v) => !v)}
        basisOpen={basisOpen}
      />

      {basisOpen && (
        <BasisMockWindow
          stages={agent.stages}
          userParts={agent.userParts}
          mode={agent.mode}
          hasTz={agent.tz !== null}
          onAddPart={agent.addUserPart}
          onMovePart={agent.moveUserPart}
          onClose={() => setBasisOpen(false)}
        />
      )}

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(380px,44%)_1fr] lg:grid-rows-1">
        {/* Левая колонка — чат с агентом */}
        <div className="h-[65dvh] overflow-hidden border-b border-border/60 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
          <ChatSection messages={agent.messages} busy={agent.busy} onSend={agent.sendUser} onAction={onChatAction} />
        </div>

        {/* Правая колонка — ТЗ, отклонения, журналы */}
        <div className="h-[80dvh] overflow-hidden lg:h-full lg:min-h-0">
          <Tabs defaultValue="tz" className="flex h-full flex-col">
            <div className="border-b border-border/60 px-4 pt-2">
              <TabsList className="bg-transparent">
                <TabsTrigger value="tz">ТЗ и построение</TabsTrigger>
                <TabsTrigger value="deviations" className="gap-1.5">
                  Отклонения
                  {newDeviations > 0 && (
                    <Badge className="h-4 min-w-4 justify-center bg-amber-500 px-1 text-[10px] text-zinc-950">{newDeviations}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="journal">Журнал</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tz" className="m-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-4">
                  <StagesPanel stages={agent.stages} />
                  <TzPanel tz={agent.tz} />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="deviations" className="m-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-4">
                  {agent.deviations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                      {agent.mode === 'assist'
                        ? 'Агент наблюдает за моделью. Несовпадений пока не обнаружено.'
                        : 'Отклонения появятся в режиме «Построить с помощью ИИ»'}
                    </div>
                  ) : (
                    agent.deviations.map((d) => (
                      <DeviationCard key={d.id} dev={d} onAct={agent.actDeviation} onUndo={agent.undoFix} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="journal" className="m-0 min-h-0 flex-1 p-4">
              <JournalPanel journal={agent.journal} onClear={agent.clearJournal} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<Account | null>(() => getCurrentUser());
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (!user) {
    return <AuthScreen onLogin={(acc) => { setCurrentUser(acc); setUser(acc); }} />;
  }

  if (!sessionId) {
    return (
      <SessionsScreen
        user={user}
        onOpen={(id) => setSessionId(id ?? uid())}
        onLogout={() => { setCurrentUser(null); setUser(null); setSessionId(null); }}
      />
    );
  }

  return (
    <Workspace
      key={sessionId}
      user={user}
      sessionId={sessionId}
      onOpenSessions={() => setSessionId(null)}
    />
  );
}

export default App;
