/* =========================================================
   CONFIG
   ========================================================= */
const DEMO_MODE = __DEMO__;
const LOGO_SRC = "__LOGO__";
const SELECTED_DIALECT = "__DIALECT__";
const SELECTED_STATE = "__STATE_ID__";
const SELECTED_LANGUAGE = "__LANGUAGE_ID__";
const SELECTED_DIALECT_ID = "__DIALECT_ID__";   // dialect chosen on the Select Dialect screen
const demo = DEMO_MODE ? (window.TekvaaniDemo || null) : null;   // browser-only demo (demo.js), null when removed
const VAD = { minThreshold: 0.015, maxThreshold: 0.06, startMs: 120, silenceMs: 1300, minSpeechMs: 350, settleMs: 700 };
const S = { IDLE: "IDLE", LISTENING: "LISTENING", THINKING: "THINKING", SPEAKING: "SPEAKING", ENDED: "ENDED" };

const $ = id => document.getElementById(id);
const app = $("app"), titleEl = $("title"), subEl = $("sub"), noticeEl = $("notice"), chatEl = $("chat");
const startBtn = $("startBtn"), endBtn = $("endBtn"), eqEl = $("eq");
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let state = S.IDLE, session = 0, starting = false, listenMode = "first", userSpeaking = false, msgCount = 0;
let micStream = null, audioCtx = null, analyser = null, micLevel = 0, vadTimer = null, vad = {};
let mediaRecorder = null, recordedChunks = [];
let currentAudio = null, speechPulse = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isActive = () => state === S.LISTENING || state === S.THINKING || state === S.SPEAKING;
const alive = id => id === session && state !== S.IDLE && state !== S.ENDED;

/* logo: the PNG has a light-gray background, so it is made transparent once here
   (no image editing needed) and the clean copy is shared by every spot. */
function removeLogoBackground(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const k = Math.min(1, 700 / img.naturalWidth);
                const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
                const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
                const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, w, h);
                const im = cx.getImageData(0, 0, w, h), px = im.data;
                for (let i = 0; i < px.length; i += 4) {
                    const mn = Math.min(px[i], px[i + 1], px[i + 2]), mx = Math.max(px[i], px[i + 1], px[i + 2]);
                    if (mx - mn < 16 && mn > 205) px[i + 3] = mn >= 238 ? 0 : Math.round(px[i + 3] * (238 - mn) / 33);
                }
                cx.putImageData(im, 0, 0);
                resolve(cv.toDataURL("image/png"));
            } catch (_) { resolve(src); }
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
}
const logoImgs = document.querySelectorAll(".logo-img");
if (LOGO_SRC) {
    removeLogoBackground(LOGO_SRC).then(clean => logoImgs.forEach(img => { img.src = clean; img.classList.add("ready"); }));
} else {
    logoImgs.forEach(img => { const w = document.createElement("span"); w.className = "wordmark"; w.textContent = "Tekvaani"; img.replaceWith(w); });
}

/* =========================================================
   STATE -> SCREEN
   ========================================================= */
function setState(next) { state = next; render(); }

function render() {
    app.dataset.state = state;
    app.classList.toggle("has-chat", isActive() && msgCount > 0);
    let t, s;
    if (state === S.IDLE)           { t = "Talk to Tekvaani"; s = "Tap the button and speak naturally."; }
    else if (state === S.LISTENING) {
        t = (userSpeaking || listenMode === "first") ? "I'm listening..." : "Your turn";
        s = userSpeaking ? "I can hear you" : (listenMode === "first" ? "Speak naturally" : "Speak whenever you're ready");
    }
    else if (state === S.THINKING)  { t = "Please wait..."; s = "Tekvaani is preparing a response"; }
    else if (state === S.SPEAKING)  { t = "Tekvaani is speaking..."; s = "Please listen"; }
    else                            { t = "Conversation ended"; s = "Tap Start Talking to begin again."; }
    titleEl.textContent = t; subEl.textContent = s;
    startBtn.hidden = isActive(); endBtn.hidden = !isActive();
}

function setNotice(text, isError) {
    noticeEl.textContent = text || "";
    noticeEl.classList.toggle("error", !!(text && isError));
}

/* =========================================================
   CHAT
   ========================================================= */
