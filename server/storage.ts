import mongoose from "mongoose";
import { type Repo, type Documentation, type User, type CreateRepoInput, type UpdateRepoInput } from "@shared/schema";

// Mongoose Schemas
const RepoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  lastCommitHash: { type: String },
  status: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"], 
    default: "pending" 
  },
  documentationId: { type: String }, // Reference ID
}, { timestamps: true });

const DocumentationSchema = new mongoose.Schema({
  repoId: { type: String, required: true },
  content: { type: String, required: true }, // JSON stringified or Markdown
  docxUrl: { type: String },
  diagramImages: { type: Map, of: String, default: {} }, // Map of diagram name to image path
  diagramSources: { type: Map, of: String, default: {} }, // Map of diagram name to Mermaid source code
  qualityScore: { type: Number },
}, { timestamps: true });

export const RepoModel = mongoose.model("Repo", RepoSchema);
export const DocumentationModel = mongoose.model("Documentation", DocumentationSchema);

const UserSchema = new mongoose.Schema({
  githubId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String },
  profileUrl: { type: String },
  githubAccessToken: { type: String },
}, { timestamps: true });

export const UserModel = mongoose.model("User", UserSchema);

export interface IStorage {
  createRepo(repo: CreateRepoInput): Promise<Repo>;
  getRepo(id: string): Promise<Repo | undefined>;
  listRepos(): Promise<Repo[]>;
  updateRepo(id: string, updates: UpdateRepoInput): Promise<Repo | undefined>;
  findRepoByUrl(url: string): Promise<Repo | undefined>;
  
  createDocumentation(doc: { repoId: string; content: string; docxUrl?: string; diagramImages?: Record<string, string>; diagramSources?: Record<string, string>; qualityScore?: number }): Promise<Documentation>;
  getDocumentation(repoId: string): Promise<Documentation | undefined>;
  updateDocumentation(repoId: string, content: string, diagramUpdates?: { diagramImages?: Record<string, string>; diagramSources?: Record<string, string> }): Promise<Documentation | undefined>;

  deleteRepo(id: string): Promise<boolean>;
  deleteDocumentation(repoId: string): Promise<boolean>;
  updateRepoUrl(id: string, url: string): Promise<Repo | undefined>;

  findUserByGithubId(githubId: string): Promise<User | undefined>;
  findUserById(id: string): Promise<User | undefined>;
  upsertUserByGithubId(profile: {
    githubId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    profileUrl?: string;
    githubAccessToken?: string;
  }): Promise<User>;
  getGithubAccessToken(userId: string): Promise<string | undefined>;
}

export class MongoStorage implements IStorage {
  async createRepo(repo: CreateRepoInput): Promise<Repo> {
    const newRepo = await RepoModel.create(repo);
    return this.mapRepo(newRepo);
  }

  async getRepo(id: string): Promise<Repo | undefined> {
    if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
    const repo = await RepoModel.findById(id);
    return repo ? this.mapRepo(repo) : undefined;
  }

  async listRepos(): Promise<Repo[]> {
    const repos = await RepoModel.find().sort({ createdAt: -1 });
    return repos.map(this.mapRepo);
  }

  async updateRepo(id: string, updates: UpdateRepoInput): Promise<Repo | undefined> {
    if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
    const repo = await RepoModel.findByIdAndUpdate(id, updates, { new: true });
    return repo ? this.mapRepo(repo) : undefined;
  }

  async findRepoByUrl(url: string): Promise<Repo | undefined> {
    const repo = await RepoModel.findOne({ url });
    return repo ? this.mapRepo(repo) : undefined;
  }

  async createDocumentation(doc: { repoId: string; content: string; docxUrl?: string; diagramImages?: Record<string, string>; diagramSources?: Record<string, string>; qualityScore?: number }): Promise<Documentation> {
    const newDoc = await DocumentationModel.create(doc);
    return this.mapDoc(newDoc);
  }

  async getDocumentation(repoId: string): Promise<Documentation | undefined> {
    const doc = await DocumentationModel.findOne({ repoId }).sort({ createdAt: -1 });
    return doc ? this.mapDoc(doc) : undefined;
  }

  async updateDocumentation(repoId: string, content: string, diagramUpdates?: { diagramImages?: Record<string, string>; diagramSources?: Record<string, string> }): Promise<Documentation | undefined> {
    const doc = await DocumentationModel.findOne({ repoId }).sort({ createdAt: -1 });
    if (!doc) return undefined;
    doc.content = content;
    if (diagramUpdates?.diagramImages) {
      doc.diagramImages = new Map(Object.entries(diagramUpdates.diagramImages)) as any;
    }
    if (diagramUpdates?.diagramSources) {
      doc.diagramSources = new Map(Object.entries(diagramUpdates.diagramSources)) as any;
    }
    const saved = await doc.save();
    return this.mapDoc(saved);
  }

  async deleteRepo(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await RepoModel.findByIdAndDelete(id);
    return result !== null;
  }

  async deleteDocumentation(repoId: string): Promise<boolean> {
    const result = await DocumentationModel.deleteMany({ repoId });
    return result.deletedCount > 0;
  }

  async updateRepoUrl(id: string, url: string): Promise<Repo | undefined> {
    if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
    const repo = await RepoModel.findByIdAndUpdate(id, { url }, { new: true });
    return repo ? this.mapRepo(repo) : undefined;
  }

  private mapRepo(doc: any): Repo {
    return {
      id: doc._id.toString(),
      url: doc.url,
      lastCommitHash: doc.lastCommitHash,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      documentationId: doc.documentationId,
    };
  }

  private mapDoc(doc: any): Documentation {
    const diagramImagesMap = doc.diagramImages instanceof Map
      ? Object.fromEntries(doc.diagramImages)
      : (doc.diagramImages || {});

    const diagramSourcesMap = doc.diagramSources instanceof Map
      ? Object.fromEntries(doc.diagramSources)
      : (doc.diagramSources || {});

    return {
      id: doc._id.toString(),
      repoId: doc.repoId,
      content: doc.content,
      docxUrl: doc.docxUrl,
      diagramImages: diagramImagesMap,
      diagramSources: diagramSourcesMap,
      qualityScore: doc.qualityScore,
      createdAt: doc.createdAt,
    };
  }

  async findUserByGithubId(githubId: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ githubId });
    return user ? this.mapUser(user) : undefined;
  }

  async findUserById(id: string): Promise<User | undefined> {
    if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
    const user = await UserModel.findById(id);
    return user ? this.mapUser(user) : undefined;
  }

  async upsertUserByGithubId(profile: {
    githubId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    profileUrl?: string;
    githubAccessToken?: string;
  }): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: profile.githubId },
      { $set: profile },
      { upsert: true, new: true }
    );
    return this.mapUser(user);
  }

  async getGithubAccessToken(userId: string): Promise<string | undefined> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return undefined;
    const user = await UserModel.findById(userId).select('githubAccessToken');
    return user?.githubAccessToken ?? undefined;
  }

  private mapUser(doc: any): User {
    return {
      id: doc._id.toString(),
      githubId: doc.githubId,
      username: doc.username,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl,
      profileUrl: doc.profileUrl,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const storage = new MongoStorage();
