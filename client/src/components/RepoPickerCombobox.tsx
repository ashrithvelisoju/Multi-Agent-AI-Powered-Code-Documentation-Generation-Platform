import { useState } from "react";
import { useGithubRepos } from "@/hooks/use-github-repos";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, ChevronsUpDown, Check, AlertCircle, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepoPickerComboboxProps {
  value: string;
  onSelect: (url: string) => void;
  disabled?: boolean;
}

export function RepoPickerCombobox({ value, onSelect, disabled }: RepoPickerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [mode, setMode] = useState<"picker" | "manual">("picker");
  const { data: repos, isLoading, error } = useGithubRepos();

  const selectedRepo = repos?.find((r) => r.htmlUrl === value);
  const displayText = selectedRepo
    ? selectedRepo.fullName
    : value
      ? value.replace("https://github.com/", "")
      : "";

  const handleManualSubmit = () => {
    const url = manualUrl.trim();
    if (url) {
      onSelect(url);
      setManualUrl("");
      setOpen(false);
      setMode("picker");
    }
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setMode("picker");
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-14 w-full items-center justify-between rounded-none border-0",
            "bg-transparent pl-4 pr-3 text-lg text-left",
            "focus-visible:outline-none focus-visible:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !displayText && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {displayText || "Select a repository..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        {mode === "picker" ? (
          <Command shouldFilter={true}>
            <CommandInput placeholder="Search repositories..." />
            <CommandList className="max-h-[300px]">
              {isLoading && (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-4 text-center text-sm text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <p>{error.message}</p>
                  <p className="text-xs text-muted-foreground">
                    Try logging out and back in
                  </p>
                </div>
              )}

              {!isLoading && !error && (
                <>
                  <CommandEmpty>No repositories found.</CommandEmpty>
                  <CommandGroup>
                    {repos?.map((repo) => (
                      <CommandItem
                        key={repo.fullName}
                        value={repo.fullName}
                        onSelect={() => {
                          onSelect(repo.htmlUrl);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 py-3 px-3"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            value === repo.htmlUrl ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {repo.name}
                            </span>
                            {repo.fork && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                fork
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {repo.stargazersCount}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Link className="h-4 w-4" />
                Paste a GitHub URL instead
              </button>
            </div>
          </Command>
        ) : (
          <div className="p-3 space-y-3">
            <p className="text-sm font-medium">Paste a GitHub repository URL</p>
            <Input
              autoFocus
              placeholder="https://github.com/username/repo"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setMode("picker"); setManualUrl(""); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to repo list
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualUrl.trim()}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use this URL
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
