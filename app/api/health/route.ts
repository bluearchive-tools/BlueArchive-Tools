// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
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
