import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://awohdskbwyfujbkljcvh.supabase.co";

const supabaseKey =
  "sb_publishable__2gKgz2EvYZxAYtk0yWHOg_hzyAhE9-";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);