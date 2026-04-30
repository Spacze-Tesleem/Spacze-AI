import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col h-full bg-background items-center justify-center px-4 select-none">
      <div className="text-center space-y-6 max-w-sm">
        {/* Glowing number */}
        <div className="relative inline-block">
          <span
            className="text-[120px] font-bold leading-none tabular-nums"
            style={{
              background: 'linear-gradient(135deg, hsl(258 90% 66%), hsl(217 91% 60%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px hsl(258 90% 66% / 0.3))',
            }}
          >
            404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(258,90%,66%)] text-white text-sm font-medium hover:bg-[hsl(258,90%,60%)] transition-colors shadow-md shadow-[hsl(258,90%,66%,0.25)]">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
