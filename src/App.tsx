import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import SuperAdminPortal from "./admin/SuperAdminPortal";
import EmployerDashboard from "./client/EmployerDashboardView";
import EmployeeConsole from "./client/EmployeeConsoleView";
import MobileShell from "./client/MobileShell";
import { apiCommand, apiLogin, normalizeRuntimeModes, ScopedState } from "./shared/api";
import { DEFAULT_ORGANIZATION_SETTINGS } from "./shared/defaults";
import { hoursDiff, outsideShiftFlag, timeOutsideShift } from "./shared/payroll";
import { seedData } from "./shared/seed";
import { manilaDate, manilaTime } from "./shared/timezone";
import { AttendanceLog, DateRange, Organization, OrganizationSettings, PayrollMode, Session, User } from "./shared/types";

const APP_VERSION = "3.1.0";
const SANDBOX_MODE = import.meta.env.VITE_SANDBOX_MODE !== "false";

type LoginState = {
  email: string;
  password: string;
};

const buildId = (prefix: string) => `${prefix}_${Math.floor(Date.now() + Math.random() * 1000)}`;

const roleRoute = (role: Session["role"]): string => {
  if (role === "SuperAdmin") {
    return "/admin";
  }
  if (role === "Employer") {
    return "/client/employer";
  }
  return "/client/employee";
};