const ICON_USER = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>';
const ICON_LEAF = '<svg viewBox="0 0 24 24"><path d="M12 21C7 17 5 12 12 3c7 9 5 14 0 18z" fill="#1fae7a"/><path d="M12 21c-1-4-5-6-8-6 0 4 4 7 8 6z" fill="#2f6fe4"/><path d="M12 21c1-4 5-6 8-6 0 4-4 7-8 6z" fill="#1c9bb0"/></svg>';
const ICON_SPK = '<svg class="spk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = "row " + role;
    const av = document.createElement("div");
    av.className = "avatar"; av.innerHTML = role === "ai" ? ICON_LEAF : ICON_USER;
    const col = document.createElement("div"); col.className = "col";
    const bubble = document.createElement("div"); bubble.className = "bubble";
    const span = document.createElement("span"); span.textContent = text; bubble.appendChild(span);
    if (role === "ai") bubble.insertAdjacentHTML("beforeend", ICON_SPK);
    const time = document.createElement("div"); time.className = "time";
    time.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    col.append(bubble, time);
    role === "ai" ? row.append(av, col) : row.append(col, av);
    chatEl.appendChild(row);
    msgCount++; render();
    requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });   // always show the newest message
    return row;
}

function resetTranscript() { chatEl.innerHTML = ""; msgCount = 0; render(); }

/* =========================================================
   BACKEND INTEGRATION POINTS
   The developer connecting the real service works here.
   Nothing in this block talks to a server yet.
   ========================================================= */

/* 1. Start: open the microphone, begin watching for speech.
      TODO (real service): open the connection / session here. */
async function startConversation() {
    if ((state !== S.IDLE && state !== S.ENDED) || starting) return;
    starting = true;
    if (demo) demo.prime();
    const id = ++session;
    resetTranscript();
    setNotice(DEMO_MODE ? "Please allow the microphone if your browser asks." : "");
    try { await openMicrophone(); }
    catch (err) {
        starting = false;
        if (id !== session) return;
        closeMicrophone(); setState(S.IDLE); setNotice(microphoneErrorText(err), true);
        return;
    }
    starting = false;
    if (id !== session) { closeMicrophone(); return; }
    setNotice(DEMO_MODE ? "This is a demo. Tekvaani's replies are samples for now." : "");
    vadTimer = setInterval(vadTick, 50);
    resumeListening(id, "first");
}

/* 2. Send microphone audio to the real service.
      TODO (real service): call with each audio chunk (MediaRecorder / AudioWorklet). */
