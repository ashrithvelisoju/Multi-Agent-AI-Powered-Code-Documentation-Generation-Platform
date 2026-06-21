import * as fs from "fs";
import * as path from "path";
import puppeteer, { Browser } from "puppeteer";

const DIAGRAMS_DIR = path.join(process.cwd(), "public", "diagrams");

if (!fs.existsSync(DIAGRAMS_DIR)) {
  fs.mkdirSync(DIAGRAMS_DIR, { recursive: true });
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || browser.isConnected() === false) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

export async function closeBrowserInstance(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function renderMermaidToImage(
  mermaidCode: string,
  diagramName: string,
  repoId: string
): Promise<string> {
  const repoDiagramsDir = path.join(DIAGRAMS_DIR, repoId);
  if (!fs.existsSync(repoDiagramsDir)) {
    fs.mkdirSync(repoDiagramsDir, { recursive: true });
  }

  const filename = `${diagramName}-${Date.now()}.png`;
  const filepath = path.join(repoDiagramsDir, filename);
  const relativePath = `/diagrams/${repoId}/${filename}`;

  console.log(`Rendering diagram ${diagramName} using Puppeteer...`);

  try {
    const browserInstance = await getBrowser();
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
    });
  </script>
</head>
<body>
  <div class="mermaid">
    ${mermaidCode.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\n    ")}
  </div>
</body>
</html>`;

    const tempHtmlPath = path.join(repoDiagramsDir, `${diagramName}-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent);

    const page = await browserInstance.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("svg", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const svgElement = await page.$("svg");
    if (!svgElement) {
      throw new Error("Mermaid diagram did not render to SVG");
    }
    
    const boundingBox = await svgElement.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not get SVG dimensions");
    }
    
    await svgElement.screenshot({ path: filepath });
    await page.close();
    fs.unlinkSync(tempHtmlPath);
    
    if (!fs.existsSync(filepath)) {
      throw new Error("Screenshot file was not created");
    }
    
    const stats = fs.statSync(filepath);
    console.log(`Rendered diagram ${diagramName} -> ${relativePath} (${stats.size} bytes)`);
    return relativePath;
    
  } catch (error: any) {
    console.error(`Error rendering Mermaid diagram ${diagramName}:`, error.message || error);
    throw error;
  }
}

export function extractMermaidBlocks(markdown: string): Array<{ name: string; code: string }> {
  const mermaidBlocks: Array<{ name: string; code: string }> = [];
  
  const mermaidRegex = /```mermaid\s*\n?([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    let code = match[1].trim();
    if (code) {
      code = code.replace(/^\n+/, '').replace(/\n+$/, '');
      
      if (code) {
        const firstLine = code.split("\n")[0].trim();
        let diagramType = "diagram";
        
        if (firstLine.includes("classDiagram")) diagramType = "class-diagram";
        else if (firstLine.includes("sequenceDiagram")) diagramType = "sequence-diagram";
        else if (firstLine.includes("flowchart")) diagramType = "flowchart";
        else if (firstLine.includes("graph")) diagramType = "flowchart";
        else if (firstLine.includes("stateDiagram")) diagramType = "state-diagram";
        else if (firstLine.includes("erDiagram")) diagramType = "er-diagram";

        mermaidBlocks.push({
          name: `${diagramType}-${index + 1}`,
          code: code,
        });
        index++;
      }
    }
  }

  return mermaidBlocks;
}

export function replaceMermaidWithImages(
  markdown: string,
  diagramImages: Record<string, string>
): string {
  let result = markdown;
  let index = 0;

  result = result.replace(/```\s*mermaid\s*\n([\s\S]*?)```/g, (match, code) => {
    const diagramType = code.trim().split("\n")[0].trim();
    let type = "diagram";
    
    if (diagramType.includes("classDiagram")) type = "class-diagram";
    else if (diagramType.includes("sequenceDiagram")) type = "sequence-diagram";
    else if (diagramType.includes("flowchart") || diagramType.includes("graph")) type = "flowchart";
    else if (diagramType.includes("stateDiagram")) type = "state-diagram";
    else if (diagramType.includes("erDiagram")) type = "er-diagram";

    const diagramName = `${type}-${index + 1}`;
    const imagePath = diagramImages[diagramName];
    
    index++;
    
    if (imagePath) {
      return `\n\n![${diagramName}](${imagePath})\n\n`;
    }
    
    return match;
  });

  return result;
}

/**
 * Reverse of replaceMermaidWithImages: replaces image references with
 * their original Mermaid source code blocks.
 *
 * Input:  ![flowchart-1](/diagrams/repoId/flowchart-1-12345.png)
 * Output: ```mermaid
 *         flowchart TD
 *             A --> B
 *         ```
 */
export function replaceImagesWithMermaid(
  markdown: string,
  diagramSources: Record<string, string>
): string {
  return markdown.replace(
    /!\[([^\]]+)\]\(\/diagrams\/[^)]+\)/g,
    (match, diagramName: string) => {
      const source = diagramSources[diagramName.trim()];
      if (source) {
        return `\`\`\`mermaid\n${source}\n\`\`\``;
      }
      return match;
    }
  );
}