function SuspendedScreen({ companyName }: { companyName?: string }) {
  return (
    <MobileShell>
      <div className="p-8 text-center">
        <h2 className="text-2xl font-semibold text-rose-700">Account Suspended: Contact Support</h2>
        <p className="mt-3 text-sm text-slate-600">
          {companyName ? `${companyName} is currently disabled.` : "Your organization is currently disabled."}
        </p>
      </div>
    </MobileShell>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [organizations, setOrganizations] = useState<Organization[]>(seedData.organizations);
  const [users, setUsers] = useState<User[]>(seedData.users);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(seedData.attendance_logs);

  const [orgSessionRevocations, setOrgSessionRevocations] = useState<Record<string, number>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [login, setLogin] = useState<LoginState>({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string>("");
  const [suspendedOrgId, setSuspendedOrgId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: `${manilaDate().slice(0, 7)}-01`,
    end: manilaDate()
  });

  const applyScopedState = (state: ScopedState) => {
    setOrganizations(state.organizations);
    setUsers(state.users);
    setAttendanceLogs(state.attendance_logs);
  };

  const currentUser = useMemo(() => {
    if (!session) {
      return null;
    }
    return users.find((user) => user.user_id === session.user_id) ?? null;
  }, [session, users]);

  const suspendedOrg = useMemo(
    () => organizations.find((org) => org.org_id === suspendedOrgId) ?? null,
    [organizations, suspendedOrgId]
  );

  const currentOrganization = useMemo(() => {
    if (!currentUser?.org_id) {
      return null;
    }
    return organizations.find((org) => org.org_id === currentUser.org_id) ?? null;
  }, [organizations, currentUser]);

  useEffect(() => {
    if (!session?.org_id) {
      return;
    }

    const org = organizations.find((item) => item.org_id === session.org_id);
    const rev = orgSessionRevocations[session.org_id] ?? 0;
    const staleSession = typeof session.org_session_rev === "number" && session.org_session_rev !== rev;

    if (org?.subscription_status === "disabled" || staleSession) {
      setSuspendedOrgId(session.org_id);
      setSession(null);
      setLoginError("Account Suspended: Contact Support");
      navigate("/suspended", { replace: true });
    }
  }, [organizations, orgSessionRevocations, session, navigate]);

  useEffect(() => {
    if (!session) {
      if (location.pathname !== "/login" && location.pathname !== "/suspended") {
        navigate("/login", { replace: true });
      }
      return;
    }

    const expected = roleRoute(session.role);
    if (location.pathname === "/login" || location.pathname === "/") {
      navigate(expected, { replace: true });
    }
  }, [session, location.pathname, navigate]);

  const orgScopedUsers = useMemo(() => {
    if (!currentUser?.org_id) {
      return [];
    }
    return users.filter((user) => user.org_id === currentUser.org_id);
  }, [users, currentUser]);

  const orgScopedLogs = useMemo(() => {
    if (!currentUser?.org_id) {
      return [];
    }
    return attendanceLogs.filter((log) => log.org_id === currentUser.org_id);
  }, [attendanceLogs, currentUser]);

  const handleLogin = async (override?: LoginState) => {
    const candidate = override ?? login;
    const email = candidate.email.trim().toLowerCase();

    try {
      const remote = await apiLogin(email, candidate.password);
      if (remote.ok && remote.user && remote.state) {
        applyScopedState(remote.state);
        setSuspendedOrgId(null);
        setLoginError("");

        const nextSession: Session = {
          user_id: remote.user.user_id,
          role: remote.user.role,
          org_id: remote.user.org_id,
          login_at: new Date().toISOString(),
          org_session_rev: remote.user.org_id ? orgSessionRevocations[remote.user.org_id] ?? 0 : undefined
        };

        setSession(nextSession);
        navigate(roleRoute(remote.user.role), { replace: true });
        return;
      }

      if (remote.suspended && remote.org) {
        setSuspendedOrgId(remote.org.org_id);
        setSession(null);
        setLoginError("Account Suspended: Contact Support");
        navigate("/suspended", { replace: true });
        return;
      }
    } catch {
      // Fallback to in-memory sandbox flow when API is unavailable.
    }

    const user = users.find((entry) => entry.email.toLowerCase() === email && entry.password === candidate.password);

    if (!user) {
      setLoginError("Invalid email or password");
      return;
    }

    if (user.org_id) {
      const org = organizations.find((entry) => entry.org_id === user.org_id);
      if (org?.subscription_status === "disabled") {
        setSuspendedOrgId(user.org_id);
        setSession(null);
        setLoginError("Account Suspended: Contact Support");
        navigate("/suspended", { replace: true });
        return;
      }
    }

    setSuspendedOrgId(null);
    setLoginError("");

    const nextSession: Session = {
      user_id: user.user_id,
      role: user.role,
      org_id: user.org_id,
      login_at: new Date().toISOString(),
      org_session_rev: user.org_id ? orgSessionRevocations[user.org_id] ?? 0 : undefined
    };

    setSession(nextSession);
    navigate(roleRoute(user.role), { replace: true });
  };

  const handleLogout = () => {
    setSession(null);
    setLoginError("");
    navigate("/login", { replace: true });
  };

  const createOrganization = async (payload: {
    company_name: string;
    owner_name: string;
    owner_email: string;
    owner_password: string;
  }) => {
    const orgId = `ORG_PH_${Math.floor(100 + Math.random() * 900)}`;
    const now = manilaDate();

    const organization: Organization = {
      org_id: orgId,
      company_name: payload.company_name,
      subscription_status: "enabled",
      settings: { ...DEFAULT_ORGANIZATION_SETTINGS },
      updated_at: now,
      created_at: now
    };

    const owner: User = {
      user_id: buildId("USR"),
      org_id: orgId,
      name: payload.owner_name,
      email: payload.owner_email.trim().toLowerCase(),
      password: payload.owner_password,
      role: "Employer",
      created_at: now
    };

    if (session) {
      try {
        const remote = await apiCommand(session.user_id, "createOrganization", {
          org_id: orgId,
          company_name: organization.company_name,
          settings: organization.settings,
          created_at: now,
          updated_at: now,
          owner
        });

        if (remote.ok && remote.state) {
          applyScopedState(remote.state);
          return;
        }
      } catch {
        // fallback
      }
    }

    setOrganizations((prev) => [organization, ...prev]);
    setUsers((prev) => [...prev, owner]);
  };

  const toggleSubscription = async (orgId: string) => {
    const updatedAt = manilaDate();

    if (session) {
      try {
        const remote = await apiCommand(session.user_id, "toggleSubscription", {
          org_id: orgId,
          updated_at: updatedAt
        });
        if (remote.ok && remote.state) {
          applyScopedState(remote.state);
          return;
        }
      } catch {
        // fallback
      }
    }

    setOrganizations((prev) =>
      prev.map((org) => {
        if (org.org_id !== orgId) {
          return org;
        }

        return {
          ...org,
          subscription_status: org.subscription_status === "enabled" ? "disabled" : "enabled",
          updated_at: updatedAt
        };
      })
    );

    setOrgSessionRevocations((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] ?? 0) + 1
    }));
  };

  const addEmployee = async (payload: {
    name: string;
    email: string;
    password: string;
    payroll_mode: PayrollMode;
  }) => {
    if (!currentUser?.org_id || currentUser.role !== "Employer") {
      return;
    }

    const employee: User = {
      user_id: buildId("USR"),
      org_id: currentUser.org_id,
      name: payload.name,
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      role: "Employee",
      payroll_mode: payload.payroll_mode,
      custom_hourly_rate: null,
      custom_monthly_rate: null,
      created_at: manilaDate()
    };

    if (session) {
      try {
        const remote = await apiCommand(session.user_id, "addEmployee", {
          ...employee,
          org_id: currentUser.org_id
        });
        if (remote.ok && remote.state) {
          applyScopedState(remote.state);
          return;
        }
      } catch {
        // fallback
      }
    }

    setUsers((prev) => [...prev, employee]);
  };

  const updateOrganizationSettings = async (settings: OrganizationSettings) => {
    if (!currentUser?.org_id || currentUser.role !== "Employer") {
      return;
    }

    if (session) {
      try {
        const remote = await apiCommand(session.user_id, "updateSettings", {
          org_id: currentUser.org_id,
          settings,
          updated_at: manilaDate()
        });
        if (remote.ok && remote.state) {
          applyScopedState(remote.state);
          return;
        }
      } catch {
        // fallback
      }
    }

    setOrganizations((prev) =>
      prev.map((org) => {
        if (org.org_id !== currentUser.org_id) {
          return org;
        }

        return {
          ...org,
          settings,
          updated_at: manilaDate()
        };
      })
    );
  };

  const finalizeDraft = async (runtimeModes: Record<string, PayrollMode>) => {
    if (!currentUser?.org_id || currentUser.role !== "Employer") {
      return;
    }

    if (session) {
      try {
        const remote = await apiCommand(session.user_id, "finalizeDraft", {
          org_id: currentUser.org_id,
          runtime_modes: normalizeRuntimeModes(runtimeModes)
        });
        if (remote.ok && remote.state) {
          applyScopedState(remote.state);
          return;
        }
      } catch {
        // fallback
      }
    }

    setUsers((prev) =>
      prev.map((user) => {
        if (user.org_id !== currentUser.org_id || user.role !== "Employee") {
          return user;
        }

        const nextMode = runtimeModes[user.user_id];
        if (!nextMode) {
          return user;
        }

        return {
          ...user,
          payroll_mode: nextMode
        };
      })
    );
  };

  const handlePunchClock = async () => {
    if (!currentUser?.org_id || currentUser.role !== "Employee") {
      return;
    }

    const org = organizations.find((item) => item.org_id === currentUser.org_id);
    if (!org) {
      return;
    }

    const activeLog = attendanceLogs.find(
      (log) =>
        log.org_id === currentUser.org_id &&
        log.employee_id === currentUser.user_id &&
        log.clock_out === null
    );

    const nowDate = manilaDate();
    const nowTime = manilaTime();
    const outsideShift = timeOutsideShift(nowTime, org.settings);

    if (session) {
      try {
        if (activeLog) {
          const payload = {
            type: "clockOut",
            org_id: currentUser.org_id,
            log_id: activeLog.log_id,
            clock_out: nowTime,
            total_hours: hoursDiff(activeLog.clock_in, nowTime),
            flags: outsideShift ? outsideShiftFlag(activeLog.flags) : activeLog.flags
          };
          const remote = await apiCommand(session.user_id, "punch", payload);
          if (remote.ok && remote.state) {
            applyScopedState(remote.state);
            return;
          }
        } else {
          const payload = {
            type: "clockIn",
            org_id: currentUser.org_id,
            log_id: buildId("LOG"),
            date: nowDate,
            clock_in: nowTime,
            flags: outsideShift ? ["Outside Shift Hours"] : []
          };
          const remote = await apiCommand(session.user_id, "punch", payload);
          if (remote.ok && remote.state) {
            applyScopedState(remote.state);
            return;
          }
        }
      } catch {
        // fallback
      }
    }

    if (activeLog) {
      setAttendanceLogs((prev) =>
        prev.map((log) => {
          if (log.log_id !== activeLog.log_id) {
            return log;
          }

          return {
            ...log,
            clock_out: nowTime,
            total_hours: hoursDiff(activeLog.clock_in, nowTime),
            flags: outsideShift ? outsideShiftFlag(log.flags) : log.flags
          };
        })
      );
      return;
    }

    const newLog: AttendanceLog = {
      log_id: buildId("LOG"),
      org_id: currentUser.org_id,
      employee_id: currentUser.user_id,
      date: nowDate,
      clock_in: nowTime,
      clock_out: null,
      total_hours: null,
      flags: outsideShift ? ["Outside Shift Hours"] : []
    };

    setAttendanceLogs((prev) => [newLog, ...prev]);
  };

  const loginPage = (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Attendance and Payroll SaaS</h1>
          <p className="text-sm text-slate-500">Unified Authentication Gateway</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <input
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Email"
            value={login.email}
            onChange={(event) => setLogin((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Password"
            value={login.password}
            onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))}
            required
          />

          {loginError && <p className="text-sm font-medium text-rose-700">{loginError}</p>}

          <button className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Sign In
          </button>
        </form>

        {SANDBOX_MODE && (
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sandbox Quick Access</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => void handleLogin({ email: "admin@platform.com", password: "admin123" })}
                className="rounded-md border px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                Super Admin
              </button>
              <button
                onClick={() => void handleLogin({ email: "employer@manila.tech", password: "employer123" })}
                className="rounded-md border px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                Employer (Enabled Tenant)
              </button>
              <button
                onClick={() => void handleLogin({ email: "juan@manila.tech", password: "juan123" })}
                className="rounded-md border px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                Employee (Enabled Tenant)
              </button>
              <button
                onClick={() => void handleLogin({ email: "owner@cebu.group", password: "owner123" })}
                className="rounded-md border px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                Employer (Disabled Tenant)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const isAuthenticated = Boolean(session && currentUser);

  const guard = (role: Session["role"], element: React.ReactNode) => {
    if (!isAuthenticated || !session) {
      return <Navigate to="/login" replace />;
    }

    if (session.role !== role) {
      return <Navigate to={roleRoute(session.role)} replace />;
    }

    if (role !== "SuperAdmin" && currentOrganization?.subscription_status === "disabled") {
      return <Navigate to="/suspended" replace />;
    }

    return <>{element}</>;
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={loginPage} />
      <Route path="/suspended" element={<SuspendedScreen companyName={suspendedOrg?.company_name} />} />

      <Route
        path="/admin"
        element={guard(
          "SuperAdmin",
          <div>
            <div className="border-b bg-slate-900 px-4 py-2 text-xs text-white">
              Version {APP_VERSION}
              {SANDBOX_MODE ? " - Sandbox Mode Enabled" : ""}
            </div>
            <SuperAdminPortal
              organizations={organizations}
              users={users}
              onCreateOrganization={(payload) => void createOrganization(payload)}
              onToggleSubscription={(orgId) => void toggleSubscription(orgId)}
              onLogout={handleLogout}
            />
          </div>
        )}
      />

      <Route
        path="/client/employer"
        element={guard(
          "Employer",
          <MobileShell>
            {currentUser && currentOrganization && (
              <EmployerDashboard
                employer={currentUser}
                organization={currentOrganization}
                users={orgScopedUsers}
                logs={orgScopedLogs}
                dateRange={dateRange}
                onChangeDateRange={setDateRange}
                onAddEmployee={(payload: { name: string; email: string; password: string; payroll_mode: PayrollMode }) =>
                  void addEmployee(payload)}
                onUpdateOrganizationSettings={(settings: OrganizationSettings) => void updateOrganizationSettings(settings)}
                onFinalizeDraft={(runtimeModes: Record<string, PayrollMode>) => void finalizeDraft(runtimeModes)}
                onLogout={handleLogout}
              />
            )}
          </MobileShell>
        )}
      />

      <Route
        path="/client/employee"
        element={guard(
          "Employee",
          <MobileShell>
            {currentUser && currentOrganization && (
              <EmployeeConsole
                user={currentUser}
                organization={currentOrganization}
                logs={orgScopedLogs.filter((log) => log.employee_id === currentUser.user_id)}
                onPunch={() => void handlePunchClock()}
                onLogout={handleLogout}
              />
            )}
          </MobileShell>
        )}
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
