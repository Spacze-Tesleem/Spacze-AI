import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  LayoutGrid,
  Globe,
  Layers,
  ShieldCheck,
  Settings,
  Plus,
  Download,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/',             icon: Home,        label: 'Home' },
  { href: '/projects',     icon: LayoutGrid,  label: 'Projects' },
  { href: '/published',    icon: Globe,       label: 'Published Projects' },
  { href: '/integrations', icon: Layers,      label: 'Integrations' },
  { href: '/security',     icon: ShieldCheck, label: 'Security' },
  { href: '/settings',     icon: Settings,    label: 'Settings' },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
            Spacze AI
          </span>
        </div>

        {/* CTA buttons */}
        <div className="px-3 space-y-2 mb-5">
          <Link href="/projects/new">
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-sidebar-border text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create something new</span>
            </button>
          </Link>
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-sidebar-border text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Download className="w-4 h-4 shrink-0" />
            <span>Import code or design</span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive(href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
