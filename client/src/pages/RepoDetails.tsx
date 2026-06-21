import { useRoute, Link, useLocation } from "wouter";
import { useRepo, useRepoDoc, useDeleteRepo, useRegenerateRepo, useUpdateRepoUrl } from "@/hooks/use-repos";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildUrl, api } from "@shared/routes";
import { ArrowLeft, Download, FileText, ExternalLink, Github, RefreshCw, Trash2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DocChat } from "@/components/DocChat";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

let mermaidCounter = 0;

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const idRef = useRef(`mermaid-${++mermaidCounter}`);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const { svg: rendered } = await mermaid.render(idRef.current, code.trim());
        if (!cancelled) setSvg(rendered);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to render diagram");
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <p className="font-medium mb-1">Diagram render error</p>
        <pre className="whitespace-pre-wrap text-xs">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 p-8 bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center overflow-x-auto bg-white rounded-xl border border-border/50 p-4 shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function RepoDetails() {
  const [match, params] = useRoute("/repo/:id");
  const id = params?.id || "";
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { data: repo, isLoading: isLoadingRepo } = useRepo(id);
  const { data: doc, isLoading: isLoadingDoc } = useRepoDoc(id, repo?.status);

  const deleteRepo = useDeleteRepo();
  const regenerateRepo = useRegenerateRepo();
  const updateRepoUrl = useUpdateRepoUrl();

  const [editUrlOpen, setEditUrlOpen] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState("");

  const handleDocUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [api.repos.getDoc.path, id] });
  }, [queryClient, id]);

  useEffect(() => {
    if (repo?.status === "completed" && id) {
      queryClient.invalidateQueries({ queryKey: [api.repos.getDoc.path, id] });
    }
  }, [id, queryClient, repo?.status]);

  if (!match || !id) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Repository Not Found</h2>
          <Link href="/dashboard">
            <Button>Go Back Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (isLoadingRepo) {
    return (
      <Layout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 bg-muted rounded-lg" />
          <div className="h-96 w-full bg-muted rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!repo) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Repository Not Found</h2>
          <Link href="/dashboard">
            <Button>Go Back Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isProcessing = repo.status === "pending" || repo.status === "processing";
  const downloadUrl = buildUrl(api.repos.download.path, { id });

  const handleDelete = () => {
    deleteRepo.mutate(id, {
      onSuccess: () => setLocation("/dashboard"),
    });
  };

  const handleRegenerate = () => {
    regenerateRepo.mutate(id);
  };

  const handleEditUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUrlValue.trim()) return;
    updateRepoUrl.mutate(
      { id, data: { url: editUrlValue.trim() } },
      { onSuccess: () => setEditUrlOpen(false) },
    );
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  {repo.url.split('/').slice(-2).join('/')}
                </h1>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open repository on GitHub"
                  title="Open repository on GitHub"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>

                {/* Edit URL Dialog */}
                <Dialog open={editUrlOpen} onOpenChange={setEditUrlOpen}>
                  <DialogTrigger asChild>
                    <button
                      onClick={() => setEditUrlValue(repo.url)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit repository URL"
                      title="Edit repository URL"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleEditUrl}>
                      <DialogHeader>
                        <DialogTitle>Edit Repository URL</DialogTitle>
                        <DialogDescription>
                          Update the GitHub repository URL. This will not regenerate documentation automatically.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="edit-url">Repository URL</Label>
                        <Input
                          id="edit-url"
                          type="url"
                          value={editUrlValue}
                          onChange={(e) => setEditUrlValue(e.target.value)}
                          placeholder="https://github.com/owner/repo"
                          className="mt-2"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditUrlOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateRepoUrl.isPending || !editUrlValue.trim()}
                        >
                          {updateRepoUrl.isPending ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Github className="w-4 h-4" /> GitHub Repository
                </span>
                <span>•</span>
                <span>Submitted {format(new Date(repo.createdAt), "PPP")}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={repo.status} className="px-4 py-2" />

              {/* Regenerate button */}
              {(repo.status === "completed" || repo.status === "failed") && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleRegenerate}
                  disabled={regenerateRepo.isPending}
                >
                  <RefreshCw className={`w-4 h-4 ${regenerateRepo.isPending ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              )}

              {repo.status === 'completed' && (
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40">
                    <Download className="w-4 h-4" /> Download DOCX
                  </Button>
                </a>
              )}

              {/* Delete button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Repository?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this repository and all its generated documentation. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={handleDelete}
                      disabled={deleteRepo.isPending}
                    >
                      {deleteRepo.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div className="grid gap-8">
          {isProcessing ? (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-xl font-bold mb-2">Generating Documentation...</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Our AI agents are analyzing your codebase, mapping dependencies, and writing documentation. This usually takes 1-3 minutes.
              </p>
            </Card>
          ) : repo.status === 'failed' ? (
            <Card className="p-12 text-center border-red-200 bg-red-50">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-red-900 mb-2">Analysis Failed</h3>
              <p className="text-red-700 max-w-md mx-auto mb-6">
                We encountered an issue while analyzing this repository. Please ensure the repository is public and accessible.
              </p>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerateRepo.isPending}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${regenerateRepo.isPending ? "animate-spin" : ""}`} />
                Try Again
              </Button>
            </Card>
          ) : doc ? (
            <div className="bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden">
              <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="w-5 h-5 text-primary" />
                  Documentation Preview
                </div>
                {doc.qualityScore != null && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${
                      doc.qualityScore >= 7
                        ? "bg-green-500/10 text-green-700 border-green-200"
                        : doc.qualityScore >= 5
                          ? "bg-yellow-500/10 text-yellow-700 border-yellow-200"
                          : "bg-red-500/10 text-red-700 border-red-200"
                    }`}
                    title={`Documentation quality score: ${doc.qualityScore} out of 10, as rated by the AI verifier agent`}
                  >
                    Quality: {doc.qualityScore}/10
                  </div>
                )}
              </div>
              <div className="p-8 md:p-12 prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ node, ...props }) => {
                      let src = props.src || "";
                      if (src.startsWith("/")) {
                        const baseUrl = window.location.origin;
                        src = `${baseUrl}${src}`;
                      }
                      return (
                        <img
                          {...props}
                          src={src}
                          className="max-w-full h-auto rounded-lg shadow-md my-4 border border-border/50"
                          alt={props.alt || "Diagram"}
                          loading="lazy"
                        />
                      );
                    },
                    pre: ({ children }) => {
                      return <div>{children}</div>;
                    },
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || "");
                      const lang = match ? match[1] : "";
                      const codeString = String(children).replace(/\n$/, "");

                      if (lang === "mermaid") {
                        return <MermaidBlock code={codeString} />;
                      }

                      // Block-level code (has a language class)
                      if (lang) {
                        return (
                          <pre className="bg-slate-900 text-slate-50 rounded-xl p-4 overflow-x-auto my-4">
                            <code className={`text-sm leading-relaxed ${className}`} {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      }

                      // Inline code
                      return (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {doc.content}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No documentation found.</p>
            </Card>
          )}
        </div>
      </div>

      {repo.status === "completed" && doc && (
        <DocChat repoId={id} docContent={doc.content} onDocUpdated={handleDocUpdated} />
      )}
    </Layout>
  );
}
