import { NextResponse } from "next/server";

// Proxy screenshot requests to the Windows agent
// In production, this would go through a reverse tunnel
export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentUrl = url.searchParams.get("agent");
  
  if (!agentUrl) {
    return NextResponse.json({ error: "agent URL required" }, { status: 400 });
  }
  
  try {
    const res = await fetch(`${agentUrl}/screenshot`, { 
      signal: AbortSignal.timeout(5000) 
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Agent unreachable" }, { status: 502 });
  }
}
