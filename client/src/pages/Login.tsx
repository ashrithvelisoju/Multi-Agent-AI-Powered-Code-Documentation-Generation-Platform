import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Github, BookOpen } from "lucide-react";

export default function Login() {
  const { data: user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handleLogin = () => {
    window.location.href = "/api/auth/github";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Code-to-Documentation AI
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to generate AI-powered documentation for your GitHub repositories.
            </p>
          </div>
          <Button onClick={handleLogin} size="lg" className="w-full gap-2">
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
