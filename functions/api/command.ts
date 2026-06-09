import { ensureActorTenant, getActorById, getScopedState } from "../_lib/db";

const toJson = (value: unknown): string => JSON.stringify(value ?? []);

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const { DB } = context.env;
    const body = await context.request.json<any>();
    const actorUserId = String(body?.actor_user_id ?? "");
    const action = String(body?.action ?? "");
    const payload = body?.payload ?? {};

    if (!actorUserId || !action) {
      return Response.json({ ok: false, error: "Missing command metadata" }, { status: 400 });
    }

    const actor = await getActorById(DB, actorUserId);
    if (!actor) {
      return Response.json({ ok: false, error: "Actor not found" }, { status: 404 });
    }

    switch (action) {
      case "createOrganization": {
        if (actor.role !== "SuperAdmin") throw new Error("Unauthorized action");

        await DB.prepare(
          `INSERT INTO organizations (org_id, company_name, subscription_status, currency, work_days_json, shift_start, shift_end, default_hourly_rate, default_monthly_rate, max_hours_per_month, created_at, updated_at)
           VALUES (?, ?, 'enabled', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            payload.org_id,
            payload.company_name,
            payload.settings.currency,
            toJson(payload.settings.work_days),
            payload.settings.shift_start,
            payload.settings.shift_end,
            payload.settings.default_hourly_rate,
            payload.settings.default_monthly_rate,
            payload.settings.max_hours_per_month,
            payload.created_at,
            payload.updated_at
          )
          .run();

        await DB.prepare(
          `INSERT INTO users (user_id, org_id, name, email, password, role, payroll_mode, custom_hourly_rate, custom_monthly_rate, created_at)
           VALUES (?, ?, ?, ?, ?, 'Employer', NULL, NULL, NULL, ?)`
        )
          .bind(payload.owner.user_id, payload.org_id, payload.owner.name, payload.owner.email, payload.owner.password, payload.owner.created_at)
          .run();

        break;
      }

      case "toggleSubscription": {
        if (actor.role !== "SuperAdmin") throw new Error("Unauthorized action");

        await DB.prepare(
          `UPDATE organizations
           SET subscription_status = CASE WHEN subscription_status = 'enabled' THEN 'disabled' ELSE 'enabled' END,
               updated_at = ?
           WHERE org_id = ?`
        )
          .bind(payload.updated_at, payload.org_id)
          .run();

        break;
      }

      case "addEmployee": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employer") throw new Error("Unauthorized action");

        await DB.prepare(
          `INSERT INTO users (user_id, org_id, name, email, password, role, payroll_mode, custom_hourly_rate, custom_monthly_rate, created_at)
           VALUES (?, ?, ?, ?, ?, 'Employee', ?, ?, ?, ?)`
        )
          .bind(
            payload.user_id,
            payload.org_id,
            payload.name,
            payload.email,
            payload.password,
            payload.payroll_mode,
            payload.custom_hourly_rate,
            payload.custom_monthly_rate,
            payload.created_at
          )
          .run();

        break;
      }

      case "updateSettings": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employer") throw new Error("Unauthorized action");

        await DB.prepare(
          `UPDATE organizations
           SET currency = ?, work_days_json = ?, shift_start = ?, shift_end = ?,
               default_hourly_rate = ?, default_monthly_rate = ?, max_hours_per_month = ?, updated_at = ?
           WHERE org_id = ?`
        )
          .bind(
            payload.settings.currency,
            toJson(payload.settings.work_days),
            payload.settings.shift_start,
            payload.settings.shift_end,
            payload.settings.default_hourly_rate,
            payload.settings.default_monthly_rate,
            payload.settings.max_hours_per_month,
            payload.updated_at,
            payload.org_id
          )
          .run();

        break;
      }

      case "finalizeDraft": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employer") throw new Error("Unauthorized action");

        const entries = Object.entries(payload.runtime_modes ?? {}) as Array<[string, string]>;
        for (const [userId, mode] of entries) {
          await DB.prepare("UPDATE users SET payroll_mode = ? WHERE user_id = ? AND org_id = ?")
            .bind(mode, userId, payload.org_id)
            .run();
        }

        break;
      }

      case "punch": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employee") throw new Error("Unauthorized action");

        if (payload.type === "clockOut") {
          await DB.prepare(
            `UPDATE attendance_logs
             SET clock_out = ?, total_hours = ?, flags_json = ?
             WHERE log_id = ? AND org_id = ? AND employee_id = ?`
          )
            .bind(payload.clock_out, payload.total_hours, toJson(payload.flags), payload.log_id, payload.org_id, actor.user_id)
            .run();
        } else {
          await DB.prepare(
            `INSERT INTO attendance_logs (log_id, org_id, employee_id, date, clock_in, clock_out, total_hours, flags_json)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`
          )
            .bind(payload.log_id, payload.org_id, actor.user_id, payload.date, payload.clock_in, toJson(payload.flags))
            .run();
        }

        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    const state = await getScopedState(DB, actor);
    return Response.json({ ok: true, state });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
};
