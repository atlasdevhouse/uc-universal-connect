import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  
  // TODO: Replace with real DB auth
  // For now, accept any login and set session
  const res = NextResponse.json({ ok: true, email });
  res.cookies.set("uc_session", Buffer.from(email).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  
  return res;
}
