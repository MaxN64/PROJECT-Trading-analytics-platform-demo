import React, { useEffect, useRef, useState } from "react";
import styles from "./VoiceNote.module.css";

export default function VoiceNote({ value, onSave, onDelete }) {
  const [perm, setPerm] = useState("unknown"); // prompt|granted|denied|unknown
  const [devices, setDevices] = useState([]);  // [{deviceId,label}]
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem("voice_deviceId") || "");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const streamRef   = useRef(null);
  const rafRef      = useRef(0);
  const startTsRef  = useRef(0);

  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);

  // Источник для плеера (data:/http(s)/blob:)
  const [playSrc, setPlaySrc] = useState(value || "");
  const audioRef = useRef(null);
  const previewUrlRef = useRef(""); // локальный blob: URL для revoke

  // -------- permissions + devices ----------
  useEffect(() => {
    let cancelled = false;

    const checkPerm = async () => {
      try {
        if (navigator.permissions?.query) {
          const st = await navigator.permissions.query({ name: "microphone" });
          if (!cancelled) setPerm(st.state);
          st.onchange = () => setPerm(st.state);
        } else {
          setPerm("unknown");
        }
      } catch {
        setPerm("unknown");
      }
    };

    const listDevices = async () => {
      try {
        const list = await navigator.mediaDevices?.enumerateDevices?.();
        const mics = (list || []).filter(d => d.kind === "audioinput");
        setDevices(mics.map(d => ({ deviceId: d.deviceId, label: d.label || "Микрофон" })));
      } catch {}
    };

    checkPerm();
    listDevices();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem("voice_deviceId", deviceId || "");
  }, [deviceId]);

  // -------- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ --------
  // Сбрасываем/обновляем локальный источник при ЛЮБОМ изменении value,
  // включая переход к записи, где аудио нет (value пустое/undefined).
  useEffect(() => {
    const next = value || "";
    setPlaySrc(next);

    // Если раньше показывали локальный blob: предпросмотр — очистим его,
    // чтобы он не «прилипал» к следующей сделке.
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
  }, [value]);
  // ---------------------------------------

  // Принудительно перезагружаем <audio> при смене источника
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.pause();
      el.src = playSrc || "";
      el.load();
    } catch {}
  }, [playSrc]);

  function canPlay(mime) {
    const a = document.createElement("audio");
    return !!a.canPlayType && a.canPlayType(mime) !== "";
  }

  function pickSupportedMime() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4" // Safari
    ];
    for (const t of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(t) && canPlay(t)) return t;
    }
    return "";
  }

  async function refreshDevices() {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices?.();
      const mics = (list || []).filter(d => d.kind === "audioinput");
      setDevices(mics.map(d => ({ deviceId: d.deviceId, label: d.label || "Микрофон" })));
      if (deviceId && !mics.some(m => m.deviceId === deviceId)) setDeviceId("");
    } catch {}
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Запись не поддерживается этим браузером.");
      return;
    }
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {})
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      refreshDevices();
      setPerm("granted");

      const mimeType = pickSupportedMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecRef.current = rec;
      chunksRef.current = [];
      startTsRef.current = Date.now();
      setDurationMs(0);

      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleStop;

      // индикатор уровня
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      drawLevel();

      rec.start(250);
      setIsRecording(true);

      const tick = () => {
        setDurationMs(Date.now() - startTsRef.current);
        if (mediaRecRef.current && mediaRecRef.current.state === "recording") requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      if (e?.name === "NotAllowedError") {
        setPerm("denied");
        setError("Доступ к микрофону запрещён. Разрешите доступ для сайта и перезагрузите страницу.");
      } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
        setError("Микрофон не найден или выбранное устройство недоступно. Выберите другой микрофон.");
      } else {
        setError("Не удалось начать запись: " + (e?.message || String(e)));
      }
      cleanup();
    }
  }

  function drawLevel() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      setLevel(Math.sqrt(sum / data.length));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function stop() {
    if (mediaRecRef.current && mediaRecRef.current.state === "recording") mediaRecRef.current.stop();
  }

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
    if (audioCtxRef.current)  { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current  = null; }
    if (streamRef.current)    { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    mediaRecRef.current = null;
    setIsRecording(false);
    setLevel(0);
  }

  function handleStop() {
    const mime = mediaRecRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current || [], { type: mime });
    chunksRef.current = [];

    if (!blob || blob.size === 0) {
      setError("Пустая запись: устройство молчит или доступ запрещён.");
      cleanup();
      return;
    }

    // Локальный предпросмотр
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    const localUrl = URL.createObjectURL(blob);
    previewUrlRef.current = localUrl;
    setPlaySrc(localUrl);
    audioRef.current?.load();

    // Отдаём наверх как data: URL (как было)
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      onSave?.(dataUrl, { mimeType: mime, size: blob.size, durationMs: Date.now() - startTsRef.current });
      cleanup();
    };
    reader.readAsDataURL(blob);
  }

  // Удаление: чистим источник и blob:URL
  function handleDelete() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPlaySrc("");
    onDelete?.();
  }

  // Чистим blob:URL при размонтировании
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onAudioError(e) {
    const err = e?.currentTarget?.error;
    if (!err) return;
    const map = {
      1: "Воспроизведение прервано пользователем.",
      2: "Сетевой сбой при загрузке аудио.",
      3: "Ошибка декодирования: формат не поддерживается.",
      4: "Источник не найден или заблокирован."
    };
    setError(map[err.code] || "Ошибка аудио-плеера.");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <span className={styles.perm}>
          Доступ к микрофону: <b>{perm}</b>
        </span>
        <div className={styles.devSel}>
          <label>Микрофон:</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            onFocus={refreshDevices}
          >
            <option value="">По умолчанию</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
          <button className={styles.refresh} type="button" onClick={refreshDevices}>↻</button>
        </div>
      </div>

      {error && <div className={styles.err}>{error}</div>}

      <div className={styles.controls}>
        {!isRecording ? (
          <button className={styles.recBtn} type="button" onClick={start}>● Запись</button>
        ) : (
          <button className={styles.stopBtn} type="button" onClick={stop}>■ Стоп</button>
        )}

        <div className={styles.meter}>
          <div className={styles.meterFill} style={{ transform: `scaleX(${Math.min(1, level * 3).toFixed(3)})` }} />
        </div>

        {isRecording && <div className={styles.timer}>{formatMs(durationMs)}</div>}
      </div>

      {playSrc ? (
        <div className={styles.playerRow}>
          <audio
            ref={audioRef}
            className={styles.player}
            controls
            preload="metadata"
            crossOrigin="use-credentials"
            onError={onAudioError}
          />
          <button className={styles.delBtn} type="button" onClick={handleDelete}>Удалить</button>
        </div>
      ) : (
        <div className={styles.hint}>
          Нажмите «Запись», скажите комментарий, затем «Стоп».
          Если диалог не появляется — разрешите доступ к микрофону в настройках сайта.
        </div>
      )}
    </div>
  );
}

function formatMs(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}
