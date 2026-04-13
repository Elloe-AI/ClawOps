import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "@/lib/db/drizzle";
import { productEvents } from "@/lib/db/migrations/schema";

const CreateProductEventSchema = z.object({
  name: z.string().min(1),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string().optional(),
});

const ListProductEventsSchema = z.object({
  name: z.string().optional(),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

export async function createProductEvent(input: z.infer<typeof CreateProductEventSchema>) {
  const { name, userId, projectId, agentId, metadata, createdAt } = CreateProductEventSchema.parse(input);

  const [event] = await db
    .insert(productEvents)
    .values({
      name,
      userId: userId ?? null,
      projectId: projectId ?? null,
      agentId: agentId ?? null,
      metadata: metadata ?? {},
      createdAt: createdAt ?? new Date().toISOString(),
    })
    .returning();

  if (!event) {
    throw new Error("Failed to log product event");
  }

  return event;
}

export async function listProductEvents(input: z.infer<typeof ListProductEventsSchema> = {}) {
  const { name, projectId, userId, limit } = ListProductEventsSchema.parse(input);

  const filters = [];
  if (name) {
    filters.push(eq(productEvents.name, name));
  }
  if (projectId) {
    filters.push(eq(productEvents.projectId, projectId));
  }
  if (userId) {
    filters.push(eq(productEvents.userId, userId));
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  return db.query.productEvents.findMany({
    where: whereClause,
    orderBy: desc(productEvents.createdAt),
    limit: limit ?? 1000,
  });
}

export const ProductEventSchemas = {
  CreateProductEventSchema,
  ListProductEventsSchema,
};
