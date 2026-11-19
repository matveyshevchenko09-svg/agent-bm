import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Cpu, Lock, User } from 'lucide-react';
import { authenticate, getAccounts, type Account } from '@/lib/store';

interface Props {
  onLogin: (acc: Account) => void;
}

export function AuthScreen({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const acc = authenticate(login, password);
    if (acc) {
      onLogin(acc);
    } else {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Cpu size={26} />
          </div>
          <CardTitle className="text-lg">Агент-БМ</CardTitle>
          <CardDescription>Вход для технолога · БАЗИС-Мебельщик</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={login}
                onChange={(e) => { setLogin(e.target.value); setError(''); }}
                className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              >
                <option value="" disabled>
                  Выберите технолога…
                </option>
                {getAccounts().map((a) => (
                  <option key={a.login} value={a.login}>
                    {a.name} ({a.login})
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Пароль"
                className="pl-9"
              />
            </div>
            {error && <div className="text-xs text-red-400">{error}</div>}
            <Button type="submit" className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
