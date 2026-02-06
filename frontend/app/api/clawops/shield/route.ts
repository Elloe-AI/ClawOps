import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireProjectRoleAtLeast } from "@/lib/authorization/roles";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body.project_id || body.projectId;
    const shieldKey = body.shield_key || body.shieldKey;

    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
    if (!shieldKey) {
      return NextResponse.json({ error: "shield_key is required" }, { status: 400 });
    }

    await requireProjectRoleAtLeast(projectId, "viewer");

    // Get current user session
    const session = await getServerSession(authOptions);

    // Extract config from request body if provided
    const config = (body as any)._config;
    const requestBody = { ...body };
    delete (requestBody as any)._config;
    delete (requestBody as any).project_id;
    delete (requestBody as any).projectId;
    delete (requestBody as any).shield_key;
    delete (requestBody as any).shieldKey;

    // Get backend URL - prioritize frontend config, then environment variable
    const backendUrl =
      config?.backend_url ||
      process.env.CLAWOPS_ENGINE_URL ||
      "http://localhost:8006";

    // Get API key - prioritize frontend config, then environment variable
    const apiKey = config?.api_key || process.env.CLAWOPS_ENGINE_API_KEY;

    // Remove trailing slash from backend URL
    const baseUrl = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    const analyzeUrl = `${baseUrl}/api/v1/shields/${encodeURIComponent(String(shieldKey))}/analyze`;

    // Prepare request headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add user information from session
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

    // Add API key if available
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      // Also support X-API-Key header format (common alternative)
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(analyzeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: req.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const reason =
        errorText?.trim() ||
        `Threat protection returned ${response.status}.`;
      return NextResponse.json(
        { decision: "BLOCK", reason: `Safety check unavailable. ${reason}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("ClawOps shield check error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request was cancelled" }, { status: 499 });
    }
    return NextResponse.json(
      { decision: "BLOCK", reason: "Safety check unavailable. Response blocked by default." },
      { status: 200 }
    );
  }
}
