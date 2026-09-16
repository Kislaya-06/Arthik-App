// @ts-nocheck
// Supabase Edge Function: delete-user-account
// Permanently deletes an authenticated user's data and auth.users record using the service role key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
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
        JSON.stringify({ error: "Server misconfiguration: Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller's JWT to authenticate user and extract user id
    // DO NOT trust any user_id passed in request body!
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
    console.log(`[delete-user-account] Initiating account deletion for verified user: ${userId}`);

    // 2. Initialize admin client with service_role key to bypass RLS and perform deletions
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Safety-net deletions across application tables (even with ON DELETE CASCADE configured)
    // Delete expenses
    const { error: expError } = await adminClient
      .from("expenses")
      .delete()
      .eq("user_id", userId);

    if (expError) {
      console.error(`[delete-user-account] Failed to delete expenses for user ${userId}:`, expError);
      throw new Error(`Failed to delete user expenses: ${expError.message}`);
    }

    // Delete daily savings logs
    const { error: savingsError } = await adminClient
      .from("daily_savings_log")
      .delete()
      .eq("user_id", userId);

    if (savingsError) {
      console.error(`[delete-user-account] Failed to delete daily_savings_log for user ${userId}:`, savingsError);
      throw new Error(`Failed to delete user daily savings log: ${savingsError.message}`);
    }

    // Delete custom categories
    const { error: catError } = await adminClient
      .from("categories")
      .delete()
      .eq("user_id", userId);

    if (catError) {
      console.error(`[delete-user-account] Failed to delete categories for user ${userId}:`, catError);
      throw new Error(`Failed to delete user categories: ${catError.message}`);
    }

    // Delete user profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(`[delete-user-account] Failed to delete profile for user ${userId}:`, profileError);
      throw new Error(`Failed to delete user profile: ${profileError.message}`);
    }

    // 4. Finally delete the user from auth.users via Supabase Auth Admin API
    const { error: authAdminError } = await adminClient.auth.admin.deleteUser(userId);
    if (authAdminError) {
      console.error(
        `[delete-user-account] CRITICAL: Tables cleared but failed to delete auth.users record for ${userId}:`,
        authAdminError
      );
      throw new Error(`Failed to delete authentication account: ${authAdminError.message}`);
    }

    console.log(`[delete-user-account] Successfully deleted user account and all data for: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User account and all associated data permanently deleted",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[delete-user-account] Error occurred during account deletion:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to delete account. Please try again later.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
