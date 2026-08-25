/*!
 * ~/short-link embed widget
 * 用法:
 *   <div data-shortlink-code="abc123"></div>
 *   <script async src="https://your-host/embed.js"></script>
 *
 * 可选属性:
 *   data-shortlink-host="https://your-host"   // 跨域时指定 host
 *   data-shortlink-theme="auto|light|dark"    // 默认 auto
 *
 * 脚本会在每个匹配元素内插入一个 iframe(loading=lazy,sandbox),
 * 高度通过 postMessage 由嵌入页上报。
 */
(function () {
  var SCRIPT = document.currentScript
  var HOST = (SCRIPT && SCRIPT.src && new URL(SCRIPT.src).origin) || ""

  function findHost() {
    var override = document.querySelector("[data-shortlink-host]")
    if (override) return override.getAttribute("data-shortlink-host") || HOST
    return HOST
  }

  function buildUrl(host, code) {
    return host.replace(/\/+$/, "") + "/embed/" + encodeURIComponent(code)
  }

  function mount(el) {
    if (el.dataset.shortlinkMounted === "1") return
    var code = el.getAttribute("data-shortlink-code")
    if (!code) return
    var host = findHost()
    var iframe = document.createElement("iframe")
    iframe.src = buildUrl(host, code)
    iframe.loading = "lazy"
    iframe.referrerPolicy = "no-referrer-when-downgrade"
    iframe.sandbox = "allow-same-origin allow-scripts"
    iframe.title = "Shared content " + code
    iframe.style.width = "100%"
    iframe.style.border = "0"
    iframe.style.display = "block"
    iframe.style.minHeight = "120px"
    el.appendChild(iframe)
    el.dataset.shortlinkMounted = "1"
  }

  function mountAll() {
    var nodes = document.querySelectorAll("[data-shortlink-code]")
    for (var i = 0; i < nodes.length; i++) mount(nodes[i])
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll)
  } else {
    mountAll()
  }

  // embed 页面通过 postMessage 上报高度
  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return
    if (event.data.type !== "shortlink:resize") return
    var iframe = Array.from(document.querySelectorAll("iframe")).find(function (f) {
      return f.contentWindow === event.source
    })
    if (iframe && typeof event.data.height === "number") {
      iframe.style.height = event.data.height + "px"
    }
  })
})()
