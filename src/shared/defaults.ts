import { OrganizationSettings } from "./types";

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  currency: "PHP",
  work_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shift_start: "08:00",
  shift_end: "17:00",
  default_hourly_rate: 300,
  default_monthly_rate: 12000,
  max_hours_per_month: 40
};
