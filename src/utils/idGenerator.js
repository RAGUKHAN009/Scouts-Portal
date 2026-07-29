import { supabase } from '../supabaseClient'

// IDs look like: IDBS-ZG-SS-0007
// The running number is generated inside Postgres (see supabase/schema.sql,
// function generate_scout_id) using a per-group SEQUENCE, so two leaders
// submitting forms at the same time can never collide on the same ID.
export async function generateScoutId(groupCode) {
  const { data, error } = await supabase.rpc('generate_scout_id', { group_code: groupCode })
  if (error) throw error
  return data // e.g. "IDBS-ZG-SS-0007"
}