async function sendAudioToBackend(audioChunk) {
  try {
    const formData = new FormData();

const state =
  ["bhojpuri", "awadhi", "braj bhasha", "bundeli", "kannauji"].includes(SELECTED_DIALECT)
    ? "Uttar Pradesh"
    : "Odisha";

const language = state === "Uttar Pradesh" ? "Hindi" : "Odia";

formData.append("file", audioChunk, "voice.webm");
formData.append("state", SELECTED_STATE);
formData.append("language", SELECTED_LANGUAGE);
formData.append("dialect", SELECTED_DIALECT_ID);

    const response = await fetch("https://tekvaani.vercel.app/api/voice/chat", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();

    console.log("Tekvaani backend response:", data);

    return data;
  } catch (error) {
    console.error("Voice API error:", error);
    throw error;
  }
}

/* 3. Real service -> page: what the user said, as text. */
function receiveUserTranscript(text) {
    addMessage("user", text);
    setState(S.THINKING);
}

/* 4. Real service -> page: Tekvaani's answer.
      response = { text: "answer text", audioUrl: "url of the voice reply" } */
async function receiveAIResponse(response, id = session) {
    if (!alive(id)) return;
    const row = addMessage("ai", response.text);
    await playAIResponse(response, row, id);
}

/* 5. Play the voice reply, then listen again automatically. */
async function playAIResponse(response, row, id = session) {
    if (!alive(id)) return;
    setState(S.SPEAKING);
    row.classList.add("speaking");
    if (response.audioUrl) {
        await new Promise(resolve => {
            currentAudio = new Audio(response.audioUrl);
            currentAudio.onended = resolve; currentAudio.onerror = resolve;
            currentAudio.play().catch(resolve);
        });
        currentAudio = null;
    } else if (demo) {
        await demo.playVoice(response, id);
    }
    row.classList.remove("speaking");
    if (alive(id)) resumeListening(id, "again");
}

/* 6. End: stop everything, never restart by itself.
      TODO (real service): close the connection / session here. */
function endConversation() {
    session++; starting = false;
    clearInterval(vadTimer); vadTimer = null;
    if (demo) demo.stop();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    closeMicrophone();
    userSpeaking = false; micLevel = 0; speechPulse = 0;
    chatEl.querySelectorAll(".speaking").forEach(el => el.classList.remove("speaking"));
    setNotice("");
    setState(S.ENDED);
}

/* =========================================================
   LISTENING LOOP (shared by demo and real use)
   ========================================================= */
function resumeListening(id, mode) {
    if (id !== session) return;

    listenMode = mode;
    userSpeaking = false;
    recordedChunks = [];

    if (mediaRecorder && mediaRecorder.state === "inactive") {
        mediaRecorder.start();
    }

    resetVAD(performance.now() + (mode === "first" ? 400 : VAD.settleMs));

    setState(S.LISTENING);

    if (demo) demo.startListening(id);
}


async function onUserTurnFinished(id) {
    if (state !== S.LISTENING || id !== session) return;

    userSpeaking = false;
    setState(S.THINKING);

    try {
        if (!mediaRecorder || mediaRecorder.state !== "recording") {
            throw new Error("Audio recorder is not active.");
        }

        // Record the completed audio
        const audioBlob = await new Promise((resolve, reject) => {
            const chunks = [];

            const handleData = event => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            const handleStop = () => {
                mediaRecorder.removeEventListener("dataavailable", handleData);
                mediaRecorder.removeEventListener("stop", handleStop);

                if (!chunks.length) {
                    reject(new Error("No audio was recorded."));
                    return;
                }

                resolve(new Blob(chunks, { type: "audio/webm" }));
            };

            mediaRecorder.addEventListener("dataavailable", handleData);
            mediaRecorder.addEventListener("stop", handleStop);

            mediaRecorder.stop();
        });

        // Send audio to backend
        const data = await sendAudioToBackend(audioBlob);

        if (!alive(id)) return;

        console.log("Processed voice response:", data);

        // Get dialect and confidence
        const dialect = SELECTED_DIALECT || data.detected_dialect || "Unknown";
        const confidence = data.dialect_confidence;

        let confidenceText = "";

        if (confidence !== undefined && confidence !== null) {
            const value = Number(confidence);

            confidenceText = ` (${Number.isFinite(value)
                ? (value <= 1 ? value * 100 : value).toFixed(1)
                : confidence}%)`;
        }

        // USER MESSAGE: dialect + transcript in ONE bubble
        if (data.transcript) {
            const userRow = addMessage("user", "");

            const textSpan = userRow.querySelector(".bubble span");

            if (textSpan) {
                const dialectLabel = document.createElement("span");
                dialectLabel.className = "user-dialect-label";
                dialectLabel.textContent = `User Dialect: ${dialect}${confidenceText}`;

                const transcriptText = document.createElement("span");
                transcriptText.className = "user-transcript";
                transcriptText.textContent = data.transcript;

                textSpan.append(dialectLabel, transcriptText);
            }
        }

        // AI RESPONSE: answer only
        const answer =
            data.answer_dialect ||
            data.regional_answer ||
            "";

        if (!answer) {
            throw new Error("Backend returned an empty dialect answer.");
        }

        const responseText = answer;
        const aiRow = addMessage("ai", responseText);

        // Play backend audio
        if (data.audio_base64) {
            let audioSrc = data.audio_base64;

            if (!audioSrc.startsWith("data:")) {
                audioSrc = `data:audio/wav;base64,${audioSrc}`;
            }

            await playAIResponse(
                {
                    text: responseText,
                    audioUrl: audioSrc
                },
                aiRow,
                id
            );

        } else {
            await playAIResponse(
                {
                    text: responseText
                },
                aiRow,
                id
            );
        }

    } catch (error) {
        console.error("Voice-to-voice error:", error);

        if (!alive(id)) return;

        setState(S.ENDED);
        setNotice("Something went wrong while processing your voice.", true);
    }
}


/* =========================================================
   MICROPHONE + SILENCE DETECTION
   ========================================================= */
async function openMicrophone() {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
    const track = micStream.getAudioTracks()[0];
    if (track) track.onended = () => {
        if (isActive()) { endConversation(); setNotice("The microphone was disconnected. Please check it and start again.", true); }
    };
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
}


function closeMicrophone() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
  mediaRecorder.stop();
}

