import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

Deno.serve(async (req) => {
  const envs = Object.keys(Deno.env.toObject());
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL");
  
  if (!dbUrl) {
    return new Response(JSON.stringify({ 
      error: "No database URL environment variable found", 
      envs 
    }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const client = new Client(dbUrl);
    await client.connect();
    
    // Query constraints
    const constraintsResult = await client.queryObject(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'public.check_ins'::regclass;
    `);

    // Query column definitions
    const columnsResult = await client.queryObject(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'check_ins';
    `);

    await client.end();

    return new Response(JSON.stringify({
      envs,
      constraints: constraintsResult.rows,
      columns: columnsResult.rows
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err.message || err),
      envs
    }), { headers: { "Content-Type": "application/json" } });
  }
});

