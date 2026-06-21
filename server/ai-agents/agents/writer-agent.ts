import { providerManager } from "../providers/provider-manager.js";
import type { ChatMessage } from "../providers/types.js";
import type { FileAnalysis } from "./reader-agent.js";
import type { SearcherContext } from "./searcher-agent.js";
import type { ProjectMetadata } from "../types/project-metadata.js";

export interface WriterInput {
  fileAnalyses: FileAnalysis[];
  searcherContext: SearcherContext;
  projectMetadata?: ProjectMetadata;
  existingDoc?: string;
  verifierFeedback?: string;
}

const WRITER_PROMPT = `You are an expert technical writer creating comprehensive software documentation. Generate a COMPLETE document in Markdown with ALL 19 sections listed below. Every section MUST have substantive content — never leave a section empty or with only a heading.

Use the provided data sources to populate each section. Where exact data is unavailable, infer reasonable content from the codebase analysis or provide professional template content.

---

# REQUIRED SECTIONS (all 19 must appear)

## 1. Project Information
- Project name, version, repository URL
- Description and purpose
- License information
- Delivery date: current date
- Data sources: ProjectMetadata (name, version, repoUrl, description, license)

## 2. Executive Summary
- High-level overview of the project
- Key objectives and goals
- Main deliverables and capabilities
- Data sources: ProjectMetadata.readmeContent + SearcherContext.architecturePatterns

## 3. Scope of Delivery
- Features and modules delivered
- Acceptance criteria
- What is included and excluded
- Data sources: SearcherContext overview + FileAnalysis summaries

## 4. System Requirements
- Hardware requirements (if applicable)
- Software prerequisites (OS, runtime, browser)
- Dependencies and their versions
- Package manager used
- Data sources: ProjectMetadata (dependencies, devDependencies, packageManager) + SearcherContext.techStack

## 5. Installation Guide
- Step-by-step installation instructions
- Environment setup (.env variables needed)
- Database setup and migration steps
- Docker setup (if applicable)
- Build and start commands
- Data sources: ProjectMetadata (scripts, envExample, docker, migrations) + SearcherContext.configurationMap

## 6. System Architecture
- Architecture overview and design decisions
- Technology stack breakdown
- Component interactions and data flow
- MUST include a Mermaid flowchart diagram:

\`\`\`mermaid
flowchart TD
    A[Component] --> B[Component]
    B --> C[Component]
\`\`\`

- Data sources: SearcherContext (architecturePatterns, dataFlow, techStack) + FileAnalysis

## 7. Database Schema
- Data models and their fields
- Entity relationships
- Database changes and migrations
- MUST include a Mermaid ER diagram:

\`\`\`mermaid
erDiagram
    ENTITY1 ||--o{ ENTITY2 : relationship
    ENTITY1 {
        string field1
        int field2
    }
\`\`\`

- Data sources: SearcherContext.databaseSchema + FileAnalysis.databaseModels

## 8. API Documentation
- All endpoints with HTTP methods
- Request/response formats with examples
- Authentication requirements
- Error codes and handling
- MUST include a Mermaid sequence diagram:

\`\`\`mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database
    Client->>Server: Request
    Server->>Database: Query
    Database-->>Server: Result
    Server-->>Client: Response
\`\`\`

- Data sources: SearcherContext.apiSurface + FileAnalysis.apiEndpoints

## 9. User Manual
- Feature walkthroughs
- Step-by-step usage instructions
- Common use cases
- User roles and permissions
- Data sources: SearcherContext (entryPoints, dataFlow, userRolesAndPermissions)

## 10. Admin Guide
- Administrative functions
- Configuration management
- User management
- Backup and restore procedures
- Data sources: SearcherContext.configurationMap + ProjectMetadata.scripts

## 11. Source Code Delivery
- Repository access information
- Branching strategy
- Folder structure overview
- Build instructions
- Data sources: ProjectMetadata (folderStructure, scripts, repoUrl, branchName)

## 12. Test Documentation
- Test plan and strategy
- Test frameworks used
- Test directory structure
- How to run tests
- Data sources: ProjectMetadata (testFramework, testDirectories, testFileCount) + SearcherContext.testingStrategy

## 13. Training Materials
- Getting started guide for new developers
- Key concepts and terminology
- Architecture walkthrough
- Common development tasks
- Data sources: Synthesized from all sources

## 14. Release Notes
- Recent changes and features
- Improvements and bug fixes
- Known issues
- Deprecated features
- Data sources: ProjectMetadata.recentCommits

## 15. Support & Maintenance
- Troubleshooting common issues
- FAQ
- Error handling patterns
- Logging and monitoring
- Data sources: SearcherContext.errorStrategy + FileAnalysis.errorHandling

## 16. Security Documentation
- Authentication and authorization mechanisms
- Input validation patterns
- Known security considerations
- Access control and permissions
- Data sources: SearcherContext.securityArchitecture + FileAnalysis.securityPatterns

## 17. Post-Deployment Checklist
- Configuration verification steps
- Smoke test checklist
- Go-live checklist
- Rollback procedure
- Data sources: ProjectMetadata (docker, cicdFiles) + SearcherContext.deploymentArchitecture

## 18. Sign-Off & Acceptance
- Deliverable checklist (all 19 sections)
- Acceptance criteria summary
- Handover notes
- Data sources: Template content + section list

## 19. Appendices
- Glossary of technical terms
- Acronyms and abbreviations
- References and external links
- Change log summary
- MUST include a Mermaid class diagram:

\`\`\`mermaid
classDiagram
    class ClassName {
        +attribute: type
        +method(): returnType
    }
    ClassName1 --> ClassName2 : relationship
\`\`\`

- Data sources: SearcherContext.techStack + ProjectMetadata.recentCommits

---

# DIAGRAM REQUIREMENTS

You MUST include AT LEAST these Mermaid diagrams as actual code blocks (not just headings):
1. Architecture Flowchart (Section 6) - \`flowchart TD\`
2. ER Diagram (Section 7) - \`erDiagram\`
3. Sequence Diagram (Section 8) - \`sequenceDiagram\`
4. Class Diagram (Section 19) - \`classDiagram\`

Optional but recommended:
5. State Diagram (in Section 15 or 17) - \`stateDiagram-v2\`

Rules for Mermaid diagrams:
- Use triple backticks with 'mermaid' language tag
- Do NOT use special characters like backticks or quotes inside mermaid code
- Keep diagrams clear and readable
- Base diagrams on actual code analysis, not generic examples

# FORMATTING RULES
- Use proper Markdown headings (# for section titles, ## for subsections)
- Use bullet points and numbered lists for clarity
- Include code examples where relevant using fenced code blocks
- Every section must have real content — no placeholders or "TBD"`;

