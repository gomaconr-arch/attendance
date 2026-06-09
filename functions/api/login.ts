import { getScopedState, getUserByCredentials } from "../_lib/db";

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const { DB } = context.env;
    const body = await context.request.json<any>();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return Response.json({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const user = await getUserByCredentials(DB, email, password);
    if (!user) {
      return Response.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }

    if (user.org_id) {
      const org = await DB.prepare("SELECT org_id, company_name, subscription_status FROM organizations WHERE org_id = ?")
        .bind(user.org_id)
        .first<any>();

      if (org?.subscription_status === "disabled") {
        return Response.json({ ok: false, suspended: true, org }, { status: 403 });
      }
    }

    const state = await getScopedState(DB, {
      user_id: user.user_id,
      org_id: user.org_id ?? null,
      role: user.role
    });

    return Response.json({ ok: true, user, state });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
};
