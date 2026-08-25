import { redirect } from "next/navigation"

// 旧路径。现在首页的创建页已经支持自动识别链接 / 文本。
// 保留这个路由作为旧链接的兼容,直接回到首页。
export default function TextShareRedirect() {
  redirect("/")
}
