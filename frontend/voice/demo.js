/* =========================================================
   Tekvaani - browser-only DEMO (no service, no server).
   Delete this file when the real service is connected and set
   DEMO_MODE = False in voice_to_voice.py.

   It uses the page's own functions from voice.js (setNotice,
   receiveUserTranscript, receiveAIResponse, resumeListening, ...)
   and offers them back through window.TekvaaniDemo.
   ========================================================= */
(function () {
  const RECOGNITION_LANGS = ["or-IN", "en-IN"];   // speech-to-text languages, tried in order
  const synth = window.speechSynthesis || null;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recSupported = !!SR, rec = null, recFinal = "", recInterim = "", recWaiter = null, recLangIdx = 0, recRestarts = 0;

  function demoStartRecognition(id) {
      recFinal = ""; recInterim = ""; recRestarts = 0;
      if (!recSupported) { setNotice("This browser cannot turn speech into text, so a sample message is shown. Chrome works best."); return; }
      startRecognition(id);
  }

  function startRecognition(id) {
      if (!recSupported || rec || id !== session) return;
      const r = new SR(); rec = r;
      r.lang = RECOGNITION_LANGS[recLangIdx]; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = e => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
              const res = e.results[i];
              if (res.isFinal) recFinal += res[0].transcript + " "; else interim += res[0].transcript;
          }
          recInterim = interim;
      };
      r.onerror = e => {
          if (e.error === "language-not-supported" && recLangIdx < RECOGNITION_LANGS.length - 1) recLangIdx++;
          else if (["not-allowed", "service-not-allowed", "network"].includes(e.error)) {
              recSupported = false; setNotice("Speech to text is not available right now, so a sample message is shown.");
          }
      };
      r.onend = () => {
          if (rec === r) rec = null;
          if (recWaiter) { const w = recWaiter; recWaiter = null; w(); }
          if (recSupported && id === session && state === S.LISTENING && recRestarts++ < 40) setTimeout(() => startRecognition(id), 250);
      };
      try { r.start(); } catch (_) { rec = null; }
  }

  function abortRecognition() {
      if (rec) { const r = rec; rec = null; r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch (_) {} }
      recWaiter = null;
  }

  function collectTranscript() {
      return new Promise(resolve => {
          let done = false;
          const finish = () => {
              if (done) return; done = true;
              const text = (recFinal + " " + recInterim).replace(/\s+/g, " ").trim();
              abortRecognition(); resolve(text);
          };
          if (!rec) { finish(); return; }
          recWaiter = finish; setTimeout(finish, 1500);
          try { rec.stop(); } catch (_) { finish(); }
      });
  }

  async function demoHandleTurn(id) {
      let text = await collectTranscript();
      if (!alive(id)) return;
      if (!recSupported) text = "You spoke something.";
      else if (!text) { setNotice("I did not catch that. Please try again."); resumeListening(id, "again"); return; }
      receiveUserTranscript(text);
      await sleep(800);
      if (!alive(id)) return;
      await receiveAIResponse(demoGenerateReply(text), id);
  }

  function demoGenerateReply(userText) {
      const t = userText.trim();
      if (/[\u0B00-\u0B7F]/.test(t)) {
          if (/ପାଗ|ପାଣିପାଗ/.test(t)) return { text: "ଆଜି ପାଣିପାଗ ଭଲ ଅଛି।", lang: "or-IN", fallbackSpeech: "Today the weather is good. This is a sample reply." };
          if (/ବର୍ଷା/.test(t)) return { text: "ହଁ, ଆଜି ବର୍ଷା ହୋଇପାରେ।", lang: "or-IN", fallbackSpeech: "Yes, it may rain today. This is a sample reply." };
          return { text: "ମୁଁ ଆପଣଙ୍କ କଥା ଶୁଣିଲି। ଏହା ଏକ ନମୁନା ଉତ୍ତର।", lang: "or-IN", fallbackSpeech: "I heard you. This is a sample reply." };
      }
      if (/[\u0900-\u097F]/.test(t)) return { text: "मैंने आपकी बात सुनी। यह एक नमूना उत्तर है।", lang: "hi-IN", fallbackSpeech: "I heard you. This is a sample reply." };
      if (/\b(hello|hi|hey|namaste)\b/i.test(t)) return { text: "Hello! How can I help you?", lang: "en-IN" };
      return { text: "I heard you. This is a sample reply. Tekvaani's real voice will be added soon.", lang: "en-IN" };
  }

  function primeBrowserVoice() {
      if (!synth) return;
      try { synth.cancel(); const u = new SpeechSynthesisUtterance(""); u.volume = 0; synth.speak(u); } catch (_) {}
  }
  function voicesReady() {
      if (!synth || synth.getVoices().length) return Promise.resolve();
      return new Promise(res => { synth.addEventListener("voiceschanged", () => res(), { once: true }); setTimeout(res, 800); });
  }
  function pickVoice(lang) {
      if (!synth) return null;
      const vs = synth.getVoices(), base = lang.split("-")[0].toLowerCase();
      return vs.find(v => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) || vs.find(v => v.lang.toLowerCase().startsWith(base)) || null;
  }
  function speakWithBrowser(text, lang) {
      return new Promise(resolve => {
          if (!synth) { resolve(); return; }
          synth.cancel();
          const u = new SpeechSynthesisUtterance(text); u.lang = lang;
          const v = pickVoice(lang); if (v) u.voice = v;
          u.rate = 0.95;
          let done = false;
          const dog = setTimeout(() => { synth.cancel(); finish(); }, 3000 + text.length * 130);
          function finish() { if (done) return; done = true; clearTimeout(dog); resolve(); }
          u.onboundary = () => { speechPulse = 1; };
          u.onend = finish; u.onerror = finish;
          synth.speak(u);
      });
  }
  async function demoPlayBrowserVoice(response, id) {
      if (!synth) { setNotice("This browser cannot speak aloud, so only the text is shown."); await sleep(1800); return; }
      await voicesReady();
      let text = response.text, lang = response.lang || "en-IN";
      if (!lang.toLowerCase().startsWith("en") && !pickVoice(lang) && response.fallbackSpeech) {
          text = response.fallbackSpeech; lang = "en-IN";
          setNotice("This device has no voice for this language yet, so a sample English voice is used.");
      }
      if (!alive(id)) return;
      await speakWithBrowser(text, lang);
  }

  window.TekvaaniDemo = {
    prime: primeBrowserVoice,
    startListening: demoStartRecognition,
    handleTurn: demoHandleTurn,
    playVoice: demoPlayBrowserVoice,
    stop() { abortRecognition(); if (synth) synth.cancel(); }
  };
})();