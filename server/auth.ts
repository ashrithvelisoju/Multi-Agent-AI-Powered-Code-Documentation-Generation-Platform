import session from "express-session";
import createMemoryStore from "memorystore";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface User {
      id: string;
      githubId: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
      profileUrl?: string;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export function setupAuth(app: Express): void {
  const MemoryStore = createMemoryStore(session);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.findUserById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set. GitHub OAuth will not work.");
    return;
  }

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:5001/api/auth/github/callback",
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (err: any, user?: any) => void
      ) => {
        try {
          const user = await storage.upsertUserByGithubId({
            githubId: profile.id,
            username: profile.username || profile.displayName,
            displayName: profile.displayName || profile.username,
            avatarUrl: profile.photos?.[0]?.value,
            profileUrl: profile.profileUrl,
            githubAccessToken: accessToken,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
