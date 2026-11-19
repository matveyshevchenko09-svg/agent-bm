import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, UploadedImage, AgentRole } from '@/types';
import { ROLE_NAMES } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ImagePlus, Mic, MicOff, SendHorizonal, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uid } from '@/lib/demo-data';

const ROLE_STYLES: Record<AgentRole, string> = {
  technolog: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  konstruktor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  sborschik: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  system: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string, images: UploadedImage[]) => void;
  onAction: (event: string) => void;
}

export function ChatSection({ messages, busy, onSend, onAction }: Props) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  // Голосовой ввод (распознавание речи браузера, русский язык)
  const speechSupported = typeof window !== 'undefined' &&
    ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

  const toggleListen = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = ((window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => {
        lang: string; interimResults: boolean; continuous: boolean;
        onresult: (e: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string } }[] }) => void;
        onend: () => void; onerror: () => void;
        start: () => void; stop: () => void;
      }) | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const said = e.results[i][0].transcript.trim();
          if (said) setText((t) => (t ? t + ' ' : '') + said);
        }
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  // Прокручиваем ТОЛЬКО внутреннюю ленту чата, не трогая страницу целиком
  useEffect(() => {
    const vp = areaRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [messages]);

  // Останавливаем запись голоса при закрытии/смене сессии
  useEffect(() => () => { recRef.current?.stop(); }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).filter((f) => f.type.startsWith('image/')).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, { id: uid(), name: f.name, dataUrl: String(reader.result) }]);
      };
      reader.readAsDataURL(f);
    });
  }, []);

  // Вставка по Ctrl+V: фото из буфера прикрепляются, текст вставляется как обычно
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  // Копирование сообщения (правая кнопка → «Копировать текст»; Ctrl+C работает по выделению)
  const copyMessage = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {
      // Запасной вариант для окружений без clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  };

  const submit = () => {
    if (!text.trim() && images.length === 0) return;
    onSend(text, images);
    setText('');
    setImages([]);
  };

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-hidden', dragOver && 'outline-dashed outline-2 outline-amber-400/60 outline-offset-[-6px] rounded-lg')}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      onPaste={(e) => {
        // Ctrl+V в любом месте чата (когда фокус НЕ в поле ввода — там свой обработчик)
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length) { e.preventDefault(); addFiles(files); }
      }}
    >
      <ScrollArea ref={areaRef} className="min-h-0 flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] space-y-1.5', m.role === 'user' && 'text-right')}>
                {m.role !== 'user' && (
                  <span className={cn('inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium', ROLE_STYLES[m.role as AgentRole] ?? ROLE_STYLES.system)}>
                    {ROLE_NAMES[m.role as AgentRole] ?? 'Система'}
                  </span>
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div className={cn(
                      'select-text rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-left',
                      m.role === 'user' ? 'bg-amber-500/15 text-amber-50' : 'bg-card border border-border/60',
                    )}>
                      {m.text}
                      {m.attachments?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((a) => (
                            <img key={a.id} src={a.dataUrl} alt={a.name} className="h-20 w-20 rounded-md border border-border object-cover" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => copyMessage(m.text)}>
                      <Copy className="mr-2 h-4 w-4" /> Копировать текст
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {m.actions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <Button
                        key={a.id}
                        size="sm"
                        variant={a.kind === 'primary' ? 'default' : 'outline'}
                        className={a.kind === 'primary' ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400' : ''}
                        onClick={() => onAction(a.event)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="text-[10px] text-muted-foreground">
                  {new Date(m.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 pt-3">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded-md border border-border object-cover" />
              <button
                className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-800 p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => setImages((p) => p.filter((i) => i.id !== img.id))}
                aria-label="Убрать изображение"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
          <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} aria-label="Прикрепить фото">
            <ImagePlus className="h-4 w-4" />
          </Button>
          {speechSupported ? (
            <Button
              variant="outline" size="icon" onClick={toggleListen}
              aria-label={listening ? 'Остановить запись' : 'Голосовая команда'}
              title={listening ? 'Говорите… нажмите, чтобы остановить' : 'Сказать команду: «поставь ещё 1 ящик влево внизу»'}
              className={listening ? 'border-red-500/60 bg-red-500/10 text-red-400 animate-pulse' : ''}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          ) : null}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            onPaste={onPaste}
            placeholder="Напишите, скажите 🎙 или вставьте фото (Ctrl+V)…"
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={submit} disabled={busy || (!text.trim() && images.length === 0)} size="icon"
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400" aria-label="Отправить">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
