const { contextBridge } = require("electron");
const API_PORT = process.env.API_PORT || 3001;
contextBridge.exposeInMainWorld("APP_CONFIG", { apiBase: `http://127.0.0.1:${API_PORT}` });
