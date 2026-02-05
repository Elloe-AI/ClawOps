import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

import { authOptions } from "@/lib/auth";

const CLAWOPS_ENGINE_URL = process.env.CLAWOPS_ENGINE_URL || "http://localhost:8006";

function getLmnrHeaders(session: any): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.user) {
    if (session.user.id) {
      headers["X-LMNR-User-Id"] = session.user.id;
    }
    if (session.user.email) {
      headers["X-LMNR-User-Email"] = session.user.email;
    }
    if (session.user.name) {
      headers["X-LMNR-User-Name"] = session.user.name;
    }
  }

  const apiKey = process.env.CLAWOPS_ENGINE_API_KEY;
  if (apiKey) {
    headers["X-LMNR-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    await props.params;
    const headers = getLmnrHeaders(session);

    const queryParams = req.nextUrl.searchParams.toString();
    const url = `${CLAWOPS_ENGINE_URL}/api/v1/traces/timeseries${queryParams ? `?${queryParams}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`ClawOps engine error: ${error}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching activity timeseries:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
