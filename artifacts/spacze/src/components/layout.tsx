import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, MessageSquare, FolderGit2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/projects', icon: FolderGit2, label: 'Projects' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-16 border-r flex flex-col items-center py-4 bg-sidebar">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold mb-8">
          S
        </div>
        
        <nav className="flex flex-col gap-4 w-full px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || 
                            (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center transition-colors group relative",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                {/* Tooltip */}
                <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border shadow-md">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
