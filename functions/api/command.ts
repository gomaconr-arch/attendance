import { ensureActorTenant, getActorById, getScopedState } from "../_lib/db";

const toJson = (value: unknown): string => JSON.stringify(value ?? []);
const COOL_DOWN_MS = 180_000;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const requireReason = (value: unknown): string => {
  const reason = String(value ?? "").trim();
  if (reason.length < 10) {
    throw new HttpError(400, "Adjustment reason must be at least 10 characters.");
  }
  return reason;
};

const minutesFromTime = (value: string): number => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new HttpError(400, "Invalid time format.");
  }
  return hour * 60 + minute;
};

const hoursDiff = (clockIn: string, clockOut: string | null): number | null => {
  if (!clockOut) return null;
  const diffMinutes = minutesFromTime(clockOut) - minutesFromTime(clockIn);
  return Number((diffMinutes / 60).toFixed(2));
};

const mergeFlags = (existingJson: string | null, toAdd: string[]): string[] => {
  const current = (() => {
    if (!existingJson) return [] as string[];
    try {
      const parsed = JSON.parse(existingJson);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [] as string[];
    }
  })();

  return Array.from(new Set([...current, ...toAdd]));
};

const buildId = (prefix: string) => `${prefix}_${Math.floor(Date.now() + Math.random() * 1000)}`;

const assertEditableLog = (row: any) => {
  if (!row) {
    throw new HttpError(404, "Attendance log not found.");
  }
};

