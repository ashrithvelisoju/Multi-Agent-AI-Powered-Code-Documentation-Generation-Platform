import { z } from "zod";
import { createRepoSchema, repoSchema, documentationSchema, updateRepoUrlSchema, githubRepoSchema } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  github: {
    repos: {
      method: "GET" as const,
      path: "/api/github/repos",
      responses: {
        200: z.array(githubRepoSchema),
      },
    },
  },
  repos: {
    list: {
      method: "GET" as const,
      path: "/api/repos",
      responses: {
        200: z.array(repoSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/repos",
      input: createRepoSchema,
      responses: {
        201: repoSchema,
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/repos/:id",
      responses: {
        200: repoSchema,
        404: errorSchemas.notFound,
      },
    },
    getDoc: {
      method: "GET" as const,
      path: "/api/repos/:id/doc",
      responses: {
        200: documentationSchema,
        404: errorSchemas.notFound,
      },
    },
    download: {
      method: "GET" as const,
      path: "/api/repos/:id/download",
      responses: {
        200: z.any(), // Blob/File
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/repos/:id",
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    regenerate: {
      method: "POST" as const,
      path: "/api/repos/:id/regenerate",
      responses: {
        200: repoSchema,
        404: errorSchemas.notFound,
      },
    },
    updateUrl: {
      method: "PATCH" as const,
      path: "/api/repos/:id",
      input: updateRepoUrlSchema,
      responses: {
        200: repoSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        409: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
