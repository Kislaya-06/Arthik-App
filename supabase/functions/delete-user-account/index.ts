// Supabase Edge Function: delete-user-account (v1.2.3)
// Permanently deletes an authenticated user's record using the service role key.
// Foreign key CASCADE constraints handle dependent tables (profiles, expenses, categories, daily_savings_log).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      console.error("[delete-user-account] Missing required Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller's JWT to authenticate user and extract user id
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userAuthError,
    } = await userClient.auth.getUser();

    if (userAuthError || !user) {
      console.warn("[delete-user-account] Authentication failed:", userAuthError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[delete-user-account] Deleting user: ${userId}`);

    // 2. Initialize admin client with service_role key to delete auth user
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Delete only via auth.admin.deleteUser(userId) - FK cascades handle tables
    const { error: authAdminError } = await adminClient.auth.admin.deleteUser(userId);
    if (authAdminError) {
      console.error("[delete-user-account] Failed to delete auth user:", authAdminError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete account. Please try again later.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-user-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User account and all associated data permanently deleted",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[delete-user-account] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to delete account. Please try again later.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
