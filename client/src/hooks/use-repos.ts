import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { CreateRepoInput, UpdateRepoUrlInput } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/repos
export function useRepos() {
  return useQuery({
    queryKey: [api.repos.list.path],
    queryFn: async () => {
      const res = await fetch(api.repos.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch repositories");
      return api.repos.list.responses[200].parse(await res.json());
    },
    // Poll every 5 seconds to update status
    refetchInterval: 5000,
  });
}

// GET /api/repos/:id
export function useRepo(id: string) {
  return useQuery({
    queryKey: [api.repos.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.repos.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch repository");
      return api.repos.get.responses[200].parse(await res.json());
    },
    // Poll aggressively if processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

// GET /api/repos/:id/doc
export function useRepoDoc(id: string, repoStatus?: string) {
  return useQuery({
    queryKey: [api.repos.getDoc.path, id],
    queryFn: async () => {
      const url = buildUrl(api.repos.getDoc.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch documentation");
      return api.repos.getDoc.responses[200].parse(await res.json());
    },
    enabled: !!id && repoStatus === "completed",
    refetchOnMount: "always",
  });
}

// POST /api/repos
export function useCreateRepo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRepoInput) => {
      const res = await fetch(api.repos.create.path, {
        method: api.repos.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Invalid repository URL");
        }
        throw new Error("Failed to submit repository");
      }
      return api.repos.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.repos.list.path] });
      toast({
        title: "Repository Submitted",
        description: "AI analysis has started. This may take a few minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// DELETE /api/repos/:id
export function useDeleteRepo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.repos.delete.path, { id });
      const res = await fetch(url, { method: api.repos.delete.method, credentials: "include" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete repository");
      }
      return api.repos.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.repos.list.path] });
      toast({
        title: "Repository Deleted",
        description: "The repository and its documentation have been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// POST /api/repos/:id/regenerate
export function useRegenerateRepo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.repos.regenerate.path, { id });
      const res = await fetch(url, { method: api.repos.regenerate.method, credentials: "include" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to regenerate documentation");
      }
      return api.repos.regenerate.responses[200].parse(await res.json());
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.repos.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.repos.get.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.repos.getDoc.path, id] });
      toast({
        title: "Regenerating Documentation",
        description: "AI analysis has restarted. This may take a few minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// PATCH /api/repos/:id
export function useUpdateRepoUrl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRepoUrlInput }) => {
      const url = buildUrl(api.repos.updateUrl.path, { id });
      const res = await fetch(url, {
        method: api.repos.updateUrl.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update repository URL");
      }
      return api.repos.updateUrl.responses[200].parse(await res.json());
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.repos.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.repos.get.path, id] });
      toast({
        title: "URL Updated",
        description: "The repository URL has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
