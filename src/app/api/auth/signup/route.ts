import { NextResponse } from "next/server";

// In-memory store (replace with DB later)
const users: Map<string, { email: string; password: string }> = new Map();

export async function POST(req: Request) {
  const { email, password } = await req.json();
  
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  
  if (users.has(email)) {
    return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  }
  
  users.set(email, { email, password });
  
  const res = NextResponse.json({ ok: true, email });
  res.cookies.set("uc_session", Buffer.from(email).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  
  return res;
}
