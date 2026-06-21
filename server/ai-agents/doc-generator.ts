import { runPipeline } from "./orchestrator.js";
import type { ProjectMetadata } from "./types/project-metadata.js";
export type { OrchestratorResult, PipelineInput } from "./orchestrator.js";

/**
 * Main entry point for the multi-agent documentation pipeline.
 * Runs: Reader → Searcher → Writer ⇄ Verifier → Diagram Agent
 */
export async function runDocumentationPipeline(
  tempDir: string,
  filesToAnalyze: string[],
  existingDocContent?: string,
  projectMetadata?: ProjectMetadata
): Promise<{ documentation: string; verificationScore: number }> {
  const result = await runPipeline({
    tempDir,
    filesToAnalyze,
    existingDocContent,
    projectMetadata,
  });

  return { documentation: result.documentation, verificationScore: result.verificationScore };
}
