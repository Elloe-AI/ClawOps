import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body.project_id || body.projectId;

    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    await requireProjectRoleAtLeast(projectId, "viewer");

    const session = await getServerSession(authOptions);

    // Extract config from request body if provided
    const config = (body as any)._config;
    const requestBody = { ...body };
    delete (requestBody as any)._config;
    delete (requestBody as any).project_id;
    delete (requestBody as any).projectId;

    const backendUrl =
      config?.backend_url ||
      process.env.BACKEND_URL ||
      "http://localhost:8000";

    const apiKey = config?.api_key;

    const baseUrl = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    const observeUrl = `${baseUrl}/api/v1/projects/${encodeURIComponent(String(projectId))}/spans`;

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

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(observeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: req.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Observe request failed" },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("ClawOps observe error:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request was cancelled" }, { status: 499 });
    }
    return NextResponse.json(
      { error: "Failed to record activity" },
      { status: 500 }
    );
  }
}