if (micStream) micStream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    if (audioCtx && audioCtx.state !== "closed") audioCtx.close();
    micStream = null; audioCtx = null; analyser = null;
}

function microphoneErrorText(err) {
    const n = err && err.name;
    if (!navigator.mediaDevices) return "This browser cannot use the microphone here. Please try Chrome.";
    if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return "The microphone is blocked. Please allow it in your browser, then tap Start Talking.";
    if (n === "NotFoundError" || n === "DevicesNotFoundError") return "No microphone was found. Please connect one and try again.";
    if (n === "NotReadableError") return "The microphone is being used by another app. Please close it and try again.";
    return "The microphone could not start. Please try again.";
}

function readRMS() {
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / buf.length);
}

function resetVAD(muteUntil) {
    vad = { floor: vad.floor || 0.008, speaking: false, aboveSince: 0, belowSince: 0, speechStart: 0, muteUntil: muteUntil || 0 };
}

function vadTick() {                              // every 50 ms, only while waiting for the user
    if (state !== S.LISTENING || !analyser) { micLevel *= 0.8; return; }
    const now = performance.now(), rms = readRMS();
    micLevel = micLevel * 0.7 + rms * 0.3;
    if (now < vad.muteUntil) return;
    const th = Math.min(VAD.maxThreshold, Math.max(VAD.minThreshold, vad.floor * 2.2 + 0.01));
    if (!vad.speaking) {
        if (rms < th) vad.floor = vad.floor * 0.95 + rms * 0.05;
        if (rms > th) {
            if (!vad.aboveSince) vad.aboveSince = now;
            if (now - vad.aboveSince >= VAD.startMs) {
                vad.speaking = true; vad.speechStart = vad.aboveSince; vad.belowSince = 0; userSpeaking = true;
                if (!noticeEl.classList.contains("error")) setNotice("");
                render();
            }
        } else vad.aboveSince = 0;
    } else if (rms < th * 0.75) {
        if (!vad.belowSince) vad.belowSince = now;
        if (now - vad.belowSince >= VAD.silenceMs) {
            const spokeFor = vad.belowSince - vad.speechStart;
            vad.speaking = false; vad.aboveSince = 0; vad.belowSince = 0;
            if (spokeFor >= VAD.minSpeechMs) onUserTurnFinished(session);
            else { userSpeaking = false; render(); }
        }
    } else vad.belowSince = 0;
}

/* =========================================================
   MENU, HOW TO USE, NAVIGATION (listeners attached once)
   ========================================================= */
const sheet = $("sheet"), scrim = $("scrim");
let lastFocus = null;

function openPanel(el, focusId) {
    lastFocus = document.activeElement;
    el.classList.add("open"); el.setAttribute("aria-hidden", "false"); scrim.classList.add("show");
    $(focusId).focus({ preventScroll: true });
}
function closePanels() {
    [sheet].forEach(el => { el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); });
    scrim.classList.remove("show");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
$("helpBtn").addEventListener("click", () => openPanel(sheet, "sheetClose"));
/* Language: end any conversation, then ask the app to go back to Select State -> Select Dialect. */
$("langBtn").addEventListener("click", () => {
    if (isActive()) endConversation();
    try {
        const b = window.parent.document.querySelector(".st-key-language_reset button");
        if (!b) throw new Error("no button");
        b.click();
    } catch (_) { setNotice("Could not open language selection. Please refresh the page.", true); }
});
$("sheetClose").addEventListener("click", closePanels);
scrim.addEventListener("click", closePanels);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanels(); });
startBtn.addEventListener("click", startConversation);
endBtn.addEventListener("click", endConversation);
window.addEventListener("pagehide", () => { try { if (demo) demo.stop(); closeMicrophone(); } catch (_) {} });

