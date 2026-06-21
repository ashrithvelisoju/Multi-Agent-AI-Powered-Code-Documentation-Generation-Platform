import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRepoSchema, CreateRepoInput } from "@shared/schema";
import { useCreateRepo, useRepos } from "@/hooks/use-repos";
import { Layout } from "@/components/Layout";
import { RepoCard } from "@/components/RepoCard";
import { RepoPickerCombobox } from "@/components/RepoPickerCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ArrowRight, Github } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { data: repos, isLoading } = useRepos();
  const createRepo = useCreateRepo();
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<CreateRepoInput>({
    resolver: zodResolver(createRepoSchema),
    defaultValues: { url: "" },
  });

  const onSubmit = (data: CreateRepoInput) => {
    createRepo.mutate(data, {
      onSuccess: () => form.reset(),
    });
  };

  const filteredRepos = repos?.filter(repo => 
    repo.url.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Layout>
      <div className="space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-6 pt-8 pb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Documentation Generator</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-foreground">
            Turn Code into <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Beautiful Documentation
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Instant, comprehensive documentation for any public GitHub repository.
            Architecture, APIs, and Usage guides generated in minutes using AI.
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl mx-auto relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-accent/50 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative flex gap-2 bg-card p-2 rounded-2xl shadow-xl border border-border">
              <RepoPickerCombobox
                value={form.watch("url")}
                onSelect={(url) => {
                  form.setValue("url", url, { shouldValidate: true });
                }}
                disabled={createRepo.isPending}
              />
              <Button 
                type="submit" 
                size="lg" 
                className="h-14 px-8 rounded-xl font-semibold text-lg bg-primary hover:bg-primary/90 transition-all"
                disabled={createRepo.isPending}
              >
                {createRepo.isPending ? (
                  <span className="flex items-center gap-2">
                    Scanning...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Generate <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
            {form.formState.errors.url && (
              <p className="text-red-500 text-sm mt-2 text-left px-2">
                {form.formState.errors.url.message}
              </p>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold font-display">Recent Repositories</h2>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search repositories..." 
                className="pl-10 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredRepos.map((repo) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RepoCard repo={repo} />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {filteredRepos.length === 0 && (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-2xl">
                  <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Github className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No repositories found</h3>
                  <p className="text-muted-foreground mt-1">
                    {searchQuery ? "Try adjusting your search terms" : "Submit your first repository above"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
