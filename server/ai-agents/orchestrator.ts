import { analyzeAllFiles, type FileAnalysis } from "./agents/reader-agent.js";
import { findRelationships, type SearcherContext } from "./agents/searcher-agent.js";
import { writeDocumentation } from "./agents/writer-agent.js";
import { verifyDocumentation } from "./agents/verifier-agent.js";
import { generateDiagrams, mergeDiagrams } from "./agents/diagram-agent.js";
import type { ProjectMetadata } from "./types/project-metadata.js";

export interface PipelineInput {
  tempDir: string;
  filesToAnalyze: string[];
  existingDocContent?: string;
  projectMetadata?: ProjectMetadata;
}

export interface OrchestratorResult {
  documentation: string;
  fileAnalyses: FileAnalysis[];
  searcherContext: SearcherContext;
  verificationScore: number;
  diagramsGenerated: boolean;
}

const MAX_WRITER_RETRIES = 2;

export async function runPipeline(input: PipelineInput): Promise<OrchestratorResult> {
  // Stage 1: Reader
  console.log("[orchestrator] Stage 1: Reader - analyzing files...");
  const fileAnalyses = await analyzeAllFiles(input.tempDir, input.filesToAnalyze);
  console.log(`[orchestrator] Reader complete: ${fileAnalyses.length} files analyzed`);

  // Stage 2: Searcher
  console.log("[orchestrator] Stage 2: Searcher - finding relationships...");
  const searcherContext = await findRelationships(fileAnalyses);
  console.log("[orchestrator] Searcher complete");

  // Stage 3 & 4: Writer-Verifier loop
  let documentation = "";
  let verificationScore = 0;
  let verifierFeedback: string | undefined;

  for (let attempt = 0; attempt <= MAX_WRITER_RETRIES; attempt++) {
    console.log(`[orchestrator] Stage 3: Writer (attempt ${attempt + 1}/${MAX_WRITER_RETRIES + 1})...`);

    documentation = await writeDocumentation({
      fileAnalyses,
      searcherContext,
      projectMetadata: input.projectMetadata,
      existingDoc: input.existingDocContent,
      verifierFeedback,
    });

    console.log(`[orchestrator] Stage 4: Verifier (attempt ${attempt + 1})...`);
    const verification = await verifyDocumentation(documentation, fileAnalyses);
    verificationScore = verification.score;

    if (verification.approved) {
      console.log(`[orchestrator] Verifier approved (score: ${verification.score}/10)`);
      break;
    }

    if (attempt < MAX_WRITER_RETRIES) {
      console.log(`[orchestrator] Verifier rejected (score: ${verification.score}/10), retrying writer...`);
      verifierFeedback = `Issues found:\n${verification.issues.join("\n")}\n\nFeedback: ${verification.feedback}`;
    } else {
      console.log(`[orchestrator] Max retries reached. Using last documentation (score: ${verification.score}/10)`);
    }
  }

  // Stage 5: Diagram Agent (non-blocking)
  let diagramsGenerated = false;
  try {
    console.log("[orchestrator] Stage 5: Diagram agent...");
    const diagramOutput = await generateDiagrams(documentation);
    documentation = mergeDiagrams(documentation, diagramOutput);
    diagramsGenerated = true;
    console.log("[orchestrator] Diagram agent complete");
  } catch (error: any) {
    console.warn("[orchestrator] Diagram agent failed (non-blocking):", error?.message || error);
  }

  console.log("[orchestrator] Pipeline complete");

  return {
    documentation,
    fileAnalyses,
    searcherContext,
    verificationScore,
    diagramsGenerated,
  };
}
