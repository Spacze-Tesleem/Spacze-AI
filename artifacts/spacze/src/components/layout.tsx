import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  FolderGit2,
  LayoutDashboard,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-64'
        )}
      >
        {/* Top: logo + collapse toggle */}
        <div className="flex items-center justify-between h-14 px-3 shrink-0">
          {collapsed ? (
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center mx-auto">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-background" />
                </div>
                <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
                  Spacze AI
                </span>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Nav items */}
        <nav className={cn('px-2 space-y-0.5', collapsed && 'flex flex-col items-center gap-0.5')}>
          {[
            { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
            { href: '/projects', icon: FolderGit2, label: 'Projects' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg text-sm transition-colors',
                collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2.5',
                isActive(href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {collapsed && (
          <div className="flex justify-center pb-4">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
