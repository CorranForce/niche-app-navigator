import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listReports from "./tools/list-reports";
import getReport from "./tools/get-report";
import getAccountStatus from "./tools/get-account-status";
import listUseCases from "./tools/list-use-cases";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "niche-app-navigator",
  title: "Niche App Navigator",
  version: "0.1.0",
  instructions:
    "Tools for the MicroSaaS Solution Finder. Use `list_use_cases` for the public pain-point catalogue, and `list_reports` / `get_report` / `get_account_status` for the signed-in user's saved niche reports and plan usage.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listUseCases, listReports, getReport, getAccountStatus],
});
