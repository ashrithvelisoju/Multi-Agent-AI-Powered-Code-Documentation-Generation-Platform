export interface ProjectMetadata {
  projectName: string;
  version: string;
  description: string;
  license: string;
  repoUrl: string;

  readmeContent: string;

  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  packageManager: string;

  folderStructure: string;
  totalFileCount: number;
  languages: string[];

  configFiles: { name: string; content: string }[];
  envExample: string;
  hasDocker: boolean;
  dockerfileContent: string;
  dockerComposeContent: string;

  hasTests: boolean;
  testDirectories: string[];
  testFileCount: number;
  testFramework: string;

  hasMigrations: boolean;
  migrationFiles: string[];
  schemaFiles: string[];

  hasCICD: boolean;
  cicdFiles: string[];

  recentCommits: string[];
  branchName: string;
}
