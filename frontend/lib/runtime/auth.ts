import { eq } from "drizzle-orm";

import { hashApiKey } from "@/lib/api-keys";
import { cache, PROJECT_API_KEY_CACHE_KEY } from "@/lib/cache";
import { db } from "@/lib/db/drizzle";
import { projectApiKeys } from "@/lib/db/migrations/schema";

type RuntimeAuthResult = {
  projectId: string;
  keyId: string;
  isIngestOnly: boolean;
  shorthand: string;
};

const extractApiKey = (headers: Headers): string | null => {
  const direct = headers.get("x-clawops-api-key") || headers.get("x-api-key");
  if (direct) return direct.trim();

  const auth = headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  return null;
};

export async function authenticateRuntime(headers: Headers): Promise<RuntimeAuthResult> {
  const apiKey = extractApiKey(headers);
  if (!apiKey) {
    throw new Error("Missing API key");
  }

  const hash = hashApiKey(apiKey);
  const cacheKey = `${PROJECT_API_KEY_CACHE_KEY}:${hash}`;

  const cached = await cache.get<{
    projectId: string;
    name?: string | null;
    hash: string;
    shorthand: string;
    isIngestOnly: boolean;
    id?: string;
  }>(cacheKey);

  if (cached?.projectId) {
    return {
      projectId: cached.projectId,
      keyId: cached.id ?? cached.hash,
      isIngestOnly: cached.isIngestOnly,
      shorthand: cached.shorthand,
    };
  }

  const row = await db.query.projectApiKeys.findFirst({
    where: eq(projectApiKeys.hash, hash),
  });

  if (!row) {
    throw new Error("Invalid API key");
  }

  await cache.set(cacheKey, {
    projectId: row.projectId,
    name: row.name,
    hash: row.hash,
    shorthand: row.shorthand ?? "",
    isIngestOnly: row.isIngestOnly,
    id: row.id,
  });

  return {
    projectId: row.projectId,
    keyId: row.id,
    isIngestOnly: row.isIngestOnly,
    shorthand: row.shorthand ?? "",
  };
}
