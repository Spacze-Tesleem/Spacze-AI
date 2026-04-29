import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateProject } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Code2, Loader2, Sparkles } from 'lucide-react';
import { parseSSE } from '@/lib/sse';

const FRAMEWORKS = [
  { id: 'react', name: 'React (Vite)', icon: '⚛️' },
  { id: 'nextjs', name: 'Next.js', icon: '▲' },
  { id: 'vue', name: 'Vue', icon: '💚' },
  { id: 'flask', name: 'Flask (Python)', icon: '🌶️' },
  { id: 'express', name: 'Express (Node)', icon: '🚂' },
  { id: 'fastapi', name: 'FastAPI (Python)', icon: '⚡' },
];

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('react');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState<string[]>([]);

  const createMutation = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      
      // 1. Create project
      const project = await createMutation.mutateAsync({
        data: { name, description, framework }
      });

      // 2. Trigger generation via SSE
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/projects/${project.id}/generate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description })
      });

      await parseSSE<{content?: string, done?: boolean}>(
        response,
        (data) => {
          if (data.content) {
            setGenerateLog(prev => [...prev, data.content!]);
          }
        },
        () => {
          // Done, redirect to workspace
          setLocation(`/projects/${project.id}`);
        },
        (err) => {
          console.error('Generation failed:', err);
          alert('Generation failed, but project was created.');
          setLocation(`/projects/${project.id}`);
        }
      );

    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background flex justify-center items-start">
      <Card className="w-full max-w-2xl border-border bg-card shadow-lg mt-8">
        <CardHeader className="border-b border-border bg-muted/30 pb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Create New Project</CardTitle>
          <CardDescription className="text-base mt-2">
            Describe what you want to build and the AI will scaffold the initial structure.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6">
          {isGenerating ? (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <h3 className="text-xl font-medium text-foreground">Scaffolding Project...</h3>
                <p className="text-muted-foreground">The AI is generating files and wiring up dependencies.</p>
              </div>
              
              <div className="bg-black/50 rounded-lg p-4 font-mono text-xs text-primary h-64 overflow-y-auto border border-border mt-4 flex flex-col justify-end">
                {generateLog.map((log, i) => (
                  <div key={i} className="mb-1">{`> ${log}`}</div>
                ))}
                <div className="animate-pulse">{'> _'}</div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. e-commerce-api" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Framework / Environment</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {FRAMEWORKS.map(fw => (
                    <div 
                      key={fw.id}
                      className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all ${
                        framework === fw.id 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border bg-card hover:bg-accent text-muted-foreground'
                      }`}
                      onClick={() => setFramework(fw.id)}
                    >
                      <span className="text-2xl">{fw.icon}</span>
                      <span className="text-xs font-semibold">{fw.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Project Description & Prompt</Label>
                <Textarea 
                  id="description" 
                  placeholder="Describe the application. What endpoints does it need? What components? Be as detailed as you like." 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[150px] resize-none font-mono text-sm"
                  required
                />
              </div>

              <Button type="submit" className="w-full h-12 text-lg" disabled={!name || !description}>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Project
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
