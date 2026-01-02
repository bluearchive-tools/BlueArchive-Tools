import { cookies } from 'next/headers'
import {
  createServerComponentClient,
  createRouteHandlerClient,
} from '@supabase/auth-helpers-nextjs'

export function createSupabaseServerClient() {
  return createServerComponentClient({ cookies })
}

export function createSupabaseRouteClient() {
  return createRouteHandlerClient({ cookies })
}
