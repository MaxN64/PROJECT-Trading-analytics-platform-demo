// electron/main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let serverProc;
const API_PORT = process.env.API_PORT || "3001";

function startServer() {
  const isPackaged = app.isPackaged;
  const base = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

  const serverEntry  = path.join(base, "mes-calc-backend", "server", "src", "index.js");
  const backendCwd   = path.join(base, "mes-calc-backend"); // чтобы подхватился его package.json/ESM
  const frontendDist = path.join(base, "mes-calc-frontend", "build");

  serverProc = spawn(process.execPath, [serverEntry], {
    cwd: backendCwd,
    env: {
      ...process.env,
      PORT: API_PORT,
      HOST: "127.0.0.1",
      NODE_ENV: isPackaged ? "production" : "development",
      FRONTEND_DIST: isPackaged ? frontendDist : "" // в prod бэк раздаёт собранный фронт
    },
    stdio: "inherit",
    windowsHide: true
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    win.loadURL(`http://127.0.0.1:${API_PORT}`); // бэк отдаёт фронт
  } else {
    win.loadURL("http://localhost:3000");        // CRA dev
  }
}

app.whenReady().then(() => { startServer(); createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("quit", () => { try { serverProc && serverProc.kill(); } catch {} });
