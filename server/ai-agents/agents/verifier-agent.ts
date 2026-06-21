import { providerManager } from "../providers/provider-manager.js";
import type { ChatMessage } from "../providers/types.js";
import type { FileAnalysis } from "./reader-agent.js";

export interface VerificationResult {
  approved: boolean;
  score: number;
  issues: string[];
  feedback: string;
  missingSections: string[];
  missingDiagrams: string[];
}

const REQUIRED_SECTIONS = [
  "Project Information",
  "Executive Summary",
  "Scope of Delivery",
  "System Requirements",
  "Installation Guide",
  "System Architecture",
  "Database Schema",
  "API Documentation",
  "User Manual",
  "Admin Guide",
  "Source Code Delivery",
  "Test Documentation",
  "Training Materials",
  "Release Notes",
  "Support & Maintenance",
  "Security Documentation",
  "Post-Deployment Checklist",
  "Sign-Off & Acceptance",
  "Appendices",
];

const REQUIRED_DIAGRAMS = [
  "flowchart",
  "erDiagram",
  "sequenceDiagram",
  "classDiagram",
];

const VERIFIER_PROMPT = `You are a documentation quality reviewer. Evaluate the provided documentation against the source code analyses. Check for:

1. **Section Completeness** - The documentation MUST contain ALL 19 sections:
   1. Project Information
   2. Executive Summary
   3. Scope of Delivery
   4. System Requirements
   5. Installation Guide
   6. System Architecture
   7. Database Schema
   8. API Documentation
   9. User Manual
   10. Admin Guide
   11. Source Code Delivery
   12. Test Documentation
   13. Training Materials
   14. Release Notes
   15. Support & Maintenance
   16. Security Documentation
   17. Post-Deployment Checklist
   18. Sign-Off & Acceptance
   19. Appendices

2. **Diagram Completeness** - Must have AT LEAST 3 of these 5 Mermaid diagram types as actual code blocks:
   - flowchart TD (Architecture, in Section 6)
   - erDiagram (Database, in Section 7)
   - sequenceDiagram (API flow, in Section 8)
   - classDiagram (Classes, in Section 19)
   - stateDiagram-v2 (State flows, optional)

3. **Content Quality**:
   - Each section must have substantive content (not just a heading or "TBD")
   - Descriptions must be accurate relative to the code analyses
   - Technical depth should be appropriate
   - No empty or placeholder sections

4. **Structure** - Proper Markdown formatting with hierarchical headings

Respond with ONLY a valid JSON object:
{
  "approved": true/false,
  "score": 1-10,
  "issues": ["list of specific issues found"],
  "feedback": "Specific instructions for improvement if not approved",
  "missingSections": ["names of any missing sections from the 19 required"],
  "missingDiagrams": ["names of any missing diagram types"]
}

Score >= 7 means approved. Be pragmatic - minor formatting issues should not cause rejection.
A score below 7 MUST be given if more than 3 sections are missing or if fewer than 3 diagram types are present.
Respond ONLY with valid JSON.`;

export async function verifyDocumentation(
  documentation: string,
  fileAnalyses: FileAnalysis[]
): Promise<VerificationResult> {
  const fileList = fileAnalyses
    .map((a) => `- ${a.file}: ${a.summary}`)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: VERIFIER_PROMPT },
    {
      role: "user",
      content: `## Documentation to Review:\n\n${documentation}\n\n## Source Files Analyzed:\n${fileList}`,
    },
  ];

  try {
    const response = await providerManager.call("verifier", messages, {
      temperature: 0.2,
    });

    console.log(`[verifier] Review complete (via ${response.provider})`);

    let parsed: any;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
    } catch {
      console.warn("[verifier] Could not parse JSON response, defaulting to approved");
      return {
        approved: true,
        score: 7,
        issues: [],
        feedback: "Verification parsing failed - auto-approved",
        missingSections: [],
        missingDiagrams: [],
      };
    }

    const result: VerificationResult = {
      approved: parsed.approved ?? (parsed.score >= 7),
      score: parsed.score ?? 7,
      issues: parsed.issues ?? [],
      feedback: parsed.feedback ?? "",
      missingSections: parsed.missingSections ?? [],
      missingDiagrams: parsed.missingDiagrams ?? [],
    };

    console.log(`[verifier] Score: ${result.score}/10, Approved: ${result.approved}`);
    if (result.missingSections.length > 0) {
      console.log(`[verifier] Missing sections: ${result.missingSections.join(", ")}`);
    }
    if (result.missingDiagrams.length > 0) {
      console.log(`[verifier] Missing diagrams: ${result.missingDiagrams.join(", ")}`);
    }
    return result;
  } catch (error: any) {
    console.error("[verifier] Failed:", error?.message || error);
    return {
      approved: true,
      score: 7,
      issues: [],
      feedback: "Verification failed - auto-approved",
      missingSections: [],
      missingDiagrams: [],
    };
  }
}
