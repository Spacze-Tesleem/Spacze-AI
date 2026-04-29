import { Router } from "express";
import { db } from "@workspace/db";
import { projects, projectFiles } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateProjectBody,
  GetProjectParams,
  DeleteProjectParams,
  ListProjectFilesParams,
  UpdateProjectFileParams,
  UpdateProjectFileBody,
  GenerateProjectCodeParams,
  GenerateProjectCodeBody,
  DebugProjectCodeParams,
  DebugProjectCodeBody,
} from "@workspace/api-zod";

const router = Router();

// List all projects
router.get("/projects", async (req, res) => {
  const allProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt));
  res.json(allProjects);
});

// Get project stats
router.get("/projects/stats", async (req, res) => {
  const total = await db.select({ count: count() }).from(projects);

  const byFrameworkRaw = await db
    .select({ framework: projects.framework, count: count() })
    .from(projects)
    .groupBy(projects.framework);

  const byStatusRaw = await db
    .select({ status: projects.status, count: count() })
    .from(projects)
    .groupBy(projects.status);

  const recentProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(5);

  const byFramework: Record<string, number> = {};
  for (const row of byFrameworkRaw) {
    byFramework[row.framework] = row.count;
  }

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) {
    byStatus[row.status] = row.count;
  }

  res.json({
    total: total[0]?.count ?? 0,
    byFramework,
    byStatus,
    recentProjects,
  });
});

// Create a project
router.post("/projects", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);
  const [project] = await db
    .insert(projects)
    .values({
      name: body.name,
      description: body.description,
      framework: body.framework,
      status: "scaffolding",
    })
    .returning();
  res.status(201).json(project);
});

// Get a project with files
router.get("/projects/:id", async (req, res) => {
  const { id } = GetProjectParams.parse({ id: parseInt(req.params.id) });
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id))
    .orderBy(projectFiles.path);
  res.json({ ...project, files });
});

// Delete a project
router.delete("/projects/:id", async (req, res) => {
  const { id } = DeleteProjectParams.parse({ id: parseInt(req.params.id) });
  const [project] = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.status(204).send();
});

// List project files
router.get("/projects/:id/files", async (req, res) => {
  const { id } = ListProjectFilesParams.parse({ id: parseInt(req.params.id) });
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id))
    .orderBy(projectFiles.path);
  res.json(files);
});

// Update a project file
router.put("/projects/:id/files/:fileId", async (req, res) => {
  const { id, fileId } = UpdateProjectFileParams.parse({
    id: parseInt(req.params.id),
    fileId: parseInt(req.params.fileId),
  });
  const body = UpdateProjectFileBody.parse(req.body);

  const [file] = await db
    .update(projectFiles)
    .set({ content: body.content, updatedAt: new Date() })
    .where(eq(projectFiles.id, fileId))
    .returning();

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.json(file);
});

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    env: "plaintext",
    toml: "toml",
    sql: "sql",
  };
  return langMap[ext] || "plaintext";
}

// Generate project code (streaming SSE)
router.post("/projects/:id/generate", async (req, res) => {
  const { id } = GenerateProjectCodeParams.parse({ id: parseInt(req.params.id) });
  const body = GenerateProjectCodeBody.parse(req.body);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const prompt = body.prompt || project.description;

  const systemPrompt = `You are Spacze AI Agent, a full-stack code generator. Generate a complete, working ${project.framework} project scaffold.

Return the project as a JSON object with this exact structure:
{
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "file content here"
    }
  ]
}

Requirements:
- Generate 5-10 essential files for a working ${project.framework} project
- Include package.json/requirements.txt, main entry point, and key components
- Make the code production-ready and well-commented
- Include a README.md explaining the project structure
- Do NOT include node_modules or build artifacts
- Return ONLY the JSON object, no other text`;

  try {
    res.write(`data: ${JSON.stringify({ content: `Scaffolding ${project.framework} project: ${project.name}...\n` })}\n\n`);

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Project: ${project.name}\n\nDescription: ${prompt}\n\nGenerate the complete project scaffold.` },
      ],
    });

    const rawContent = response.choices[0]?.message?.content || "{}";

    res.write(`data: ${JSON.stringify({ content: "Parsing generated code...\n" })}\n\n`);

    // Extract JSON from the response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const fileList: Array<{ path: string; content: string }> = parsed.files || [];

    res.write(`data: ${JSON.stringify({ content: `Writing ${fileList.length} files...\n` })}\n\n`);

    // Delete existing files and insert new ones
    await db.delete(projectFiles).where(eq(projectFiles.projectId, id));

    for (const file of fileList) {
      await db.insert(projectFiles).values({
        projectId: id,
        path: file.path,
        content: file.content,
        language: getLanguageFromPath(file.path),
      });
      res.write(`data: ${JSON.stringify({ content: `  ✓ ${file.path}\n` })}\n\n`);
    }

    // Update project status
    await db
      .update(projects)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(projects.id, id));

    res.write(`data: ${JSON.stringify({ content: `\nProject scaffolded successfully! ${fileList.length} files generated.\n` })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    await db
      .update(projects)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(projects.id, id));
    res.write(`data: ${JSON.stringify({ content: `Error: ${err instanceof Error ? err.message : "Generation failed"}\n` })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

// Debug project code (streaming SSE)
router.post("/projects/:id/debug", async (req, res) => {
  const { id } = DebugProjectCodeParams.parse({ id: parseInt(req.params.id) });
  const body = DebugProjectCodeBody.parse(req.body);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fileContext = "";
  if (body.fileId) {
    const file = await db.query.projectFiles.findFirst({
      where: eq(projectFiles.id, body.fileId),
    });
    if (file) {
      fileContext = `\n\nFile context (${file.path}):\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
    }
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are Spacze AI Agent's debugging module. Analyze errors and provide precise, actionable fixes. Format your response with:
1. **Root Cause** - What's causing the error
2. **Fix** - The exact code change needed
3. **Explanation** - Why this fix works
Be concise and technical.`,
        },
        {
          role: "user",
          content: `Project: ${project.name} (${project.framework})\n\nError:\n\`\`\`\n${body.error}\n\`\`\`${fileContext}\n\nAnalyze this error and provide a fix.`,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ content: "Debug analysis failed. Please try again." })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

export default router;
