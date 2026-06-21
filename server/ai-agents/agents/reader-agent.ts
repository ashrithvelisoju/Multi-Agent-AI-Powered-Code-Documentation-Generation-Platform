import * as fs from "fs";
import * as path from "path";
import { providerManager } from "../providers/provider-manager.js";
import type { ChatMessage } from "../providers/types.js";

export interface FileAnalysis {
  file: string;
  summary: string;
  functions: string[];
  classes: string[];
  dependencies: string[];
  controlFlow: string;
  apiEndpoints: string[];
  databaseModels: string[];
  securityPatterns: string[];
  configHandling: string[];
  errorHandling: string;
  stateTransitions: string[];
}

const READER_PROMPT = `You are a senior software architect. Analyze the given code file and provide a structured JSON response with the following fields:

{
  "summary": "Brief description of the file's purpose",
  "functions": ["list of function/method names with brief descriptions"],
  "classes": ["list of class names with brief descriptions"],
  "dependencies": ["list of imports/dependencies"],
  "controlFlow": "Description of the main control flow and logic",
  "apiEndpoints": ["HTTP routes/endpoints defined in this file, e.g. GET /api/users"],
  "databaseModels": ["Schema/model definitions, table names, ORM models found"],
  "securityPatterns": ["Authentication, authorization, validation, encryption patterns found"],
  "configHandling": ["Environment variables read, config files loaded, settings used"],
  "errorHandling": "How errors are caught, logged, and propagated in this file",
  "stateTransitions": ["Status/state field changes, e.g. pending -> processing -> completed"]
}

Be concise but thorough. Focus on information useful for generating comprehensive documentation including architecture diagrams, ER diagrams, API docs, security audits, and deployment guides.
If a field has no relevant data for this file, use an empty array [] or empty string "".
Respond ONLY with valid JSON, no additional text.`;

export async function analyzeAllFiles(
  tempDir: string,
  filesToAnalyze: string[]
): Promise<FileAnalysis[]> {
  const results: FileAnalysis[] = [];
  const limitedFiles = filesToAnalyze.slice(0, 10);

  for (const file of limitedFiles) {
    const filePath = path.join(tempDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.length > 10000) continue;

    const messages: ChatMessage[] = [
      { role: "system", content: READER_PROMPT },
      { role: "user", content: `File: ${file}\n\nCode:\n${content}` },
    ];

    try {
      const response = await providerManager.call("reader", messages, {
        temperature: 0.3,
      });

      let parsed: any;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
      } catch {
        parsed = {
          summary: response.content,
          functions: [],
          classes: [],
          dependencies: [],
          controlFlow: "",
          apiEndpoints: [],
          databaseModels: [],
          securityPatterns: [],
          configHandling: [],
          errorHandling: "",
          stateTransitions: [],
        };
      }

      results.push({
        file,
        summary: parsed.summary || "",
        functions: parsed.functions || [],
        classes: parsed.classes || [],
        dependencies: parsed.dependencies || [],
        controlFlow: parsed.controlFlow || "",
        apiEndpoints: parsed.apiEndpoints || [],
        databaseModels: parsed.databaseModels || [],
        securityPatterns: parsed.securityPatterns || [],
        configHandling: parsed.configHandling || [],
        errorHandling: parsed.errorHandling || "",
        stateTransitions: parsed.stateTransitions || [],
      });

      console.log(`[reader] Analyzed: ${file} (via ${response.provider})`);
    } catch (error: any) {
      console.error(`[reader] Failed to analyze ${file}:`, error?.message || error);
      results.push({
        file,
        summary: `Failed to analyze: ${error?.message || "unknown error"}`,
        functions: [],
        classes: [],
        dependencies: [],
        controlFlow: "",
        apiEndpoints: [],
        databaseModels: [],
        securityPatterns: [],
        configHandling: [],
        errorHandling: "",
        stateTransitions: [],
      });
    }
  }

  return results;
}
