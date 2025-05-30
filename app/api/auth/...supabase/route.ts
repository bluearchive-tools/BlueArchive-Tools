// app/api/auth/[...supabase]/route.ts
import { handleAuth } from '@supabase/auth-helpers-nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET, POST だけでなく、PUT/DELETE など全てのメソッドを同じくハンドルしたい場合は、
// export const PUT = handleAuth(); export const DELETE = handleAuth(); も追加できます
export const GET = (req: NextRequest) =>
  handleAuth(req, NextResponse);

export const POST = (req: NextRequest) =>
  handleAuth(req, NextResponse);