const enforcePunchCooldown = async (DB: D1Database, orgId: string, employeeId: string, nowIso: string) => {
  const lastEvent = await DB.prepare(
    `SELECT date, clock_in, clock_out
     FROM attendance_logs
     WHERE org_id = ? AND employee_id = ? AND is_voided = 0
     ORDER BY date DESC, COALESCE(clock_out, clock_in) DESC
     LIMIT 1`
  )
    .bind(orgId, employeeId)
    .first<any>();

  if (!lastEvent) {
    return;
  }

  const lastTime = String(lastEvent.clock_out ?? lastEvent.clock_in);
  const lastAt = new Date(`${lastEvent.date}T${lastTime}:00+08:00`).getTime();
  const nowAt = new Date(nowIso).getTime();

  if (Number.isFinite(lastAt) && Number.isFinite(nowAt) && nowAt - lastAt < COOL_DOWN_MS) {
    throw new HttpError(429, "429 Too Many Requests - Punch cool-down active");
  }
};

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

        const eventTs = String(payload.event_ts ?? new Date().toISOString());
        await enforcePunchCooldown(DB, payload.org_id, actor.user_id, eventTs);

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

      case "adminOverwriteLog": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employer") throw new HttpError(403, "Unauthorized action");

        const reason = requireReason(payload.reason);
        const target = await DB.prepare(
          `SELECT log_id, org_id, employee_id, clock_in, clock_out, is_voided, flags_json
           FROM attendance_logs
           WHERE log_id = ? AND org_id = ?`
        )
          .bind(payload.log_id, payload.org_id)
          .first<any>();
        assertEditableLog(target);

        const nextClockIn = String(payload.clock_in ?? target.clock_in);
        const nextClockOut = payload.clock_out === null ? null : String(payload.clock_out ?? target.clock_out);
        const nextVoided = Boolean(payload.void_log);
        const nextFlags = mergeFlags(target.flags_json, ["ADMIN_OVERWRITE", ...(nextVoided ? ["VOIDED"] : [])]);
        const adjustmentId = buildId("ADJ");
        const timestamp = new Date().toISOString();

        await DB.batch([
          DB.prepare(
            `UPDATE attendance_logs
             SET clock_in = ?, clock_out = ?, total_hours = ?, flags_json = ?, is_modified = 1, is_voided = ?
             WHERE log_id = ? AND org_id = ?`
          ).bind(nextClockIn, nextClockOut, hoursDiff(nextClockIn, nextClockOut), toJson(nextFlags), nextVoided ? 1 : 0, payload.log_id, payload.org_id),
          DB.prepare(
            `INSERT INTO attendance_adjustments (
              adjustment_id, org_id, log_id, modified_by_user_id, timestamp, previous_values_json, new_values_json, reason
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            adjustmentId,
            payload.org_id,
            payload.log_id,
            actor.user_id,
            timestamp,
            toJson({ clock_in: target.clock_in, clock_out: target.clock_out, is_voided: Number(target.is_voided ?? 0) === 1 }),
            toJson({ clock_in: nextClockIn, clock_out: nextClockOut, is_voided: nextVoided }),
            reason
          )
        ]);

        break;
      }

      case "submitCorrectionRequest": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employee") throw new HttpError(403, "Unauthorized action");

        await DB.prepare(
          `INSERT INTO correction_requests (
            request_id, org_id, employee_id, target_date, requested_clock_in, requested_clock_out,
            employee_note, status, reviewer_note, reviewed_by_user_id, reviewed_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`
        )
          .bind(
            payload.request_id,
            payload.org_id,
            actor.user_id,
            payload.target_date,
            payload.requested_clock_in,
            payload.requested_clock_out,
            String(payload.employee_note ?? "").trim(),
            String(payload.created_at ?? new Date().toISOString())
          )
          .run();

        break;
      }

      case "reviewCorrectionRequest": {
        ensureActorTenant(actor, payload.org_id);
        if (actor.role !== "Employer") throw new HttpError(403, "Unauthorized action");

        const request = await DB.prepare(
          `SELECT * FROM correction_requests
           WHERE request_id = ? AND org_id = ? AND status = 'pending'`
        )
          .bind(payload.request_id, payload.org_id)
          .first<any>();

        if (!request) {
          throw new HttpError(404, "Pending correction request not found.");
        }

        const decision = String(payload.decision ?? "");
        const reviewedAt = new Date().toISOString();

        if (decision === "approve") {
          const reason = requireReason(payload.reason ?? `Approved correction request: ${request.employee_note}`);
          const existingLog = await DB.prepare(
            `SELECT log_id, clock_in, clock_out, is_voided, flags_json
             FROM attendance_logs
             WHERE org_id = ? AND employee_id = ? AND date = ?
             ORDER BY log_id DESC
             LIMIT 1`
          )
            .bind(payload.org_id, request.employee_id, request.target_date)
            .first<any>();

          const logId = existingLog?.log_id ?? buildId("LOG");
          const nextFlags = mergeFlags(existingLog?.flags_json ?? "[]", ["ADMIN_OVERWRITE"]);

          const statements: D1PreparedStatement[] = [];
          if (existingLog) {
            statements.push(
              DB.prepare(
                `UPDATE attendance_logs
                 SET clock_in = ?, clock_out = ?, total_hours = ?, flags_json = ?, is_modified = 1, is_voided = 0
                 WHERE log_id = ? AND org_id = ?`
              ).bind(
                request.requested_clock_in,
                request.requested_clock_out,
                hoursDiff(request.requested_clock_in, request.requested_clock_out),
                toJson(nextFlags),
                logId,
                payload.org_id
              )
            );
          } else {
            statements.push(
              DB.prepare(
                `INSERT INTO attendance_logs (
                  log_id, org_id, employee_id, date, clock_in, clock_out, total_hours, flags_json, is_modified, is_voided
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`
              ).bind(
                logId,
                payload.org_id,
                request.employee_id,
                request.target_date,
                request.requested_clock_in,
                request.requested_clock_out,
                hoursDiff(request.requested_clock_in, request.requested_clock_out),
                toJson(nextFlags)
              )
            );
          }

          statements.push(
            DB.prepare(
              `INSERT INTO attendance_adjustments (
                adjustment_id, org_id, log_id, modified_by_user_id, timestamp, previous_values_json, new_values_json, reason
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              buildId("ADJ"),
              payload.org_id,
              logId,
              actor.user_id,
              reviewedAt,
              toJson({
                clock_in: existingLog?.clock_in ?? null,
                clock_out: existingLog?.clock_out ?? null,
                is_voided: Number(existingLog?.is_voided ?? 0) === 1
              }),
              toJson({
                clock_in: request.requested_clock_in,
                clock_out: request.requested_clock_out,
                is_voided: false
              }),
              reason
            )
          );

          statements.push(
            DB.prepare(
              `UPDATE correction_requests
               SET status = 'approved', reviewer_note = ?, reviewed_by_user_id = ?, reviewed_at = ?
               WHERE request_id = ? AND org_id = ?`
            ).bind(String(payload.reviewer_note ?? ""), actor.user_id, reviewedAt, payload.request_id, payload.org_id)
          );

          await DB.batch(statements);
        } else if (decision === "reject") {
          await DB.prepare(
            `UPDATE correction_requests
             SET status = 'rejected', reviewer_note = ?, reviewed_by_user_id = ?, reviewed_at = ?
             WHERE request_id = ? AND org_id = ?`
          )
            .bind(String(payload.reviewer_note ?? ""), actor.user_id, reviewedAt, payload.request_id, payload.org_id)
            .run();
        } else {
          throw new HttpError(400, "Invalid review decision.");
        }

        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    const state = await getScopedState(DB, actor);
    return Response.json({ ok: true, state });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
};
