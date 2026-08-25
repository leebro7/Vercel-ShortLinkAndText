import { listItems } from "@/lib/db"
import { ItemsClient } from "./items-client"

export const dynamic = "force-dynamic"

export default async function AdminItemsPage() {
  const items = await listItems()
  return <ItemsClient initialItems={items} />
}
