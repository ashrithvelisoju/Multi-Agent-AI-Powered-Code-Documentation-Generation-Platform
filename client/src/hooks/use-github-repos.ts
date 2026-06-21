import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { GitHubRepo } from "@shared/schema";

// GET /api/github/repos
export function useGithubRepos() {
  return useQuery<GitHubRepo[]>({
    queryKey: [api.github.repos.path],
    queryFn: async () => {
      const res = await fetch(api.github.repos.path, { credentials: "include" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch repos" }));
        throw new Error(error.message || "Failed to fetch GitHub repositories");
      }
      return api.github.repos.responses[200].parse(await res.json());
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}
