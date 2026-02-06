import fs from "fs";
import path from "path";

const repoRoot = path.resolve(process.cwd(), "..");
const legacyRoot = ["hi", "po", "cap"].join("");
const legacyRootUpper = ["HI", "PO", "CAP"].join("");
const legacyPrefix = `${legacyRootUpper}_`;
const legacyPrefixShort = ["HI", "PO_"].join("");
const legacyWordPattern = new RegExp(legacyRoot, "i");
const legacyRoutePattern = new RegExp(`/${legacyRoot}`, "i");
const scanRoots = [
  { name: "frontend", dir: process.cwd() },
  { name: "app-server", dir: path.join(repoRoot, "app-server") },
  { name: "engine", dir: path.join(repoRoot, "clawops_engine") },
].filter((entry) => fs.existsSync(entry.dir));

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs"]);
const brandingExtensions = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yml",
  ".yaml",
  ".sql",
  ".toml",
  ".txt",
]);
const ignoredDirs = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "target"]);

const readFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...readFiles(fullPath));
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const scanPathsForLegacy = (dir: string): void => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (legacyWordPattern.test(entry.name) || legacyWordPattern.test(fullPath)) {
      issues.push(`Legacy name found in path: ${fullPath}`);
    }

    if (entry.isDirectory()) {
      scanPathsForLegacy(fullPath);
    }
  }
};

const issues: string[] = [];
scanPathsForLegacy(repoRoot);

const logPattern =
  /(console\.(log|error|warn|info)|logger\.(info|error|warn|debug)|logging\.(info|error|warn|warning|debug|critical))/;
const secretPattern = /(API_KEY|SECRET|TOKEN|PASSWORD|AUTH_|PRIVATE_KEY)/;
const legacyEnvTokens = [legacyPrefix, legacyPrefixShort];

for (const root of scanRoots) {
  const files = readFiles(root.dir);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!logPattern.test(line)) return;
      if (
        secretPattern.test(line) ||
        line.includes("process.env") ||
        line.includes("os.environ") ||
        line.includes("os.getenv")
      ) {
        issues.push(`Secrets log risk: ${file}:${index + 1}`);
      }
    });

    if (
      /(update|delete)\(\s*agentActivityEvents\s*\)/.test(content) ||
      /agentActivityEvents\.(update|delete)/.test(content)
    ) {
      issues.push(`Activity log mutation detected: ${file}`);
    }
    if (
      /(update|delete)\(\s*productEvents\s*\)/.test(content) ||
      /productEvents\.(update|delete)/.test(content)
    ) {
      issues.push(`Product event mutation detected: ${file}`);
    }
    if (
      /(update|delete)\(\s*auditLogEntries\s*\)/.test(content) ||
      /auditLogEntries\.(update|delete)/.test(content)
    ) {
      issues.push(`Audit log mutation detected: ${file}`);
    }
    if (
      /(update|delete)\(\s*safetyTemplateApplications\s*\)/.test(content) ||
      /safetyTemplateApplications\.(update|delete)/.test(content)
    ) {
      issues.push(`Safety template application mutation detected: ${file}`);
    }
  }
}

const brandingScanRoots = [repoRoot].filter((entry) => fs.existsSync(entry));

const readBrandingFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...readBrandingFiles(fullPath));
      continue;
    }
    if (brandingExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const brandingFiles = brandingScanRoots.flatMap((root) => {
  if (fs.statSync(root).isDirectory()) {
    return readBrandingFiles(root);
  }
  return brandingExtensions.has(path.extname(root)) ? [root] : [];
});

for (const file of brandingFiles) {
  const content = fs.readFileSync(file, "utf-8");
  if (legacyWordPattern.test(content)) {
    issues.push(`Legacy branding found in ${file}`);
  }
  if (legacyRoutePattern.test(content)) {
    issues.push(`Legacy route path found in ${file}`);
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/(from|import|require)\s+/.test(line) && legacyWordPattern.test(line)) {
      issues.push(`Legacy import path found in ${file}:${index + 1}`);
    }
    if (legacyRoutePattern.test(line)) {
      issues.push(`Legacy route path found in ${file}:${index + 1}`);
    }
  });
}

const legacyEnvDocs = [
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, "DEPLOYMENT.md"),
  path.join(repoRoot, "CONTRIBUTING.md"),
  path.join(repoRoot, ".env.example"),
  path.join(repoRoot, "docker-compose.yml"),
  path.join(repoRoot, "docker-compose-local-dev.yml"),
  path.join(repoRoot, "docker-compose.prod.yml"),
];

for (const file of legacyEnvDocs) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf-8");
  for (const token of legacyEnvTokens) {
    if (content.includes(token)) {
      issues.push(`Legacy env var reference found in ${file}`);
      break;
    }
  }
}

const middlewarePath = path.join(process.cwd(), "middleware.ts");
if (fs.existsSync(middlewarePath)) {
  const middleware = fs.readFileSync(middlewarePath, "utf-8");
  if (!middleware.includes("CLAWOPS_RATE_LIMIT")) {
    issues.push("Rate limit configuration missing from middleware.ts");
  }
} else {
  issues.push("middleware.ts not found for rate limiting check");
}

const pausedMessagePath = path.join(
  process.cwd(),
  "app",
  "api",
  "projects",
  "[projectId]",
  "agents",
  "[agentId]",
  "messages",
  "route.ts"
);
if (fs.existsSync(pausedMessagePath)) {
  const pausedMessageFile = fs.readFileSync(pausedMessagePath, "utf-8");
  if (!pausedMessageFile.includes("This agent has been temporarily paused for safety.")) {
    issues.push("Paused agent fallback message is missing");
  }
} else {
  issues.push("Agent message route not found for fallback message check");
}

if (issues.length > 0) {
  console.error("ClawOps safety checks failed:\n" + issues.map((issue) => `- ${issue}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("ClawOps safety checks passed.");
}