/* Make the component as tall as the visible screen (mobile app feel). */
function fitFrame() {
    try {
        const fe = window.frameElement, p = window.parent;
        if (!fe) return;
        const main = p.document.querySelector('[data-testid="stMain"]') || p.document.querySelector("section.main");
        const viewH = main ? main.clientHeight : p.innerHeight;
        const top = fe.getBoundingClientRect().top - (main ? main.getBoundingClientRect().top - main.scrollTop : 0);
        fe.style.height = Math.max(540, Math.min(900, Math.round(viewH - top - 10))) + "px";
    } catch (_) {}
}
fitFrame();
window.addEventListener("resize", fitFrame);
window.addEventListener("orientationchange", () => setTimeout(fitFrame, 250));
setTimeout(fitFrame, 300); setTimeout(fitFrame, 1200);

/* =========================================================
   ORB (canvas): glossy blue-green sphere with a living wave
   ========================================================= */
const canvas = $("orb"), ctx = canvas.getContext("2d");
let size = 240;
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    size = canvas.clientWidth || 240;
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(canvas); else window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const TARGETS = {
    IDLE:      { amp: .03, speed: .5, glow: .5,  rings: .3, think: 0, calm: 0 },
    LISTENING: { amp: .05, speed: 1,  glow: .75, rings: 1,  think: 0, calm: 0 },
    THINKING:  { amp: .04, speed: .4, glow: .65, rings: .2, think: 1, calm: 0 },
    SPEAKING:  { amp: .1,  speed: 2,  glow: 1,   rings: 1,  think: 0, calm: 0 },
    ENDED:     { amp: .02, speed: .3, glow: .3,  rings: 0,  think: 0, calm: 1 }
};
const PAL = { g: [[54, 211, 154], [214, 230, 246]], t: [[26, 169, 192], [190, 208, 240]], b: [[47, 95, 224], [168, 186, 232]] };
const cur = Object.assign({}, TARGETS.IDLE);
let phase = 0, spin = 0, last = performance.now();
const mixn = (a, b, t) => a + (b - a) * t;
const mixc = (p, t) => [mixn(p[0][0], p[1][0], t), mixn(p[0][1], p[1][1], t), mixn(p[0][2], p[1][2], t)];
const rgb = (c, a) => "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";

for (let i = 0; i < 15; i++) eqEl.appendChild(document.createElement("i"));
const bars = Array.from(eqEl.children);

function updateBars(now) {
    if (state !== S.LISTENING && state !== S.SPEAKING) return;
    const n = bars.length, mid = (n - 1) / 2;
    bars.forEach((b, i) => {
        const env = 1 - 0.6 * Math.abs(i - mid) / mid;
        const wob = 0.5 + 0.5 * Math.sin(now / 95 + i * 0.95);
        const amount = state === S.LISTENING ? Math.min(1, micLevel * 7) : 0.45 + 0.4 * speechPulse + 0.15 * Math.sin(now / 200);
        const base = 0.16 + 0.24 * env;                 // always a visible bar shape
        const v = reduced ? base + 0.1 : Math.min(1, base + env * amount * (0.35 + 0.65 * wob) * 0.85);
        b.style.transform = "scaleY(" + v.toFixed(2) + ")";
        b.style.opacity = (0.45 + 0.55 * env).toFixed(2);
    });
}

