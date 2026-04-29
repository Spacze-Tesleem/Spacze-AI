import React from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Placeholder } from "@/pages/placeholder";

// Import pages
import Dashboard from "@/pages/dashboard";
import ChatList from "@/pages/chat-list";
import ChatThread from "@/pages/chat-thread";
import ProjectList from "@/pages/project-list";
import ProjectNew from "@/pages/project-new";
import ProjectWorkspace from "@/pages/project-workspace";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/chat" component={ChatList} />
        <Route path="/chat/:id" component={ChatThread} />
        <Route path="/projects" component={ProjectList} />
        <Route path="/projects/new" component={ProjectNew} />
        <Route path="/projects/:id" component={ProjectWorkspace} />
        <Route path="/published">{() => <Placeholder title="Published Projects" />}</Route>
        <Route path="/integrations">{() => <Placeholder title="Integrations" />}</Route>
        <Route path="/security">{() => <Placeholder title="Security" />}</Route>
        <Route path="/settings">{() => <Placeholder title="Settings" />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
