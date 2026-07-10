import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { createContext, useState } from 'react';
import type { AgentTurnResult } from '@/lib/adkClient';
import { Layout } from '@/components/layout';

import Home from '@/pages/home';
import Feedback from '@/pages/feedback';
import Diagnosis from '@/pages/diagnosis';
import Trajectory from '@/pages/trajectory';

const queryClient = new QueryClient();

export const AppContext = createContext<{
  latestTurn: AgentTurnResult | null;
  setLatestTurn: (t: AgentTurnResult | null) => void;
}>({
  latestTurn: null,
  setLatestTurn: () => {},
});

function App() {
  const [latestTurn, setLatestTurn] = useState<AgentTurnResult | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ latestTurn, setLatestTurn }}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/feedback" component={Feedback} />
              <Route path="/diagnosis" component={Diagnosis} />
              <Route path="/trajectory" component={Trajectory} />
              <Route>
                <div className="p-6 text-center text-muted-foreground">Not found</div>
              </Route>
            </Switch>
          </Layout>
        </WouterRouter>
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
