import { Link } from "wouter";
import { Repo } from "@shared/schema";
import { format } from "date-fns";
import { Github, Clock, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useDeleteRepo } from "@/hooks/use-repos";
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

interface RepoCardProps {
  repo: Repo;
}

const statusConfig = {
  pending: {
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock,
    label: "Queued",
    spin: false,
  },
  processing: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Loader2,
    label: "Analyzing...",
    spin: true,
  },
  completed: {
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
    label: "Ready",
    spin: false,
  },
  failed: {
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertCircle,
    label: "Failed",
    spin: false,
  },
};

export function RepoCard({ repo }: RepoCardProps) {
  const config = statusConfig[repo.status];
  const Icon = config.icon;
  const deleteRepo = useDeleteRepo();

  return (
    <Link href={`/repo/${repo.id}`} className="block group">
      <div className="
        relative h-full p-6 rounded-2xl bg-card border border-border/50
        shadow-sm hover:shadow-xl hover:border-primary/20
        transition-all duration-300 transform hover:-translate-y-1
      ">
        {/* Delete button - top right, visible on hover */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all duration-200 z-10"
              aria-label="Delete repository"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
                onClick={() => {
                  deleteRepo.mutate(repo.id);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            <Github className="w-6 h-6" />
          </div>
          <div className={clsx(
            "px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
            config.color
          )}>
            <Icon className={clsx("w-3.5 h-3.5", config.spin && "animate-spin")} />
            {config.label}
          </div>
        </div>

        <h3 className="font-display font-bold text-lg mb-2 text-foreground truncate" title={repo.url}>
          {repo.url.replace('https://github.com/', '')}
        </h3>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(repo.createdAt), "MMM d, yyyy")}</span>
          </div>
          {repo.status === 'completed' && (
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <FileText className="w-4 h-4" />
              <span>View Docs</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
