import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Github,
  FileText,
  Sparkles,
  ArrowRight,
  Download,
  GitBranch,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Analysis",
    description:
      "Our AI agents analyze your codebase, map dependencies, and generate comprehensive documentation automatically.",
  },
  {
    icon: GitBranch,
    title: "Architecture Diagrams",
    description:
      "Automatically generates Mermaid diagrams to visualize your project's architecture and code relationships.",
  },
  {
    icon: Download,
    title: "DOCX Export",
    description:
      "Download your documentation as professionally formatted DOCX files, ready to share with your team.",
  },
  {
    icon: Github,
    title: "GitHub Integration",
    description:
      "Simply paste a GitHub repository URL and let the system handle the rest. Public repos supported out of the box.",
  },
];

export default function Landing() {
  const { data: user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Code-to-Documentation AI
            </span>
          </div>

          <div>
            {!isLoading && user ? (
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <a href="/api/auth/github">
                <Button variant="outline" className="gap-2">
                  <Github className="w-4 h-4" />
                  Sign In
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Documentation Generator
          </span>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl font-display font-bold leading-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Turn Code into{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            Beautiful Documentation
          </span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Paste a GitHub repository URL and let AI analyze your codebase,
          generate comprehensive documentation, and create architecture diagrams
          — all in minutes.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {!isLoading && user ? (
            <Link href="/dashboard">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-base px-8">
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          ) : (
            <a href="/api/auth/github">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-base px-8">
                <Github className="w-5 h-5" />
                Get Started with GitHub
              </Button>
            </a>
          )}
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From repository URL to polished documentation in just a few clicks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-display font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border-primary/20">
            <CardContent className="py-14 px-8 text-center">
              <FileText className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
                Ready to Document Your Code?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Join developers who use AI to generate documentation in minutes,
                not hours. Sign in with GitHub to get started.
              </p>
              {!isLoading && user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 px-8">
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <a href="/api/auth/github">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 px-8">
                    <Github className="w-5 h-5" />
                    Get Started with GitHub
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Code-to-Documentation AI System. Built
            with React & Node.
          </p>
        </div>
      </footer>
    </div>
  );
}