function buildWriterInput(input: WriterInput): string {
  const fileSection = input.fileAnalyses
    .map(
      (a) =>
        `### ${a.file}\n- **Summary**: ${a.summary}\n- **Functions**: ${a.functions.join(", ") || "None"}\n- **Classes**: ${a.classes.join(", ") || "None"}\n- **Dependencies**: ${a.dependencies.join(", ") || "None"}\n- **Control Flow**: ${a.controlFlow}\n- **API Endpoints**: ${a.apiEndpoints.join(", ") || "None"}\n- **Database Models**: ${a.databaseModels.join(", ") || "None"}\n- **Security Patterns**: ${a.securityPatterns.join(", ") || "None"}\n- **Config Handling**: ${a.configHandling.join(", ") || "None"}\n- **Error Handling**: ${a.errorHandling || "None"}\n- **State Transitions**: ${a.stateTransitions.join(", ") || "None"}`
    )
    .join("\n\n");

  const ctx = input.searcherContext;
  const contextSection = `
## Cross-File Dependencies
${ctx.crossFileDependencies.join("\n") || "None identified"}

## Architecture Patterns
${ctx.architecturePatterns.join("\n") || "None identified"}

## Data Flow
${ctx.dataFlow || "Not available"}

## Entry Points
${ctx.entryPoints.join("\n") || "None identified"}

## Key Abstractions
${ctx.keyAbstractions.join("\n") || "None identified"}

## API Surface
${ctx.apiSurface.join("\n") || "None identified"}

## Database Schema
${ctx.databaseSchema.join("\n") || "None identified"}

## Security Architecture
${ctx.securityArchitecture.join("\n") || "None identified"}

## Configuration Map
${ctx.configurationMap.join("\n") || "None identified"}

## Testing Strategy
${ctx.testingStrategy || "Not available"}

## Deployment Architecture
${ctx.deploymentArchitecture || "Not available"}

## State Flows
${ctx.stateFlows.join("\n") || "None identified"}

## Error Strategy
${ctx.errorStrategy || "Not available"}

## User Roles & Permissions
${ctx.userRolesAndPermissions.join("\n") || "None identified"}

## External Services
${ctx.externalServices.join("\n") || "None identified"}

## Tech Stack
${ctx.techStack.join("\n") || "None identified"}`;

  let metadataSection = "";
  if (input.projectMetadata) {
    const pm = input.projectMetadata;
    metadataSection = `
# Project Metadata

## Identity
- **Name**: ${pm.projectName}
- **Version**: ${pm.version}
- **Description**: ${pm.description}
- **License**: ${pm.license}
- **Repository**: ${pm.repoUrl}
- **Branch**: ${pm.branchName}

## README Content
${pm.readmeContent || "No README found"}

## Dependencies
${Object.entries(pm.dependencies).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "None"}

## Dev Dependencies
${Object.entries(pm.devDependencies).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "None"}

## Scripts
${Object.entries(pm.scripts).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "None"}

## Package Manager
${pm.packageManager}

## Folder Structure
\`\`\`
${pm.folderStructure}
\`\`\`

## File Statistics
- Total files: ${pm.totalFileCount}
- Languages: ${pm.languages.join(", ")}

## Config Files
${pm.configFiles.map((c) => `### ${c.name}\n\`\`\`\n${c.content.substring(0, 500)}\n\`\`\``).join("\n\n") || "None found"}

## Environment Example
\`\`\`
${pm.envExample || "No .env.example found"}
\`\`\`

## Docker
- Has Docker: ${pm.hasDocker}
${pm.dockerfileContent ? `### Dockerfile\n\`\`\`\n${pm.dockerfileContent.substring(0, 1000)}\n\`\`\`` : ""}
${pm.dockerComposeContent ? `### Docker Compose\n\`\`\`\n${pm.dockerComposeContent.substring(0, 1000)}\n\`\`\`` : ""}

## Testing
- Has Tests: ${pm.hasTests}
- Test Framework: ${pm.testFramework}
- Test Directories: ${pm.testDirectories.join(", ") || "None"}
- Test File Count: ${pm.testFileCount}

## Migrations & Schemas
- Has Migrations: ${pm.hasMigrations}
- Migration Files: ${pm.migrationFiles.join(", ") || "None"}
- Schema Files: ${pm.schemaFiles.join(", ") || "None"}

## CI/CD
- Has CI/CD: ${pm.hasCICD}
- CI/CD Files: ${pm.cicdFiles.join(", ") || "None"}

## Recent Commits
${pm.recentCommits.map((c) => `- ${c}`).join("\n") || "No commit history available"}`;
  }

  let userContent = `# File Analyses\n\n${fileSection}\n\n# Architecture Context\n${contextSection}`;

  if (metadataSection) {
    userContent += `\n\n${metadataSection}`;
  }

  if (input.verifierFeedback) {
    userContent += `\n\n# VERIFIER FEEDBACK (address these issues)\n${input.verifierFeedback}`;
  }

  return userContent;
}

export async function writeDocumentation(input: WriterInput): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: WRITER_PROMPT },
  ];

  if (input.existingDoc) {
    messages.push({
      role: "user",
      content: `Here is the EXISTING documentation:\n\n${input.existingDoc}\n\nAnd here are the analyses of the CHANGED files:\n\n${buildWriterInput(input)}\n\nPlease UPDATE the documentation to reflect these changes. Keep unchanged sections intact. Ensure all 19 sections are present.`,
    });
  } else {
    messages.push({
      role: "user",
      content: buildWriterInput(input),
    });
  }

  const response = await providerManager.call("writer", messages, {
    temperature: 0.7,
  });

  console.log(`[writer] Documentation generated (via ${response.provider}, ${response.content.length} chars)`);

  return response.content;
}
