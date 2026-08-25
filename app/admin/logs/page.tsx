import { listRecentLogs } from "@/lib/db"
import { LogsClient } from "./logs-client"

export const dynamic = "force-dynamic"

export default async function AdminLogsPage() {
  const logs = await listRecentLogs(500)
  return <LogsClient initialLogs={logs} />
}
