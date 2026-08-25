import { redirect } from "next/navigation"

export default function OldSettingsRedirect() {
  redirect("/admin/settings")
}
