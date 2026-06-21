# Appendix: Source Code

## A1. Server Entry (`server/index.ts`)

```typescript
import express from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  setupAuth(app);
  await registerRoutes(app);
  
  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log(`Server on port ${port}`));
})();
```

---

## A2. Database Connection (`server/db.ts`)

```typescript
import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
```

---

## A3. MongoDB Schemas (`server/storage.ts`)

```typescript
import mongoose from "mongoose";

const RepoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  lastCommitHash: { type: String },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"] },
  documentationId: { type: String },
}, { timestamps: true });

const DocumentationSchema = new mongoose.Schema({
  repoId: { type: String, required: true },
  content: { type: String, required: true },
  diagramImages: { type: Map, of: String },
  qualityScore: { type: Number },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  githubId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String },
  avatarUrl: { type: String },
}, { timestamps: true });

export const RepoModel = mongoose.model("Repo", RepoSchema);
export const DocumentationModel = mongoose.model("Documentation", DocumentationSchema);
export const UserModel = mongoose.model("User", UserSchema);

export class MongoStorage {
  async createRepo(repo: any) { return RepoModel.create(repo); }
  async getRepo(id: string) { return RepoModel.findById(id); }
  async listRepos() { return RepoModel.find().sort({ createdAt: -1 }); }
  async updateRepo(id: string, updates: any) { return RepoModel.findByIdAndUpdate(id, updates); }
}

export const storage = new MongoStorage();
```

---

## A4. Authentication (`server/auth.ts`)

```typescript
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import session from "express-session";
import { storage } from "./storage";

export function setupAuth(app: Express) {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production" },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: `http://localhost:5001/api/auth/github/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    const user = await storage.upsertUserByGithubId({
      githubId: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user);
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.findUserById(id);
    done(null, user);
  });
}
```

---

## A5. Zod Schemas (`shared/schema.ts`)

```typescript
import { z } from "zod";

export const repoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  createdAt: z.coerce.date(),
});

export const documentationSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  content: z.string(),
  qualityScore: z.number().min(1).max(10).optional(),
});

export const createRepoSchema = z.object({
  url: z.string().url("Invalid GitHub URL"),
});

export type Repo = z.infer<typeof repoSchema>;
export type Documentation = z.infer<typeof documentationSchema>;
export type CreateRepoInput = z.infer<typeof createRepoSchema>;
```

---

## A6. Provider Manager (`server/ai-agents/providers/provider-manager.ts`)

```typescript
import { groqProvider } from "./groq-provider";
import { openrouterProvider } from "./openrouter-provider";
import { bytezProvider } from "./bytez-provider";

const AGENT_CONFIGS = {
  reader: { primary: "groq/openai/gpt-oss-120b", backup: "bytez/openai/gpt-oss-20b" },
  searcher: { primary: "openrouter/qwen/qwen3-32b", backup: "bytez/Qwen3-4B" },
  writer: { primary: "groq/llama-3.3-70b-versatile", backup: "bytez/Meta-Llama-3-8B" },
  verifier: { primary: "groq/llama3.1-8b-instant", backup: "bytez/Qwen3-4B-Thinking" },
  diagram: { primary: "openrouter/qwen/qwen3-4b", backup: "bytez/Qwen2-VL-2B" },
};

export const providerManager = {
  async call(agentName: string, messages: any, overrides?: any) {
    const config = AGENT_CONFIGS[agentName];
    
    try {
      console.log(`[${agentName}] Using ${config.primary}`);
      return await groqProvider.call(config.primary, messages, overrides);
    } catch (error) {
      console.warn(`[${agentName}] Primary failed, trying backup`);
      return await bytezProvider.call(config.backup, messages, overrides);
    }
  },
};
```

---

## A7. Reader Agent (`server/ai-agents/agents/reader-agent.ts`)

```typescript
import * as fs from "fs";
import * as path from "path";
import { providerManager } from "../providers/provider-manager";

export interface FileAnalysis {
  file: string;
  summary: string;
  functions: string[];
  classes: string[];
  dependencies: string[];
  apiEndpoints: string[];
}

const READER_PROMPT = `Analyze this code file and return JSON:
{
  "summary": "...",
  "functions": [...],
  "classes": [...],
  "dependencies": [...],
  "apiEndpoints": [...]
}`;

