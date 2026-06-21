import { z } from "zod";

// Domain Types
export const repoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  lastCommitHash: z.string().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  // API returns ISO date strings; coerce to Date on the client
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  documentationId: z.string().optional(),
});

export const documentationSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  content: z.string(), // Markdown/Text content
  docxUrl: z.string().optional(),
  diagramImages: z.record(z.string()).optional(), // Map of diagram name to image URL/path
  diagramSources: z.record(z.string()).optional(), // Map of diagram name to Mermaid source code
  qualityScore: z.number().min(1).max(10).optional(),
  createdAt: z.coerce.date(),
});

// API Schemas
export const createRepoSchema = z.object({
  url: z.string().url("Please enter a valid GitHub repository URL"),
});

export const updateRepoSchema = z.object({
  lastCommitHash: z.string().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  documentationId: z.string().optional(),
});

export const updateRepoUrlSchema = z.object({
  url: z.string().url("Please enter a valid GitHub repository URL"),
});

// Types for frontend
export type Repo = z.infer<typeof repoSchema>;
export type Documentation = z.infer<typeof documentationSchema>;
export type CreateRepoInput = z.infer<typeof createRepoSchema>;
export type UpdateRepoInput = z.infer<typeof updateRepoSchema>;
export type UpdateRepoUrlInput = z.infer<typeof updateRepoUrlSchema>;

// User (GitHub OAuth)
export const userSchema = z.object({
  id: z.string(),
  githubId: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  profileUrl: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

// GitHub Repository (from GitHub API)
export const githubRepoSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  description: z.string(),
  language: z.string().nullable(),
  stargazersCount: z.number(),
  htmlUrl: z.string().url(),
  updatedAt: z.string(),
  fork: z.boolean(),
});

export type GitHubRepo = z.infer<typeof githubRepoSchema>;
