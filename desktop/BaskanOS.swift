import Cocoa
import WebKit
import Darwin

private let host = "127.0.0.1"
private let pidPath = "/tmp/com.baskaniyazilim.baskanos.pid"
private let supportFolderName = "BaskanOS"

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var statusLabel: NSTextField?
    private var server: Process?
    private var pollTimer: Timer?
    private var watchdog: Timer?
    private var startedAt = Date()
    private var logHandle: FileHandle?
    private var port = 0
    private var needsReload = false
    private var restarting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMenu()
        openWindow()
        if #available(macOS 14, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.boot()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            openWindow()
            if server?.isRunning != true {
                DispatchQueue.global(qos: .userInitiated).async { [weak self] in self?.boot() }
            } else if port > 0 {
                DispatchQueue.main.async { [weak self] in
                    self?.loadApp(port: self?.port ?? 0)
                }
            }
        }
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        pollTimer?.invalidate()
        watchdog?.invalidate()
        stopServer()
        try? FileManager.default.removeItem(atPath: pidPath)
    }

    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "BaskanOS Hakkında", action: #selector(showAbout), keyEquivalent: ""))
        appMenu.addItem(.separator())
        appMenu.addItem(NSMenuItem(title: "BaskanOS'tan Çık", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        main.addItem(editItem)
        let editMenu = NSMenu(title: "Düzen")
        editMenu.addItem(NSMenuItem(title: "Geri Al", action: Selector(("undo:")), keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "Yinele", action: Selector(("redo:")), keyEquivalent: "Z"))
        editMenu.addItem(.separator())
        editMenu.addItem(NSMenuItem(title: "Kes", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Kopyala", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Yapıştır", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Tümünü Seç", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editItem.submenu = editMenu

        let viewItem = NSMenuItem()
        main.addItem(viewItem)
        let viewMenu = NSMenu(title: "Görünüm")
        viewMenu.addItem(NSMenuItem(title: "Yenile", action: #selector(reloadPage), keyEquivalent: "r"))
        viewItem.submenu = viewMenu

        let windowItem = NSMenuItem()
        main.addItem(windowItem)
        let windowMenu = NSMenu(title: "Pencere")
        windowMenu.addItem(NSMenuItem(title: "Küçült", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m"))
        windowMenu.addItem(NSMenuItem(title: "Yakınlaştır", action: #selector(NSWindow.zoom(_:)), keyEquivalent: ""))
        windowItem.submenu = windowMenu
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = main
    }

    @objc private func showAbout() {
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "BaskanOS",
            .applicationVersion: "0.1.0",
            .credits: NSAttributedString(string: "Baskani Yazılım · Ajan işletim sistemi\nSwift penceresi + yerel Next.js sunucusu")
        ])
    }

    @objc private func reloadPage() { webView?.reload() }

    private func openWindow() {
        if let window, window.isVisible {
            window.makeKeyAndOrderFront(nil)
            return
        }

        let frame = NSRect(x: 40, y: 40, width: 1360, height: 860)
        let window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "BaskanOS"
        window.minSize = NSSize(width: 1100, height: 720)
        window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(calibratedRed: 0.043, green: 0.071, blue: 0.063, alpha: 1)

        let label = NSTextField(labelWithString: "BaskanOS başlatılıyor…")
        label.font = NSFont.systemFont(ofSize: 18, weight: .medium)
        label.textColor = NSColor(calibratedRed: 0.91, green: 0.94, blue: 0.91, alpha: 1)
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        let container = NSView(frame: frame)
        container.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.widthAnchor.constraint(lessThanOrEqualTo: container.widthAnchor, constant: -48)
        ])
        window.contentView = container
        window.makeKeyAndOrderFront(nil)
        self.window = window
        self.statusLabel = label

        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = .default()
        let webView = WKWebView(frame: frame, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        self.webView = webView
    }

    private func setStatus(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.statusLabel?.stringValue = text
            self?.statusLabel?.isHidden = false
        }
    }

    private func resourcesURL() -> URL {
        Bundle.main.resourceURL ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    }

    private func supportDir() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = base.appendingPathComponent(supportFolderName, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func parseEnvFile(_ url: URL) -> [String: String] {
        guard let raw = try? String(contentsOf: url, encoding: .utf8) else { return [:] }
        var out: [String: String] = [:]
        for line in raw.split(whereSeparator: \.isNewline) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            guard let eq = trimmed.firstIndex(of: "=") else { continue }
            let key = String(trimmed[..<eq]).trimmingCharacters(in: .whitespaces)
            var value = String(trimmed[trimmed.index(after: eq)...]).trimmingCharacters(in: .whitespaces)
            if (value.hasPrefix("\"") && value.hasSuffix("\"")) || (value.hasPrefix("'") && value.hasSuffix("'")) {
                value = String(value.dropFirst().dropLast())
            }
            if !key.isEmpty { out[key] = value }
        }
        return out
    }

    private func loadAppEnv() throws -> [String: String] {
        let supportEnv = try supportDir().appendingPathComponent(".env")
        let bundled = resourcesURL().appendingPathComponent("app.env")
        if !FileManager.default.fileExists(atPath: supportEnv.path),
           FileManager.default.fileExists(atPath: bundled.path) {
            try FileManager.default.copyItem(at: bundled, to: supportEnv)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: supportEnv.path)
        }
        var merged = parseEnvFile(bundled)
        for (k, v) in parseEnvFile(supportEnv) { merged[k] = v }
        return merged
    }

    private func findNode() -> String? {
        let resources = resourcesURL()
        let candidates = [
            resources.appendingPathComponent("node/bin/node").path,
            resources.appendingPathComponent("bin/node").path,
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node"
        ]
        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return nil
    }

    private func killStaleServer() {
        guard let raw = try? String(contentsOfFile: pidPath, encoding: .utf8),
              let pid = Int32(raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              pid > 1 else { return }
        kill(pid, SIGTERM)
        usleep(200_000)
        kill(pid, SIGKILL)
        try? FileManager.default.removeItem(atPath: pidPath)
    }

    private func freePort() throws -> Int {
        let sock = socket(AF_INET, SOCK_STREAM, 0)
        guard sock >= 0 else {
            throw NSError(domain: "BaskanOS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Soket açılamadı."])
        }
        defer { close(sock) }
        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = 0
        addr.sin_addr = in_addr(s_addr: inet_addr(host))
        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindResult == 0 else {
            throw NSError(domain: "BaskanOS", code: 2, userInfo: [NSLocalizedDescriptionKey: "Boş port yok."])
        }
        var len = socklen_t(MemoryLayout<sockaddr_in>.size)
        _ = withUnsafeMutablePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(sock, $0, &len) }
        }
        return Int(UInt16(bigEndian: addr.sin_port))
    }

    private func serverEnv(port: Int) throws -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        for (k, v) in try loadAppEnv() { env[k] = v }
        env["NODE_ENV"] = "production"
        env["HOSTNAME"] = host
        env["PORT"] = String(port)
        let support = try supportDir().path
        env["BASKANOS_DATA_DIR"] = support
        // Prefer project source tree for agent cwd when bundled path is standalone
        if env["BASKANOS_DEFAULT_CWD"] == nil || env["BASKANOS_DEFAULT_CWD"]?.isEmpty == true {
            env["BASKANOS_DEFAULT_CWD"] = "/Users/yusufbaskani/Projects/Baskani Yazılım/BaskanOS"
        }
        let modules = resourcesURL().appendingPathComponent("standalone/node_modules").path
        env["NODE_PATH"] = modules
        return env
    }

    private func boot() {
        do {
            setStatus("BaskanOS hazırlanıyor…")
            let chosen = try freePort()
            port = chosen
            try startServer(port: chosen)
            DispatchQueue.main.async { [weak self] in
                self?.beginPolling()
                self?.beginWatchdog()
            }
        } catch {
            setStatus("BaskanOS açılamadı.\n\(error.localizedDescription)")
        }
    }

    private func startServer(port: Int) throws {
        stopServer()
        killStaleServer()
        startedAt = Date()
        guard let node = findNode() else {
            throw NSError(
                domain: "BaskanOS",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Node.js bulunamadı. Uygulamayı `npm run desktop:swift` ile yeniden paketleyin."]
            )
        }
        let standalone = resourcesURL().appendingPathComponent("standalone")
        let serverJs = standalone.appendingPathComponent("server.js")
        guard FileManager.default.fileExists(atPath: serverJs.path) else {
            throw NSError(domain: "BaskanOS", code: 4, userInfo: [NSLocalizedDescriptionKey: "Sunucu paketi eksik. npm run desktop:swift çalıştırın."])
        }

        let logDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/BaskanOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let logURL = logDir.appendingPathComponent("server.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        logHandle = FileHandle(forWritingAtPath: logURL.path)
        logHandle?.seekToEndOfFile()

        let task = Process()
        task.executableURL = URL(fileURLWithPath: node)
        task.arguments = [serverJs.path]
        task.currentDirectoryURL = standalone
        task.environment = try serverEnv(port: port)
        if let logHandle {
            task.standardOutput = logHandle
            task.standardError = logHandle
        }
        try task.run()
        server = task
        try? String(task.processIdentifier).write(toFile: pidPath, atomically: true, encoding: .utf8)
        setStatus("Sunucu açılıyor…")
    }

    private func stopServer() {
        if let server, server.isRunning {
            server.terminate()
            server.waitUntilExit()
        }
        server = nil
    }

    private func beginPolling() {
        pollTimer?.invalidate()
        let timer = Timer(timeInterval: 0.35, repeats: true) { [weak self] _ in
            self?.checkHealth()
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
    }

    private func beginWatchdog() {
        watchdog?.invalidate()
        let timer = Timer(timeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.watchServer()
        }
        RunLoop.main.add(timer, forMode: .common)
        watchdog = timer
    }

    private func watchServer() {
        guard !restarting else { return }
        if server?.isRunning != true {
            restarting = true
            needsReload = true
            setStatus("Sunucu kapandı, yeniden başlatılıyor…")
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                defer { self?.restarting = false }
                do {
                    let chosen = try self?.freePort() ?? 0
                    self?.port = chosen
                    try self?.startServer(port: chosen)
                    DispatchQueue.main.async { self?.beginPolling() }
                } catch {
                    self?.setStatus("Yeniden başlatılamadı.\n\(error.localizedDescription)")
                }
            }
        }
    }

    private func checkHealth() {
        guard port > 0, let url = URL(string: "http://\(host):\(port)/") else { return }
        var request = URLRequest(url: url, timeoutInterval: 2)
        request.httpMethod = "GET"
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            guard let self else { return }
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if (200..<500).contains(code) {
                DispatchQueue.main.async {
                    self.pollTimer?.invalidate()
                    self.pollTimer = nil
                    self.loadApp(port: self.port)
                }
            } else if Date().timeIntervalSince(self.startedAt) > 60 {
                DispatchQueue.main.async {
                    self.pollTimer?.invalidate()
                    self.setStatus("Sunucu zaman aşımı.\n~/Library/Logs/BaskanOS/server.log")
                }
            }
        }.resume()
    }

    private func loadApp(port: Int) {
        guard let webView, let window, port > 0 else { return }
        guard let url = URL(string: "http://\(host):\(port)/") else { return }
        statusLabel?.isHidden = true
        webView.frame = window.contentView?.bounds ?? webView.frame
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView
        if needsReload || webView.url == nil || webView.url?.port != port {
            webView.load(URLRequest(url: url))
            needsReload = false
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.host == host {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "http" || url.scheme == "https" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
