import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

export function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center bg-background">
      <div className="w-14 h-14 rounded-2xl bg-[hsl(0,0%,18%)] flex items-center justify-center">
        <Construction className="w-7 h-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-lg">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
      </div>
    </div>
  );
}
