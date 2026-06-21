import { providerManager } from "../providers/provider-manager.js";
import type { ChatMessage } from "../providers/types.js";
import type { FileAnalysis } from "./reader-agent.js";

export interface SearcherContext {
  crossFileDependencies: string[];
  architecturePatterns: string[];
  dataFlow: string;
  entryPoints: string[];
  keyAbstractions: string[];
  apiSurface: string[];
  databaseSchema: string[];
  securityArchitecture: string[];
  configurationMap: string[];
  testingStrategy: string;
  deploymentArchitecture: string;
  stateFlows: string[];
  errorStrategy: string;
  userRolesAndPermissions: string[];
  externalServices: string[];
  techStack: string[];
}

const SEARCHER_PROMPT = `You are an expert software architect specialized in analyzing codebase relationships. Given a set of file analyses, perform a comprehensive 16-point analysis:

1. Cross-file dependencies and how modules interact
2. Architecture patterns used (MVC, microservices, event-driven, layered, etc.)
3. Data flow through the system (from input to output)
4. Entry points (main files, API routes, event handlers)
5. Key abstractions and shared interfaces
6. API surface - all HTTP endpoints, GraphQL queries, WebSocket events with methods and paths
7. Database schema - models, collections, tables, relationships between entities
8. Security architecture - authentication mechanisms, authorization patterns, input validation, encryption
9. Configuration map - environment variables, config files, feature flags, external service configs
10. Testing strategy - test frameworks, test types (unit/integration/e2e), coverage approach
11. Deployment architecture - containerization, CI/CD patterns, build process, runtime requirements
12. State flows - status transitions, state machines, workflow progressions
13. Error strategy - error handling patterns, logging, monitoring, recovery mechanisms
14. User roles and permissions - access control, role definitions, permission checks
15. External services - third-party APIs, cloud services, message queues, caches
16. Tech stack - languages, frameworks, libraries, databases, tools used

Respond with a structured JSON:
{
  "crossFileDependencies": ["File A imports/uses File B for X purpose", ...],
  "architecturePatterns": ["Pattern name: description of how it's used", ...],
  "dataFlow": "Description of how data flows through the system",
  "entryPoints": ["file/function that serves as an entry point", ...],
  "keyAbstractions": ["Shared interface/type/class and its role", ...],
  "apiSurface": ["METHOD /path - description", ...],
  "databaseSchema": ["Model/Table name: fields and relationships", ...],
  "securityArchitecture": ["Security pattern: description", ...],
  "configurationMap": ["Config key/env var: purpose and where used", ...],
  "testingStrategy": "Overview of testing approach, frameworks, and coverage",
  "deploymentArchitecture": "How the app is built, containerized, and deployed",
  "stateFlows": ["Entity: state1 -> state2 -> state3 (trigger)", ...],
  "errorStrategy": "How errors are handled, logged, and recovered from",
  "userRolesAndPermissions": ["Role: permissions and access patterns", ...],
  "externalServices": ["Service name: purpose and integration method", ...],
  "techStack": ["Category: technology name", ...]
}

Respond ONLY with valid JSON, no additional text.`;

export async function findRelationships(
  fileAnalyses: FileAnalysis[]
): Promise<SearcherContext> {
  const analysisText = fileAnalyses
    .map(
      (a) =>
        `### ${a.file}\nSummary: ${a.summary}\nFunctions: ${a.functions.join(", ")}\nClasses: ${a.classes.join(", ")}\nDependencies: ${a.dependencies.join(", ")}\nControl Flow: ${a.controlFlow}\nAPI Endpoints: ${a.apiEndpoints.join(", ") || "None"}\nDatabase Models: ${a.databaseModels.join(", ") || "None"}\nSecurity Patterns: ${a.securityPatterns.join(", ") || "None"}\nConfig Handling: ${a.configHandling.join(", ") || "None"}\nError Handling: ${a.errorHandling || "None"}\nState Transitions: ${a.stateTransitions.join(", ") || "None"}`
    )
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SEARCHER_PROMPT },
    {
      role: "user",
      content: `Here are the analyses of all files in the project:\n\n${analysisText}`,
    },
  ];

  try {
    const response = await providerManager.call("searcher", messages, {
      temperature: 0.4,
    });

    console.log(`[searcher] Analysis complete (via ${response.provider})`);

    let parsed: any;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
    } catch {
      return {
        crossFileDependencies: [],
        architecturePatterns: [],
        dataFlow: response.content,
        entryPoints: [],
        keyAbstractions: [],
        apiSurface: [],
        databaseSchema: [],
        securityArchitecture: [],
        configurationMap: [],
        testingStrategy: "",
        deploymentArchitecture: "",
        stateFlows: [],
        errorStrategy: "",
        userRolesAndPermissions: [],
        externalServices: [],
        techStack: [],
      };
    }

    return {
      crossFileDependencies: parsed.crossFileDependencies || [],
      architecturePatterns: parsed.architecturePatterns || [],
      dataFlow: parsed.dataFlow || "",
      entryPoints: parsed.entryPoints || [],
      keyAbstractions: parsed.keyAbstractions || [],
      apiSurface: parsed.apiSurface || [],
      databaseSchema: parsed.databaseSchema || [],
      securityArchitecture: parsed.securityArchitecture || [],
      configurationMap: parsed.configurationMap || [],
      testingStrategy: parsed.testingStrategy || "",
      deploymentArchitecture: parsed.deploymentArchitecture || "",
      stateFlows: parsed.stateFlows || [],
      errorStrategy: parsed.errorStrategy || "",
      userRolesAndPermissions: parsed.userRolesAndPermissions || [],
      externalServices: parsed.externalServices || [],
      techStack: parsed.techStack || [],
    };
  } catch (error: any) {
    console.error(`[searcher] Failed:`, error?.message || error);
    return {
      crossFileDependencies: [],
      architecturePatterns: [],
      dataFlow: "Analysis failed",
      entryPoints: [],
      keyAbstractions: [],
      apiSurface: [],
      databaseSchema: [],
      securityArchitecture: [],
      configurationMap: [],
      testingStrategy: "",
      deploymentArchitecture: "",
      stateFlows: [],
      errorStrategy: "",
      userRolesAndPermissions: [],
      externalServices: [],
      techStack: [],
    };
  }
}
