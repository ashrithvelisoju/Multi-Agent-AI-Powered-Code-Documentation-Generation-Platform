import { providerManager } from "../providers/provider-manager.js";
import type { ChatMessage } from "../providers/types.js";

const DIAGRAM_PROMPT = `You are an expert at creating Mermaid diagrams for software documentation. Given documentation content, generate or improve Mermaid diagrams.

Generate these 5 diagram types:
1. Architecture Flowchart - showing system components and their interactions
2. ER Diagram - showing database entities and their relationships
3. Class Diagram - showing main classes/modules and relationships
4. Sequence Diagram - showing key interactions between components
5. State Diagram - showing status transitions and workflow states

Rules:
- Output ONLY Mermaid code blocks, each wrapped in triple backticks with 'mermaid' language tag
- Each diagram must be valid Mermaid syntax
- Do NOT use special characters or backticks inside mermaid code
- Keep diagrams clear and readable
- Add a markdown heading before each diagram
- Base diagrams on actual content from the documentation, not generic examples

Output format:

## Architecture Flowchart

\`\`\`mermaid
flowchart TD
    A[Component] --> B[Component]
    B --> C[Component]
\`\`\`

## ER Diagram

\`\`\`mermaid
erDiagram
    ENTITY1 ||--o{ ENTITY2 : relationship
    ENTITY1 {
        string field1
        int field2
    }
\`\`\`

## Class Diagram

\`\`\`mermaid
classDiagram
    class ClassName {
        +attribute: type
        +method(): returnType
    }
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant A as Actor
    participant B as System
    A->>B: request
    B-->>A: response
\`\`\`

## State Diagram

\`\`\`mermaid
stateDiagram-v2
    [*] --> State1
    State1 --> State2 : trigger
    State2 --> [*]
\`\`\``;

export async function generateDiagrams(documentation: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: DIAGRAM_PROMPT },
    {
      role: "user",
      content: `Based on this documentation, generate or improve the Mermaid diagrams:\n\n${documentation}`,
    },
  ];

  const response = await providerManager.call("diagram", messages, {
    temperature: 0.3,
  });

  console.log(`[diagram] Diagrams generated (via ${response.provider})`);
  return response.content;
}

export function mergeDiagrams(
  originalDoc: string,
  diagramOutput: string
): string {
  const mermaidRegex = /```\s*mermaid\s*\n([\s\S]*?)```/g;
  const newDiagrams: string[] = [];
  let match;

  while ((match = mermaidRegex.exec(diagramOutput)) !== null) {
    newDiagrams.push(match[0]);
  }

  if (newDiagrams.length === 0) return originalDoc;

  const hasExistingDiagrams = /```\s*mermaid/i.test(originalDoc);

  if (hasExistingDiagrams) {
    let diagramIndex = 0;
    return originalDoc.replace(
      /```\s*mermaid\s*\n[\s\S]*?```/g,
      (existingBlock) => {
        if (diagramIndex < newDiagrams.length) {
          return newDiagrams[diagramIndex++];
        }
        return existingBlock;
      }
    );
  }

  // If no existing diagrams, append the diagram section
  const diagramSection = `\n\n## Generated Diagrams\n\n${newDiagrams.join("\n\n")}\n`;
  return originalDoc + diagramSection;
}