function drawOrb(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const tg = TARGETS[state], ease = 1 - Math.pow(0.002, dt);
    for (const k in tg) cur[k] = mixn(cur[k], tg[k], ease);

    speechPulse = Math.max(0, speechPulse - dt * 3);
    let level = 0;
    if (state === S.LISTENING) level = Math.min(1, micLevel * 7) + (userSpeaking ? 0.15 : 0);
    else if (state === S.SPEAKING) level = 0.3 + 0.3 * Math.abs(Math.sin(now / 130) * Math.sin(now / 410)) + 0.4 * speechPulse;

    const motion = reduced ? 0.25 : 1;
    phase += dt * cur.speed * (reduced ? 0.3 : 1);
    spin += dt * (0.4 + cur.think * 2.4) * (reduced ? 0.2 : 1);

    const G = mixc(PAL.g, cur.calm), T = mixc(PAL.t, cur.calm), B = mixc(PAL.b, cur.calm);
    const c = size / 2, R = size * 0.3;
    ctx.clearRect(0, 0, size, size);

    // soft halo
    const gl = cur.glow + level * 0.25;
    const halo = ctx.createRadialGradient(c, c, R * 0.5, c, c, R * 1.65);
    halo.addColorStop(0, rgb(B, 0.30 * gl)); halo.addColorStop(0.55, rgb(G, 0.14 * gl)); halo.addColorStop(1, rgb(G, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, size, size);

    // glass rings around the sphere
    const RB = mixc([[92, 160, 255], [190, 208, 240]], cur.calm);
    if (cur.rings > 0.02) for (let k = 0; k < 2; k++) {
        const rr = R * (1.26 + k * 0.24) + level * R * 0.05 * motion;
        const rg = ctx.createRadialGradient(c, c, rr * 0.55, c, c, rr);
        rg.addColorStop(0, rgb(RB, 0)); rg.addColorStop(1, rgb(RB, (0.26 - 0.08 * k) * cur.rings));
        ctx.beginPath(); ctx.arc(c, c, rr, 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill();
        ctx.strokeStyle = rgb(RB, (0.5 - 0.15 * k) * cur.rings); ctx.lineWidth = 1.6; ctx.stroke();
    }
    if (cur.rings > 0.5 && !reduced) for (let i = 0; i < 2; i++) {
        const p = (now / 2400 + i / 2) % 1;
        ctx.beginPath(); ctx.arc(c, c, R * (1.1 + p * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = rgb(i ? G : B, (1 - p) * 0.3 * cur.rings); ctx.lineWidth = 2; ctx.stroke();
    }

    // sphere (edge wobbles a little with the voice)
    const rad = R * (1 + (0.012 * Math.sin(phase * 1.5) + level * 0.035) * motion);   // round sphere that gently breathes
    const sphere = () => { ctx.beginPath(); ctx.arc(c, c, rad, 0, Math.PI * 2); ctx.closePath(); };
    sphere();
    const body = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
    body.addColorStop(0, rgb(G, 1)); body.addColorStop(0.5, rgb(T, 1)); body.addColorStop(1, rgb(B, 1));
    ctx.shadowColor = rgb(G, 0.55 * cur.glow * (1 - cur.calm)); ctx.shadowBlur = R * 0.45;
    ctx.fillStyle = body; ctx.fill();
    ctx.shadowBlur = 0;
    const hi = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, 0, c - R * 0.35, c - R * 0.4, R * 1.05);
    hi.addColorStop(0, "rgba(255,255,255,0.5)"); hi.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hi; ctx.fill();
    const rim = ctx.createRadialGradient(c, c, R * 0.55, c, c, R);
    rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(1, rgb(T, 0.0)); rim.addColorStop(0.92, "rgba(170,240,255,0.22)");
    ctx.fillStyle = rim; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();

    // the voice wave
    ctx.save(); sphere(); ctx.clip();
    const A = R * (0.17 + level * 0.3) * (state === S.THINKING ? 0.35 : 1) * (reduced ? 0.6 : 1);
    ctx.beginPath();
    for (let x = -R; x <= R; x += 3) {
        const t = (x + R) / (2 * R), env = Math.pow(Math.sin(Math.PI * t), 1.1);
        const y = c + Math.sin(t * Math.PI * 2 + phase * 2) * A * env + Math.sin(t * Math.PI * 4 - phase * 3) * A * 0.25 * env * Math.min(1, level * 2);
        x === -R ? ctx.moveTo(c + x, y) : ctx.lineTo(c + x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255," + (0.95 - cur.calm * 0.3) + ")";
    ctx.lineWidth = Math.max(3, size * 0.017); ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255,255,255,0.8)"; ctx.shadowBlur = 8; ctx.stroke();
    ctx.restore();

    // thinking: orbiting arc and dots
    if (cur.think > 0.02) {
        ctx.beginPath(); ctx.arc(c, c, R * 1.3, spin, spin + Math.PI * 0.9);
        ctx.strokeStyle = rgb(B, 0.6 * cur.think); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.stroke();
        for (let i = 0; i < 3; i++) {
            const a = -spin * 0.8 + i * 2.094;
            ctx.beginPath(); ctx.arc(c + Math.cos(a) * R * 1.3, c + Math.sin(a) * R * 1.3, 4, 0, Math.PI * 2);
            ctx.fillStyle = rgb(G, 0.85 * cur.think); ctx.fill();
        }
    }
    updateBars(now);
    requestAnimationFrame(drawOrb);
}

setState(S.IDLE);
requestAnimationFrame(drawOrb);