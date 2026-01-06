// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createRouteHandlerClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey:  process.env.SUPABASE_ANON_KEY!,
    }
  )
  // profiles テーブルから１件だけ取ってみる
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  

  if (error) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { status: 'ok', records: data.length },
    { status: 200 }
  );
}
