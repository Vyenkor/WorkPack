from pathlib import Path
import json
import struct
import unittest


ROOT = Path(__file__).resolve().parents[1]
BUILD = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["build"]
SCRIPTS = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]
INCLUDE = ROOT / "build" / "installer.nsh"
SMOKE = ROOT / "scripts" / "installer-smoke.ps1"


class InstallerConfigTest(unittest.TestCase):
    def test_release_version_matches_lockfile(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(package["version"], lock["version"])
        self.assertEqual(package["version"], lock["packages"][""]["version"])

    def test_assisted_installer_lets_users_choose_the_directory(self):
        nsis = BUILD["nsis"]
        self.assertIs(nsis["oneClick"], False)
        self.assertIs(nsis["perMachine"], False)
        self.assertIs(nsis["allowToChangeInstallationDirectory"], True)
        self.assertEqual(nsis["installerLanguages"], ["zh_CN"])
        self.assertEqual(nsis["language"], "2052")
        self.assertEqual(nsis["uninstallDisplayName"], "WorkPack")
        self.assertEqual(nsis["shortcutName"], "WorkPack")
        self.assertIs(nsis["createStartMenuShortcut"], True)
        self.assertIs(nsis["deleteAppDataOnUninstall"], False)

    def test_desktop_shortcut_is_an_optional_task(self):
        self.assertIs(BUILD["nsis"]["createDesktopShortcut"], True)
        self.assertEqual(BUILD["nsis"]["include"], "build/installer.nsh")
        raw = INCLUDE.read_bytes()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"), "NSIS 需要 UTF-8 BOM 才能正确读取中文")
        text = raw.decode("utf-8-sig")
        self.assertIn("!ifndef BUILD_UNINSTALLER", text)
        self.assertIn("!macro customPageAfterChangeDir", text)
        self.assertIn("创建桌面快捷方式", text)
        self.assertIn("${NSD_CreateCheckbox}", text)
        install = text[text.index("!macro customInstall"):]
        self.assertIn('Delete "$newDesktopLink"', install)

    def test_uninstall_entry_records_location_and_empty_parent_is_removed(self):
        text = INCLUDE.read_text(encoding="utf-8-sig")
        install = text[text.index("!macro customInstall"):text.index("!macroend", text.index("!macro customInstall"))]
        self.assertIn('WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"', install)
        uninstall = text[text.index("!macro customHeader"):]
        self.assertIn("!ifdef BUILD_UNINSTALLER", uninstall)
        self.assertIn("Function un.onUninstSuccess", uninstall)
        self.assertIn("${isUpdated}", uninstall)
        self.assertIn('$LOCALAPPDATA\\Programs', uninstall)
        self.assertIn('RMDir "$0"', uninstall)
        self.assertNotIn("RMDir /r", uninstall)

    def test_optional_workspace_cleanup_is_narrow_and_skips_silent_uninstall(self):
        text = INCLUDE.read_text(encoding="utf-8-sig")
        self.assertIn("!macro customUnWelcomePage", text)
        self.assertIn("UninstPage custom un.WorkPackDataPageCreate un.WorkPackDataPageLeave", text)
        self.assertIn("删除工作空间记录（默认不删除）", text)
        cleanup = text.split("Function un.onUninstSuccess", 1)[1].split("${GetParent}", 1)[0]
        self.assertIn("${IfNot} ${Silent}", cleanup)
        self.assertIn('$WorkPackDeleteWorkspaceData == "1"', cleanup)
        self.assertIn("${isUpdated}", cleanup)
        self.assertIn('Delete "$APPDATA\\WorkPack\\workpack-v3.sqlite"', cleanup)
        self.assertNotIn('Delete "$APPDATA\\WorkPack\\workpack.sqlite"', cleanup)
        self.assertNotIn('Delete "$APPDATA\\WorkPack\\workpack.sqlite-wal"', cleanup)
        self.assertIn('Delete "$APPDATA\\WorkPack\\storage.json"', cleanup)
        self.assertNotIn('RMDir /r', cleanup)
        self.assertNotIn('templates', cleanup.lower())
        self.assertNotIn('$INSTDIR', cleanup)

    def test_package_only_ships_what_the_installed_app_needs(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(package["dependencies"]), ["better-sqlite3", "zod"],
                         "渲染进程依赖由 Vite 打包，放进 dependencies 会被重复装进 app.asar")
        for name in ["vue", "element-plus"]:
            with self.subTest(name=name):
                self.assertIn(name, package["devDependencies"])
        self.assertEqual(BUILD["electronLanguages"], ["zh-CN", "en-US"])
        self.assertIn("!node_modules/better-sqlite3/{deps,src}/**", BUILD["files"])

    def test_executable_gets_the_icon_without_requiring_a_certificate(self):
        win = BUILD["win"]
        self.assertNotIn("signAndEditExecutable", win)
        self.assertIs(win["signExecutable"], False)
        self.assertEqual(win["icon"], "build/icon.ico")
        icon = (ROOT / "build" / "icon.ico").read_bytes()
        reserved, kind, count = struct.unpack("<HHH", icon[:6])
        self.assertEqual((reserved, kind), (0, 1))
        sizes = set()
        for index in range(count):
            width, height = icon[6 + index * 16], icon[7 + index * 16]
            sizes.add((width or 256, height or 256))
        for size in [(16, 16), (32, 32), (48, 48), (256, 256)]:
            with self.subTest(size=size):
                self.assertIn(size, sizes)

    def test_packaging_never_publishes(self):
        for script in ["pack", "dist"]:
            with self.subTest(script=script):
                self.assertIn("--publish never", SCRIPTS[script])
        self.assertIn("electron-builder --win nsis", SCRIPTS["dist"])

    def test_smoke_script_covers_install_launch_and_uninstall(self):
        text = SMOKE.read_text(encoding="utf-8-sig")
        for needle in ["/S /currentuser", "/D=$installDir", "Uninstall WorkPack.exe", "better_sqlite3.node", "--no-desktop-shortcut",
                       "WORKPACK_INSTALLED_EXE", "tests/installed-app.spec.ts", "InstallLocation", "-not (Test-Path $root)", "Uninstall-WorkPack -ExpectParentRemoved", "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"]:
            with self.subTest(needle=needle):
                self.assertIn(needle, text)
        self.assertTrue(SMOKE.read_bytes().startswith(b"\xef\xbb\xbf"), "Windows PowerShell 5.1 需要 BOM 才能按 UTF-8 读取中文")
        spec = (ROOT / "tests" / "installed-app.spec.ts").read_text(encoding="utf-8")
        self.assertIn("test.skip(!installedExe", spec)
        self.assertIn("app.isPackaged", spec)
        self.assertIn("scripts/check-installer-asar.cjs", text)
        scanner = (ROOT / "scripts" / "check-installer-asar.cjs").read_text(encoding="utf-8")
        self.assertIn("listPackage(archive)", scanner)
        self.assertIn("extractFile(archive, path.normalize(file))", scanner)
        self.assertIn("workpack.sqlite", scanner)


if __name__ == "__main__":
    unittest.main()
