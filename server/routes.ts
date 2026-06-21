import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { streamChatResponse, type ChatStreamMessage } from "./ai-agents/providers/openrouter-chat";
import { providerManager } from "./ai-agents/providers/provider-manager";
import { connectDB } from "./db";
import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { Document, Packer, Paragraph, HeadingLevel, ImageRun } from "docx";
import { renderMermaidToImage, extractMermaidBlocks, replaceMermaidWithImages, replaceImagesWithMermaid, closeBrowserInstance } from "./diagram-renderer";
import { runDocumentationPipeline } from "./ai-agents/doc-generator";
import type { ProjectMetadata } from "./ai-agents/types/project-metadata";
import passport from "passport";
import { ensureAuthenticated } from "./auth";

async function generateDocxBuffer(
  title: string,
  content: string,
  _diagramImages?: Record<string, string>,
): Promise<Buffer> {
  const children: (Paragraph | any)[] = [
    new Paragraph({
      text: `Documentation for ${title}`,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({ text: "\n" }),
  ];

  const lines = content.split("\n");
  let i = 0;
  let inCodeBlock = false;
  let codeBlockLanguage = "";

  while (i < lines.length) {
    const line = lines[i];

    const codeBlockStart = line.match(/^```(\w+)?/);
    if (codeBlockStart) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = (codeBlockStart[1] || "").toLowerCase();
        i++;
        continue;
      } else {
        inCodeBlock = false;
        codeBlockLanguage = "";
        i++;
        continue;
      }
    }

    if (inCodeBlock) {
      if (codeBlockLanguage === "mermaid") {
        i++;
        continue;
      }
      const codeContent = lines[i];
      children.push(new Paragraph({
        text: codeContent || "",
        spacing: { after: 50 },
        indent: { left: 720 },
      }));
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(new Paragraph({ 
        text: line.replace("# ", "").trim(), 
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }));
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(new Paragraph({ 
        text: line.replace("## ", "").trim(), 
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }));
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(new Paragraph({ 
        text: line.replace("### ", "").trim(), 
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
      i++;
      continue;
    }

    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      const alt = (imageMatch[1] || "Diagram").trim();
      const imagePath = (imageMatch[2] || "").trim();

      if (imagePath.startsWith("/")) {
        const diskPath = path.join(process.cwd(), "public", imagePath.slice(1));
        if (fs.existsSync(diskPath)) {
          try {
            const imageBuffer = fs.readFileSync(diskPath);
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    type: "png",
                    transformation: { 
                      width: 900,
                      height: 600,
                    },
                  } as any),
                ],
                alignment: "center",
                spacing: { before: 200, after: 200 },
              }),
            );
            if (alt && alt !== "Diagram") {
              children.push(
                new Paragraph({
                  text: `Figure: ${alt}`,
                  alignment: "center",
                  spacing: { after: 300 },
                  style: "Caption",
                }),
              );
            } else {
              children.push(new Paragraph({ text: "\n", spacing: { after: 300 } }));
            }
            i++;
            continue;
          } catch (e) {
            console.warn("Failed to embed diagram image into DOCX:", diskPath, e);
          }
        }
      }

      children.push(
        new Paragraph({
          text: `[Diagram: ${alt}] ${imagePath}`,
          spacing: { after: 200 },
        }),
      );
      i++;
      continue;
    }

    if (line.match(/^\s*[-*+]\s+/)) {
      const text = line.replace(/^\s*[-*+]\s+/, "").trim();
      if (text) {
        children.push(new Paragraph({
          text: `• ${text}`,
          spacing: { after: 100 },
        }));
      }
      i++;
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      const text = line.replace(/^\s*\d+\.\s+/, "").trim();
      if (text) {
        children.push(new Paragraph({
          text: text,
          spacing: { after: 100 },
        }));
      }
      i++;
      continue;
    }

    if (line.trim()) {
      children.push(new Paragraph({ 
        text: line.trim(),
        spacing: { after: 100 },
      }));
    } else {
      children.push(new Paragraph({ text: "\n" }));
    }
    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

function normalizeGitHubRepoUrl(inputUrl: string): string {
  try {
    const u = new URL(inputUrl);
    if (u.hostname !== "github.com") return inputUrl;
    const segments = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (segments.length < 2) return inputUrl;
    const [owner, repo] = segments;
    u.pathname = `/${owner}/${repo}`;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return inputUrl;
  }
}

async function collectProjectMetadata(tempDir: string, repoUrl: string): Promise<ProjectMetadata> {
  const metadata: ProjectMetadata = {
    projectName: "",
    version: "",
    description: "",
    license: "",
    repoUrl,
    readmeContent: "",
    dependencies: {},
    devDependencies: {},
    scripts: {},
    packageManager: "unknown",
    folderStructure: "",
    totalFileCount: 0,
    languages: [],
    configFiles: [],
    envExample: "",
    hasDocker: false,
    dockerfileContent: "",
    dockerComposeContent: "",
    hasTests: false,
    testDirectories: [],
    testFileCount: 0,
    testFramework: "unknown",
    hasMigrations: false,
    migrationFiles: [],
    schemaFiles: [],
    hasCICD: false,
    cicdFiles: [],
    recentCommits: [],
    branchName: "",
  };

  // Read package.json
  const pkgPath = path.join(tempDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      metadata.projectName = pkg.name || "";
      metadata.version = pkg.version || "";
      metadata.description = pkg.description || "";
      metadata.license = pkg.license || "";
      metadata.dependencies = pkg.dependencies || {};
      metadata.devDependencies = pkg.devDependencies || {};
      metadata.scripts = pkg.scripts || {};
      metadata.packageManager = "npm";
    } catch { /* ignore parse errors */ }
  }

  // Check for other package managers
  if (fs.existsSync(path.join(tempDir, "yarn.lock"))) metadata.packageManager = "yarn";
  if (fs.existsSync(path.join(tempDir, "pnpm-lock.yaml"))) metadata.packageManager = "pnpm";
  if (fs.existsSync(path.join(tempDir, "requirements.txt"))) metadata.packageManager = "pip";
  if (fs.existsSync(path.join(tempDir, "go.mod"))) metadata.packageManager = "go modules";
  if (fs.existsSync(path.join(tempDir, "Cargo.toml"))) metadata.packageManager = "cargo";

  // Read README
  const readmeNames = ["README.md", "readme.md", "README.rst", "README.txt", "README"];
  for (const name of readmeNames) {
    const readmePath = path.join(tempDir, name);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, "utf-8");
      metadata.readmeContent = content.substring(0, 5000);
      break;
    }
  }

  // Read .env.example
  const envNames = [".env.example", ".env.sample", ".env.template"];
  for (const name of envNames) {
    const envPath = path.join(tempDir, name);
    if (fs.existsSync(envPath)) {
      metadata.envExample = fs.readFileSync(envPath, "utf-8").substring(0, 2000);
      break;
    }
  }

  // Docker detection
  const dockerfilePath = path.join(tempDir, "Dockerfile");
  const dockerComposePaths = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
  if (fs.existsSync(dockerfilePath)) {
    metadata.hasDocker = true;
    metadata.dockerfileContent = fs.readFileSync(dockerfilePath, "utf-8").substring(0, 2000);
  }
  for (const dcName of dockerComposePaths) {
    const dcPath = path.join(tempDir, dcName);
    if (fs.existsSync(dcPath)) {
      metadata.hasDocker = true;
      metadata.dockerComposeContent = fs.readFileSync(dcPath, "utf-8").substring(0, 2000);
      break;
    }
  }

  // Config files detection
  const configNames = [
    "tsconfig.json", "vite.config.ts", "vite.config.js", "webpack.config.js",
    "next.config.js", "next.config.ts", ".eslintrc.json", ".eslintrc.js",
    "tailwind.config.js", "tailwind.config.ts", "drizzle.config.ts",
    "prisma/schema.prisma", ".prettierrc", "babel.config.js",
  ];
  for (const name of configNames) {
    const cfgPath = path.join(tempDir, name);
    if (fs.existsSync(cfgPath)) {
      try {
        const content = fs.readFileSync(cfgPath, "utf-8");
        metadata.configFiles.push({ name, content: content.substring(0, 1000) });
      } catch { /* ignore */ }
    }
  }

  // Test detection
  const testDirNames = ["test", "tests", "__tests__", "spec", "e2e"];
  for (const dir of testDirNames) {
    const testDir = path.join(tempDir, dir);
    if (fs.existsSync(testDir) && fs.statSync(testDir).isDirectory()) {
      metadata.hasTests = true;
      metadata.testDirectories.push(dir);
    }
  }
  // Count test files
  try {
    const testFiles = await glob("**/*.{test,spec}.{js,ts,jsx,tsx,py}", {
      cwd: tempDir,
      ignore: ["node_modules/**"],
    });
    metadata.testFileCount = testFiles.length;
    if (testFiles.length > 0) metadata.hasTests = true;
  } catch { /* ignore */ }

  // Detect test framework from devDependencies
  const devDeps = Object.keys(metadata.devDependencies);
  if (devDeps.includes("jest")) metadata.testFramework = "jest";
  else if (devDeps.includes("vitest")) metadata.testFramework = "vitest";
  else if (devDeps.includes("mocha")) metadata.testFramework = "mocha";
  else if (devDeps.includes("pytest") || fs.existsSync(path.join(tempDir, "pytest.ini"))) metadata.testFramework = "pytest";

  // Migration and schema detection
  const migrationDirs = ["migrations", "prisma/migrations", "db/migrations", "src/migrations"];
  for (const dir of migrationDirs) {
    const migDir = path.join(tempDir, dir);
    if (fs.existsSync(migDir) && fs.statSync(migDir).isDirectory()) {
      metadata.hasMigrations = true;
      try {
        const files = await glob(`${dir}/**/*.{sql,ts,js}`, { cwd: tempDir });
        metadata.migrationFiles.push(...files.slice(0, 20));
      } catch { /* ignore */ }
    }
  }
  // Schema files
  try {
    const schemas = await glob("**/*.{prisma,sql,graphql}", {
      cwd: tempDir,
      ignore: ["node_modules/**", "dist/**"],
    });
    metadata.schemaFiles = schemas.slice(0, 20);
  } catch { /* ignore */ }

  // CI/CD detection
  const cicdPaths = [
    ".github/workflows",
    ".gitlab-ci.yml",
    ".circleci",
    "Jenkinsfile",
    ".travis.yml",
    "azure-pipelines.yml",
  ];
  for (const ciPath of cicdPaths) {
    const fullPath = path.join(tempDir, ciPath);
    if (fs.existsSync(fullPath)) {
      metadata.hasCICD = true;
      if (fs.statSync(fullPath).isDirectory()) {
        try {
          const files = await glob(`${ciPath}/**/*.{yml,yaml}`, { cwd: tempDir });
          metadata.cicdFiles.push(...files);
        } catch { /* ignore */ }
      } else {
        metadata.cicdFiles.push(ciPath);
      }
    }
  }

  // Folder structure (depth 3, max 100)
  try {
    const allEntries = await glob("**/*", {
      cwd: tempDir,
      ignore: ["node_modules/**", "dist/**", "build/**", ".git/**", "*.lock"],
      maxDepth: 3,
    });
    const limited = allEntries.slice(0, 100);
    metadata.folderStructure = limited.join("\n");
    metadata.totalFileCount = allEntries.length;
  } catch { /* ignore */ }

  // Language detection from file extensions
  try {
    const allCodeFiles = await glob("**/*.{js,ts,jsx,tsx,py,java,go,rs,cpp,c,h,rb,php,swift,kt,cs,sql}", {
      cwd: tempDir,
      ignore: ["node_modules/**", "dist/**", "build/**"],
    });
    const extMap: Record<string, string> = {
      ".js": "JavaScript", ".ts": "TypeScript", ".jsx": "React JSX", ".tsx": "React TSX",
      ".py": "Python", ".java": "Java", ".go": "Go", ".rs": "Rust",
      ".cpp": "C++", ".c": "C", ".h": "C/C++ Header", ".rb": "Ruby",
      ".php": "PHP", ".swift": "Swift", ".kt": "Kotlin", ".cs": "C#", ".sql": "SQL",
    };
    const langs = new Set<string>();
    for (const file of allCodeFiles) {
      const ext = path.extname(file).toLowerCase();
      if (extMap[ext]) langs.add(extMap[ext]);
    }
    metadata.languages = Array.from(langs);
  } catch { /* ignore */ }

  // Recent commits
  try {
    const git = simpleGit(tempDir);
    const log = await git.log({ maxCount: 10 });
    metadata.recentCommits = log.all.map((c) => `${c.hash.substring(0, 7)} - ${c.message}`);
    metadata.branchName = (await git.branch()).current;
  } catch { /* ignore */ }

  console.log(`[metadata] Collected: ${metadata.projectName} v${metadata.version}, ${metadata.languages.join(", ")}, ${metadata.totalFileCount} files`);
  return metadata;
}

async function processRepo(repoId: string, repoUrl: string) {
  const tempDir = path.join("/tmp", `repo-${repoId}-${Date.now()}`);
  
  try {
    await storage.updateRepo(repoId, { status: "processing" });

    if (!process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "Missing API keys. At least GROQ_API_KEY or OPENROUTER_API_KEY must be set.",
      );
    }
    if (!process.env.BYTEZ_API_KEY) {
      console.warn("BYTEZ_API_KEY not set. Backup provider will not be available.");
    }

    console.log(`Cloning ${repoUrl} to ${tempDir}`);
    const git = simpleGit();
    await git.clone(repoUrl, tempDir);

    const log = await git.cwd(tempDir).log();
    const latestHash = log.latest?.hash;

    const prevRepo = await storage.getRepo(repoId);
    let changedFiles: string[] = [];
    let isUpdate = false;

    if (prevRepo && prevRepo.lastCommitHash) {
      console.log(`Checking for changes since ${prevRepo.lastCommitHash}...`);
      try {
         const diffSummary = await git.cwd(tempDir).diffSummary([prevRepo.lastCommitHash, "HEAD"]);
         changedFiles = diffSummary.files.map(f => f.file);
         isUpdate = true;
         console.log(`Found ${changedFiles.length} changed files.`);
      } catch (e) {
         console.warn("Could not diff commits, analyzing all.", e);
      }
    }

    const pattern = "**/*.{js,ts,py,java,cpp,c,h,go,rs,sql,prisma,graphql}";
    const allFiles = await glob(pattern, { 
      cwd: tempDir, 
      ignore: ["node_modules/**", "dist/**", "build/**", "test/**"] 
    });

    const filesToAnalyze = isUpdate 
      ? allFiles.filter(f => changedFiles.includes(f))
      : allFiles;

    if (isUpdate && filesToAnalyze.length === 0) {
       console.log("No relevant code files changed.");
       await storage.updateRepo(repoId, { 
        status: "completed",
        lastCommitHash: latestHash
      });
       return;
    }

    let existingDocContent = "";
    if (isUpdate) {
       const existingDoc = await storage.getDocumentation(repoId);
       if (existingDoc) {
         existingDocContent = existingDoc.content;
       }
    }

    console.log(`Collecting project metadata...`);
    const projectMetadata = await collectProjectMetadata(tempDir, repoUrl);

    console.log(`Running multi-agent pipeline on ${filesToAnalyze.length} files...`);
    const pipelineResult = await runDocumentationPipeline(tempDir, filesToAnalyze, existingDocContent || undefined, projectMetadata);
    let docContent = pipelineResult.documentation;
    const qualityScore = pipelineResult.verificationScore;

    console.log(`Generated documentation content length: ${docContent.length} characters`);

    const mermaidBlocks = extractMermaidBlocks(docContent);
    console.log(`Extracted ${mermaidBlocks.length} Mermaid diagram(s)`);
    
    mermaidBlocks.forEach((block, i) => {
      console.log(`  Diagram ${i + 1} (${block.name}): ${block.code.substring(0, 100)}...`);
    });
    
    const diagramImages: Record<string, string> = {};
    const diagramSources: Record<string, string> = {};

    // Capture Mermaid source code before rendering
    for (const block of mermaidBlocks) {
      diagramSources[block.name] = block.code;
    }

    console.log(`Rendering ${mermaidBlocks.length} diagram(s)...`);

    try {
      for (const block of mermaidBlocks) {
        try {
          const imagePath = await renderMermaidToImage(block.code, block.name, repoId);
          diagramImages[block.name] = imagePath;
          console.log(`Rendered diagram ${block.name} -> ${imagePath}`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`✗ Failed to render diagram ${block.name}:`, error?.message || error);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } finally {
      await closeBrowserInstance();
    }

    if (Object.keys(diagramImages).length > 0) {
      docContent = replaceMermaidWithImages(docContent, diagramImages);
    }

    // Verify repo still exists (could have been deleted during processing)
    const currentRepo = await storage.getRepo(repoId);
    if (!currentRepo) {
      console.log(`Repo ${repoId} was deleted during processing, aborting.`);
      return;
    }

    await storage.createDocumentation({
      repoId,
      content: docContent,
      diagramImages: Object.keys(diagramImages).length > 0 ? diagramImages : undefined,
      diagramSources: Object.keys(diagramSources).length > 0 ? diagramSources : undefined,
      qualityScore,
    });

    await storage.updateRepo(repoId, { 
      status: "completed",
      lastCommitHash: latestHash
    });

    console.log(`Processing complete for ${repoId}`);

  } catch (error) {
    console.error(`Error processing repo ${repoId}:`, error);
    await storage.updateRepo(repoId, { status: "failed" });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Detect whether the user's message is requesting an edit to the documentation.
 * Uses keyword/pattern matching on the message text.
 */
function detectEditIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();

  const editPhrases = [
    "can you change", "can you update", "can you modify", "can you add",
    "can you remove", "can you edit", "can you rewrite", "can you fix",
    "please change", "please update", "please modify", "please add",
    "please remove", "please edit", "please rewrite", "please fix",
    "i want to change", "i want to update", "i want to add",
    "i want to remove", "i need to change", "i need to update",
    "make it", "make the", "should say", "should be",
    "instead of", "replace with", "change it to", "update it to",
    "add a section", "add section", "remove the section", "remove section",
    "delete the section", "delete section", "rewrite the section",
  ];

  for (const phrase of editPhrases) {
    if (lower.includes(phrase)) return true;
  }

  const editVerbs = [
    "change", "update", "modify", "add", "remove", "edit", "rewrite",
    "fix", "improve", "replace", "delete", "insert", "append", "correct",
    "revise", "rephrase", "restructure", "reorganize", "rename", "move",
    "merge", "split", "expand", "shorten", "simplify", "clarify",
    "include", "exclude", "write", "create", "put", "set",
  ];

  for (const verb of editVerbs) {
    if (lower.startsWith(verb + " ")) return true;
    if (lower.includes("you " + verb + " ")) return true;
    if (lower.includes("you " + verb + "?")) return true;
  }

  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await connectDB();

  // --- Auth Routes (unprotected) ---
  app.get("/api/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

  app.get(
    "/api/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/login" }),
    (_req, res) => {
      res.redirect("/dashboard");
    }
  );

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    });
  });

  // --- API Guard: protect all /api routes except /api/auth/* ---
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    ensureAuthenticated(req, res, next);
  });

  // --- GitHub API: fetch user's public repositories ---
  app.get(api.github.repos.path, async (req, res) => {
    try {
      const userId = req.user!.id;
      const token = await storage.getGithubAccessToken(userId);

      if (!token) {
        return res.status(403).json({
          message: "GitHub access token not found. Please log out and log back in.",
        });
      }

      const allRepos: any[] = [];
      let page = 1;
      const perPage = 100;

      while (page <= 10) {
        const response = await fetch(
          `https://api.github.com/user/repos?visibility=public&sort=updated&per_page=${perPage}&page=${page}&affiliation=owner`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Repo-Doc-Generator",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            return res.status(401).json({
              message: "GitHub token expired. Please log out and log back in.",
            });
          }
          return res.status(502).json({ message: "Failed to fetch repositories from GitHub" });
        }

        const repos = await response.json();
        if (repos.length === 0) break;

        allRepos.push(
          ...repos.map((repo: any) => ({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || "",
            language: repo.language || null,
            stargazersCount: repo.stargazers_count,
            htmlUrl: repo.html_url,
            updatedAt: repo.updated_at,
            fork: repo.fork,
          }))
        );

        if (repos.length < perPage) break;
        page++;
      }

      res.json(allRepos);
    } catch (err) {
      console.error("Error fetching GitHub repos:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.repos.create.path, async (req, res) => {
    try {
      const input = api.repos.create.input.parse(req.body);
      const normalizedUrl = normalizeGitHubRepoUrl(input.url);
      const existing = await storage.findRepoByUrl(normalizedUrl);
      const repoToUse =
        existing ??
        (await storage.createRepo({
          ...input,
          url: normalizedUrl,
        }));

      const updated =
        repoToUse.status === "pending"
          ? repoToUse
          : (await storage.updateRepo(repoToUse.id, { status: "pending" })) ??
            repoToUse;

      processRepo(updated.id, updated.url).catch((err) =>
        console.error("Background process failed:", err),
      );

      res.status(201).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.repos.list.path, async (req, res) => {
    const repos = await storage.listRepos();
    res.json(repos);
  });

  app.get(api.repos.get.path, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ message: "Missing repo id" });
    const repo = await storage.getRepo(id);
    if (!repo) return res.status(404).json({ message: "Repo not found" });
    res.json(repo);
  });

  app.get(api.repos.getDoc.path, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ message: "Missing repo id" });
    const doc = await storage.getDocumentation(id);
    if (!doc) return res.status(404).json({ message: "Documentation not found" });
    res.json(doc);
  });

  app.get(api.repos.download.path, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ message: "Missing repo id" });
    const doc = await storage.getDocumentation(id);
    if (!doc) return res.status(404).json({ message: "Documentation not found" });
    const repo = await storage.getRepo(id);
    const title = repo?.url.split("/").slice(-2).join("/") || "repository";
    const buffer = await generateDocxBuffer(title, doc.content, doc.diagramImages);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-z0-9]/gi, "_")}_documentation.docx"`);
    res.send(buffer);
  });

  // DELETE /api/repos/:id
  app.delete(api.repos.delete.path, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Missing repo id" });

      const repo = await storage.getRepo(id);
      if (!repo) return res.status(404).json({ message: "Repo not found" });

      await storage.deleteDocumentation(id);

      const diagramDir = path.join(process.cwd(), "public", "diagrams", id);
      if (fs.existsSync(diagramDir)) {
        fs.rmSync(diagramDir, { recursive: true, force: true });
      }

      await storage.deleteRepo(id);

      res.json({ message: "Repository deleted successfully" });
    } catch (err) {
      console.error("Error deleting repo:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // POST /api/repos/:id/regenerate
  app.post(api.repos.regenerate.path, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Missing repo id" });

      const repo = await storage.getRepo(id);
      if (!repo) return res.status(404).json({ message: "Repo not found" });

      if (repo.status === "processing" || repo.status === "pending") {
        return res.status(409).json({ message: "Repository is already being processed" });
      }

      await storage.deleteDocumentation(id);

      const diagramDir = path.join(process.cwd(), "public", "diagrams", id);
      if (fs.existsSync(diagramDir)) {
        fs.rmSync(diagramDir, { recursive: true, force: true });
      }

      const updated = await storage.updateRepo(id, {
        status: "pending",
        lastCommitHash: undefined,
      });

      processRepo(id, repo.url).catch((err) =>
        console.error("Background regenerate failed:", err),
      );

      res.json(updated);
    } catch (err) {
      console.error("Error regenerating docs:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // PATCH /api/repos/:id
  app.patch(api.repos.updateUrl.path, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Missing repo id" });

      const input = api.repos.updateUrl.input.parse(req.body);
      const normalizedUrl = normalizeGitHubRepoUrl(input.url);

      const repo = await storage.getRepo(id);
      if (!repo) return res.status(404).json({ message: "Repo not found" });

      const existing = await storage.findRepoByUrl(normalizedUrl);
      if (existing && existing.id !== id) {
        return res.status(409).json({ message: "Another repository is already tracking this URL" });
      }

      const updated = await storage.updateRepoUrl(id, normalizedUrl);
      if (!updated) return res.status(404).json({ message: "Repo not found" });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error updating repo URL:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // POST /api/repos/:id/chat — streaming documentation chatbot (with edit support)
  app.post("/api/repos/:id/chat", async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Missing repo id" });

      const { message, history } = req.body as {
        message: string;
        history?: Array<{ role: string; content: string }>;
      };
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }

      const doc = await storage.getDocumentation(id);
      if (!doc) {
        return res.status(404).json({ message: "Documentation not found for this repository" });
      }

      const isEditRequest = detectEditIntent(message.trim());

      // Reconstruct documentation with Mermaid source blocks for AI context
      const existingDiagramSources: Record<string, string> = doc.diagramSources || {};
      const docWithMermaidSource = Object.keys(existingDiagramSources).length > 0
        ? replaceImagesWithMermaid(doc.content, existingDiagramSources)
        : doc.content;

      const docContext = isEditRequest
        ? docWithMermaidSource
        : (docWithMermaidSource.length > 12000
            ? docWithMermaidSource.substring(0, 12000) + "\n\n[Documentation truncated...]"
            : docWithMermaidSource);

      const systemPrompt = isEditRequest
        ? `You are a helpful documentation assistant for a software project. The user wants to modify the project documentation. Briefly acknowledge what changes you will make (1-3 sentences). Do NOT output the full updated documentation - just describe the changes you are about to apply.

--- BEGIN CURRENT DOCUMENTATION ---
${docContext}
--- END CURRENT DOCUMENTATION ---`
        : `You are a helpful documentation assistant for a software project. Your role is to answer questions about this project based ONLY on the documentation provided below. If the answer is not in the documentation, say so honestly.

Be concise, accurate, and helpful. Use markdown formatting in your responses when appropriate (code blocks, lists, bold text). Reference specific sections of the documentation when relevant.

--- BEGIN DOCUMENTATION ---
${docContext}
--- END DOCUMENTATION ---`;

      const messages: ChatStreamMessage[] = [{ role: "system", content: systemPrompt }];

      if (Array.isArray(history)) {
        const recentHistory = history.slice(-20);
        for (const msg of recentHistory) {
          if (
            (msg.role === "user" || msg.role === "assistant") &&
            typeof msg.content === "string"
          ) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      messages.push({ role: "user", content: message.trim() });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      try {
        // Phase 1: Stream the conversational response
        for await (const chunk of streamChatResponse(messages)) {
          const data = JSON.stringify({ content: chunk });
          res.write(`data: ${data}\n\n`);
        }

        // Phase 2: If edit request, apply the documentation update (with diagram re-rendering)
        if (isEditRequest) {
          try {
            res.write(`data: ${JSON.stringify({ edit_status: "applying" })}\n\n`);

            const editMessages = [
              {
                role: "system" as const,
                content: `You are a documentation editor. You will be given the current documentation and an edit instruction. Apply the requested changes and return the COMPLETE updated documentation in markdown format. Return ONLY the updated documentation with no preamble, no explanation, and no wrapping markers. Just the raw updated markdown content.

IMPORTANT: The documentation may contain Mermaid diagram code blocks (wrapped in \`\`\`mermaid markers). If the user asks to modify a diagram, update the Mermaid code directly inside the code block. Preserve all \`\`\`mermaid markers exactly. Do not convert Mermaid blocks to image references or any other format.`,
              },
              {
                role: "user" as const,
                content: `Here is the current documentation:\n\n${docWithMermaidSource}\n\n---\n\nApply this edit instruction: ${message.trim()}\n\nReturn the complete updated documentation:`,
              },
            ];

            const editResult = await providerManager.call("writer", editMessages, {
              temperature: 0.3,
              maxTokens: 16000,
            });

            let updatedContent = editResult.content.trim();

            // Strip accidental markdown fencing
            if (updatedContent.startsWith("```markdown")) {
              updatedContent = updatedContent.slice("```markdown".length);
            } else if (updatedContent.startsWith("```")) {
              updatedContent = updatedContent.slice(3);
            }
            if (updatedContent.endsWith("```")) {
              updatedContent = updatedContent.slice(0, -3);
            }
            updatedContent = updatedContent.trim();

            // Sanity check: reject suspiciously short results
            if (updatedContent.length < 100) {
              console.error("Edit result too short, skipping update:", updatedContent.length, "chars");
              res.write(`data: ${JSON.stringify({ error: "The AI produced an unexpectedly short result. Edit was not applied." })}\n\n`);
            } else {
              // Extract Mermaid blocks from the writer's output
              const newMermaidBlocks = extractMermaidBlocks(updatedContent);

              // Build new sources map
              const newDiagramSources: Record<string, string> = {};
              for (const block of newMermaidBlocks) {
                newDiagramSources[block.name] = block.code;
              }

              // Identify which diagrams changed by comparing source code
              const changedDiagrams: Array<{ name: string; code: string }> = [];
              const unchangedDiagramNames: string[] = [];

              for (const block of newMermaidBlocks) {
                if (existingDiagramSources[block.name] === block.code) {
                  unchangedDiagramNames.push(block.name);
                } else {
                  changedDiagrams.push(block);
                }
              }

              // Start from existing images for unchanged diagrams
              const newDiagramImages: Record<string, string> = {};
              const existingImages: Record<string, string> = doc.diagramImages || {};

              for (const name of unchangedDiagramNames) {
                if (existingImages[name]) {
                  newDiagramImages[name] = existingImages[name];
                }
              }

              // Re-render only changed or new diagrams
              if (changedDiagrams.length > 0) {
                console.log(`Re-rendering ${changedDiagrams.length} changed diagram(s)...`);
                res.write(`data: ${JSON.stringify({ edit_status: "rendering_diagrams" })}\n\n`);

                try {
                  for (const block of changedDiagrams) {
                    try {
                      const imagePath = await renderMermaidToImage(block.code, block.name, id);
                      newDiagramImages[block.name] = imagePath;
                      console.log(`Re-rendered diagram ${block.name} -> ${imagePath}`);
                    } catch (renderErr: any) {
                      console.error(`Failed to render diagram ${block.name}:`, renderErr?.message || renderErr);
                      // Fall back to old image if it exists
                      if (existingImages[block.name]) {
                        newDiagramImages[block.name] = existingImages[block.name];
                      }
                    }
                  }
                } finally {
                  await closeBrowserInstance();
                }
              }

              // Replace Mermaid blocks with image references
              if (Object.keys(newDiagramImages).length > 0) {
                updatedContent = replaceMermaidWithImages(updatedContent, newDiagramImages);
              }

              // Save updated content + diagram images + diagram sources
              const updatedDoc = await storage.updateDocumentation(id, updatedContent, {
                diagramImages: newDiagramImages,
                diagramSources: newDiagramSources,
              });

              if (updatedDoc) {
                res.write(`data: ${JSON.stringify({ doc_updated: true })}\n\n`);
                console.log(
                  `Documentation updated for repo ${id} via chat edit ` +
                  `(${updatedContent.length} chars, ${changedDiagrams.length} diagram(s) re-rendered)`
                );
              } else {
                res.write(`data: ${JSON.stringify({ error: "Failed to save documentation update." })}\n\n`);
              }
            }
          } catch (editError: any) {
            console.error("Documentation edit error:", editError);
            res.write(`data: ${JSON.stringify({ error: "Failed to apply documentation edit. Please try again." })}\n\n`);
          }
        }

        res.write("data: [DONE]\n\n");
        res.end();
      } catch (streamError: any) {
        console.error("Chat stream error:", streamError);
        const errorData = JSON.stringify({ error: "Stream interrupted. Please try again." });
        res.write(`data: ${errorData}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (err) {
      console.error("Chat endpoint error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal Server Error" });
      } else {
        res.end();
      }
    }
  });

  return httpServer;
}
