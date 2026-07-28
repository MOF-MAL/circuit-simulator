import path from "node:path";
import { BrowserWindow, app, dialog } from "electron";
import { startStaticServer } from "./static-server";

// 固定ポートで待受ける static-server と組み合わせるため、多重起動を防ぐ。
// 2プロセス目がポートの取得に失敗し読み込みが止まったまま
// 空白ウィンドウとして残ってしまうのを防ぐのが目的。
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  async function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    try {
      if (!app.isPackaged) {
        await mainWindow.loadURL("http://localhost:3000");
      } else {
        const outDir = path.join(__dirname, "../out");
        const url = await startStaticServer(outDir);
        await mainWindow.loadURL(url);
      }
    } catch (err) {
      dialog.showErrorBox(
        "起動エラー",
        `アプリの読み込みに失敗しました。\n${(err as Error).message}`,
      );
      mainWindow.close();
    }
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
