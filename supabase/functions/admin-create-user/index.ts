/**
 * Edge Function: admin-create-user
 * Tạo user mới với quyền admin (sử dụng service_role key)
 *
 * Security: Verify admin quyền từ JWT token + sys_profiles database,
 * KHÔNG dựa vào client-sent data.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { logActivity, type ActionCategory, type ActionStatus, type ActionSource } from "../_shared/activity-logger.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Admin roles được phép tạo user (từ env hoặc default)
const ADMIN_ROLES = (Deno.env.get('ADMIN_ROLES') || 'super_admin,admin').split(',');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Tạo client với service role key để có quyền admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // === SECURITY: Verify caller identity from JWT, NOT from request body ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Token không hợp lệ hoặc đã hết hạn" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role from database
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("sys_profiles")
      .select("system_role, email")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile || !ADMIN_ROLES.includes(callerProfile.system_role)) {
      return new Response(
        JSON.stringify({ error: "Bạn không có quyền thực hiện thao tác này" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = callerProfile.email;

    // Parse request body (adminEmail no longer accepted from client)
    const { email, password, fullName, phone, systemRole } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email và mật khẩu là bắt buộc" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate systemRole
    const validRoles = ["admin", "user"];
    const role = validRoles.includes(systemRole) ? systemRole : "user";

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Mật khẩu phải có ít nhất 6 ký tự" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tạo user mới
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "",
      },
    });

    if (createError) {
      console.error("[admin-create-user] Create user error:", createError.message);

      await logActivity(supabaseAdmin, {
        userEmail: adminEmail,
        userName: 'Admin',
        actionType: 'user_create',
        actionCategory: 'system' as ActionCategory,
        actionDescription: `Tạo tài khoản thất bại: ${email}`,
        targetType: 'user',
        targetName: email,
        requestData: { email, full_name: fullName, system_role: role },
        status: 'failed' as ActionStatus,
        errorMessage: createError.message,
        source: 'manual' as ActionSource,
      });

      if (createError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Email này đã được đăng ký" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Không thể tạo tài khoản" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tạo profile cho user mới
    if (newUser.user) {
      const defaultPermissions = role === 'admin'
        ? []
        : ["home", "orders", "products", "flash-sale", "settings/profile"];

      const { error: profileErr } = await supabaseAdmin
        .from("sys_profiles")
        .insert({
          id: newUser.user.id,
          email: email,
          full_name: fullName || null,
          phone: phone || null,
          system_role: role,
          permissions: defaultPermissions,
        });

      if (profileErr) {
        console.error("[admin-create-user] Create profile error:", profileErr.message);
      }
    }

    // Log vào system_activity_logs
    await logActivity(supabaseAdmin, {
      userId: newUser.user?.id,
      userEmail: adminEmail,
      userName: 'Admin',
      actionType: 'user_create',
      actionCategory: 'system' as ActionCategory,
      actionDescription: `Tạo tài khoản mới: ${email} (${role})`,
      targetType: 'user',
      targetId: newUser.user?.id,
      targetName: fullName || email,
      requestData: {
        email,
        full_name: fullName,
        system_role: role,
      },
      status: 'success' as ActionStatus,
      source: 'manual' as ActionSource,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-create-user] Unexpected error:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        error: "Đã xảy ra lỗi không mong muốn",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
