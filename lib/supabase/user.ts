import "server-only";
import { cache } from "react";
import { createClient } from "./server";

// React discards this cache after each server render. The page and account menu
// share one verified Auth request; identities are never cached between requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
});
