import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://bddycxquihqwkhmiilsp.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZHljeHF1aWhxd2tobWlpbHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyOTcyODIsImV4cCI6MjA3NDg3MzI4Mn0.zg91cNGMs8TLzKCB4R6JvgpIZCwYgnaJGKF_Wmrc_jk";

export const supabase = createClient(supabaseUrl, supabaseKey);
