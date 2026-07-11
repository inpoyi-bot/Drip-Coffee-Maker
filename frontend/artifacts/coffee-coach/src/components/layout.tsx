import { Link, useRoute } from 'wouter';

export function Layout({ children }: { children: React.ReactNode }) {
  const [matchHome] = useRoute('/');
  const [matchFeedback] = useRoute('/feedback');
  const [matchDiagnosis] = useRoute('/diagnosis');
  const [matchTrajectory] = useRoute('/trajectory');

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center">
      <header className="w-full max-w-md border-b border-border bg-background px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="font-mono text-sm font-medium tracking-tight text-foreground">COFFEE_COACH</div>
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/" className={matchHome ? 'text-foreground font-bold' : 'text-muted-foreground'}>开始</Link>
          <Link href="/feedback" className={matchFeedback || matchDiagnosis ? 'text-foreground font-bold' : 'text-muted-foreground'}>反馈</Link>
          <Link href="/trajectory" className={matchTrajectory ? 'text-foreground font-bold' : 'text-muted-foreground'}>轨迹</Link>
        </nav>
      </header>
      <main className="w-full max-w-md flex-1 pb-12">
        {children}
      </main>
    </div>
  );
}