export async function analyzeAllFiles(tempDir: string, files: string[]) {
  const results: FileAnalysis[] = [];
  
  for (const file of files.slice(0, 10)) {
    const content = fs.readFileSync(path.join(tempDir, file), "utf-8");
    if (content.length > 10000) continue;

    const response = await providerManager.call("reader", [
      { role: "system", content: READER_PROMPT },
      { role: "user", content: `File: ${file}\n${content}` },
    ]);

    results.push(JSON.parse(response.content));
  }
  
  return results;
}
```

---

## A8. Orchestrator (`server/ai-agents/orchestrator.ts`)

```typescript
import { analyzeAllFiles } from "./agents/reader-agent";
import { findRelationships } from "./agents/searcher-agent";
import { writeDocumentation } from "./agents/writer-agent";
import { verifyDocumentation } from "./agents/verifier-agent";
import { generateDiagrams } from "./agents/diagram-agent";

const MAX_RETRIES = 2;

export async function runPipeline(input: any) {
  console.log("[orchestrator] Stage 1: Reader");
  const fileAnalyses = await analyzeAllFiles(input.tempDir, input.filesToAnalyze);

  console.log("[orchestrator] Stage 2: Searcher");
  const searcherContext = await findRelationships(fileAnalyses);

  let documentation = "";
  let verificationScore = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[orchestrator] Stage 3: Writer (${attempt + 1}/${MAX_RETRIES + 1})`);
    documentation = await writeDocumentation({ fileAnalyses, searcherContext });

    console.log(`[orchestrator] Stage 4: Verifier`);
    const verification = await verifyDocumentation(documentation, fileAnalyses);
    verificationScore = verification.score;

    if (verification.approved) {
      console.log(`[orchestrator] Approved (${verificationScore}/10)`);
      break;
    }
    if (attempt < MAX_RETRIES) {
      console.log(`[orchestrator] Rejected (${verificationScore}/10), retrying...`);
    }
  }

  console.log("[orchestrator] Stage 5: Diagrams");
  try {
    const diagrams = await generateDiagrams(documentation);
    documentation = diagrams;
  } catch (e) {
    console.warn("[orchestrator] Diagram generation failed (non-blocking)");
  }

  return { documentation, verificationScore };
}
```

---

## A9. Frontend App (`client/src/App.tsx`)

```typescript
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";
import RepoDetails from "@/pages/RepoDetails";
import Landing from "@/pages/Landing";

function ProtectedRoute({ component: Component }: any) {
  const { data: user, isLoading } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Redirect to="/" />;
  
  return <Component />;
}

export default function App() {
  return (
    <QueryClientProvider>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Home} />} />
        <Route path="/repo/:id" component={() => <ProtectedRoute component={RepoDetails} />} />
      </Switch>
    </QueryClientProvider>
  );
}
```

---

## A10. React Query Hooks (`client/src/hooks/use-repos.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRepos() {
  return useQuery({
    queryKey: ["repos"],
    queryFn: async () => {
      const res = await fetch("/api/repos", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateRepo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/repos", {
        method: "POST",
        body: JSON.stringify({ url }),
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useRepoDoc(id: string) {
  return useQuery({
    queryKey: ["docs", id],
    queryFn: async () => {
      const res = await fetch(`/api/repos/${id}/doc`, { credentials: "include" });
      return res.json();
    },
  });
}
```

---

## A11. Dashboard (`client/src/pages/Home.tsx`)

```typescript
import { useRepos, useCreateRepo } from "@/hooks/use-repos";
import { RepoCard } from "@/components/RepoCard";

export default function Home() {
  const { data: repos } = useRepos();
  const createRepo = useCreateRepo();

  return (
    <div className="space-y-8 p-8">
      <form onSubmit={(e) => {
        e.preventDefault();
        const url = new FormData(e.currentTarget).get("url") as string;
        createRepo.mutate(url);
      }}>
        <input name="url" placeholder="GitHub URL..." required />
        <button type="submit" disabled={createRepo.isPending}>
          {createRepo.isPending ? "Analyzing..." : "Generate"}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-6">
        {repos?.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>
    </div>
  );
}
```

---

## A12. Environment Variables (`.env`)

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/docagent
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
BYTEZ_API_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback
SESSION_SECRET=your-secret-key
```

---

## A13. package.json (Key Dependencies)

```json
{
  "dependencies": {
    "express": "^5.0.1",
    "mongoose": "^9.1.5",
    "passport": "^0.7.0",
    "passport-github2": "^0.1.12",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.60.5",
    "groq-sdk": "^0.37.0",
    "openai": "^6.16.0",
    "bytez.js": "^3.0.0",
    "puppeteer": "^24.36.1",
    "docx": "^9.5.1",
    "mermaid": "^11.12.3",
    "tailwindcss": "^3.4.17",
    "zod": "^3.25.76",
    "typescript": "5.6.3"
  }
}
```

---

## A14. tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "target": "ES2020",
    "jsx": "preserve",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    }
  }
}
```
