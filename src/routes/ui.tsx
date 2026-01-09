import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { compiledCss } from "../app/compiledCss";
import { Container } from "../components/Container";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FeatureRow } from "../components/FeatureRow";
import { FloatingExampleCard } from "../components/FloatingExampleCard";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.get("/", (c) => {
  const email = c.get("userEmail") || null;
  const auth = email ? "1" : "0";

  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Product Studio</title>
        <style dangerouslySetInnerHTML={{ __html: compiledCss }} />
      </head>
      <body class="font-sans bg-bg text-text" data-auth={auth}>
        <div class="relative min-h-screen overflow-hidden">
          {/* background blobs */}
          <div class="pointer-events-none absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-accent2 to-accent" />
          <div class="pointer-events-none absolute -bottom-28 -left-28 h-[560px] w-[560px] rounded-full blur-3xl opacity-35 bg-gradient-to-tr from-[#F3E8D8] to-surface2" />

          <header class="relative z-10">
            <Container>
              <div class="flex items-center justify-between py-6">
                <a href="/" class="inline-flex items-center gap-2 font-semibold tracking-tight">
                  <span class="h-8 w-8 rounded-lg bg-surface2 border border-border" />
                  Product Studio
                </a>
                <div class="flex items-center gap-3">
                  <a href="/pricing" class="text-sm text-text2 hover:text-text">
                    Pricing
                  </a>
                  {email ? (
                    <form method="post" action="/logout">
                      <button class="text-sm text-text2 hover:text-text">Sign out</button>
                    </form>
                  ) : (
                    <a href="/login" class="text-sm text-text2 hover:text-text">
                      Login
                    </a>
                  )}
                  <a href={email ? "#app" : "/login"}>
                    <Button type="button">Get started</Button>
                  </a>
                </div>
              </div>
            </Container>
          </header>

          <main class="relative z-10">
            <section class="py-16 md:py-24">
              <Container>
                <div class="md:grid md:grid-cols-12 md:gap-10 items-start">
                  <div class="md:col-span-6">
                    <div class="max-w-[640px]">
                      <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Product photos, instantly</div>
                      <h1 class="text-4xl md:text-6xl font-semibold tracking-tight">
                        Create lifestyle product photos with AI
                      </h1>
                      <p class="mt-4 text-base md:text-lg text-text2 leading-relaxed">
                        Upload a product photo, choose a scene, generate premium images, then turn them into a short video.
                      </p>
                      <div class="mt-4 text-sm text-text2">No photoshoots needed • results in seconds</div>
                    </div>

                    <div id="app" class="mt-8">
                      <Card className="shadow-md p-6">
                        <div class="flex items-center justify-between">
                          <div class="text-xs uppercase tracking-wide text-text2/70">Upload</div>
                          <div id="authHint" class="text-xs text-text2" />
                        </div>

                        <div
                          id="dropzone"
                          class="mt-3 rounded-xl border border-dashed border-border p-8 text-center bg-surface/70"
                        >
                          <div class="mx-auto mb-3 h-10 w-10 rounded-lg bg-surface2 flex items-center justify-center">
                            <span class="text-text2">⬆</span>
                          </div>
                          <div class="font-medium">Upload a product photo</div>
                          <div class="mt-1 text-sm text-text2">PNG / JPG · best on plain background</div>

                          <div class="mt-5 flex items-center justify-center gap-3">
                            <input id="file" type="file" accept="image/*" class="hidden" />
                            <Button type="button" id="uploadBtn">
                              Upload Image
                            </Button>
                            <Button type="button" variant="secondary" id="demoBtn">
                              Try demo
                            </Button>
                          </div>
                          <div id="previewWrap" class="mt-5 hidden">
                            <div class="mx-auto w-full max-w-[420px] rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
                              <img id="thumb" class="block w-full h-44 object-cover" />
                            </div>
                            <div id="fileName" class="mt-2 text-xs text-text2/70" />
                          </div>
                          <div class="mt-3 text-xs text-text2/70">Drag and drop also works</div>
                        </div>

                        <div id="controls" class="mt-5 hidden">
                          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Scene</div>
                              <select
                                id="scene"
                                class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                              >
                                <option>Studio</option>
                                <option>Shelf</option>
                                <option>Bathroom</option>
                                <option>Cafe table</option>
                                <option>Outdoor stone</option>
                                <option>On-body mannequin</option>
                              </select>
                            </div>
                            <div>
                              <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Outputs</div>
                              <select
                                id="count"
                                class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                              >
                                <option value="1">1</option>
                                <option value="4">4</option>
                              </select>
                            </div>
                            <div>
                              <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Aspect</div>
                              <select
                                id="aspect"
                                class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                              >
                                <option value="1:1">1:1</option>
                                <option value="4:5">4:5</option>
                                <option value="16:9">16:9</option>
                              </select>
                            </div>
                          </div>

                          <div class="mt-4 flex items-center justify-between gap-3">
                            <button id="advancedBtn" class="text-sm text-text2 hover:text-text">
                              Advanced
                            </button>
                            <Button type="button" id="generateBtn">
                              Generate
                            </Button>
                          </div>

                          <div id="advanced" class="mt-4 hidden">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Model</div>
                                <select
                                  id="model"
                                  class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                                >
                                  <option>Image 1</option>
                                  <option>Nano Banana</option>
                                </select>
                                <div class="mt-1 text-xs text-text2/70">Model selection is applied behind the scenes.</div>
                              </div>
                              <div>
                                <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Prompt (optional)</div>
                                <input
                                  id="prompt"
                                  type="text"
                                  placeholder="Keep it short: lighting, mood, surface"
                                  class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                                />
                              </div>
                            </div>
                            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Video provider</div>
                                <select
                                  id="videoProvider"
                                  class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                                >
                                  <option value="kling">Kling</option>
                                  <option value="veo3">Veo3</option>
                                </select>
                              </div>
                              <div>
                                <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Video prompt (optional)</div>
                                <input
                                  id="videoPrompt"
                                  type="text"
                                  placeholder="Optional: camera move, vibe, pacing"
                                  class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                                />
                              </div>
                            </div>
                          </div>

                          <div id="status" class="mt-4 text-sm text-text2 hidden" />
                        </div>
                      </Card>

                      <div id="results" class="mt-6 hidden">
                        <div class="flex items-center justify-between mb-3">
                          <div class="text-xs uppercase tracking-wide text-text2/70">Results</div>
                          <div class="text-xs text-text2" id="requestId" />
                        </div>
                        <div id="grid" class="grid grid-cols-2 md:grid-cols-4 gap-3" />
                        <div id="videoSection" class="mt-5 hidden">
                          <Card className="p-4">
                            <div class="flex items-center justify-between gap-3">
                              <div>
                                <div class="text-sm font-medium">Turn into video</div>
                                <div class="text-xs text-text2">Uses the first image as the starting frame.</div>
                              </div>
                              <Button id="makeVideoBtn" type="button">
                                Generate video
                              </Button>
                            </div>
                            <video id="videoPreview" class="mt-3 w-full rounded-lg hidden" controls />
                          </Card>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="md:col-span-6 mt-10 md:mt-0">
                    <div class="relative">
                      <div class="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1 text-xs text-text2 shadow-sm">
                        <span class="h-2 w-2 rounded-full bg-accent" />
                        Powered by AI
                      </div>

                      <div class="relative mt-6 h-[380px] md:h-[520px]">
                        <div class="absolute inset-0">
                          <FloatingExampleCard
                            src="/demo/example?i=1"
                            className="absolute left-6 top-8 h-[260px] w-[320px] md:h-[340px] md:w-[420px]"
                          />
                          <FloatingExampleCard
                            src="/demo/example?i=2"
                            className="absolute right-10 top-4 h-[160px] w-[200px] rotate-1"
                          />
                          <FloatingExampleCard
                            src="/demo/example?i=3"
                            className="absolute right-0 bottom-10 h-[140px] w-[180px] -rotate-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-10 md:mt-14">
                  <FeatureRow />
                </div>
              </Container>
            </section>
          </main>

          {/* lightbox */}
          <div id="lightbox" class="fixed inset-0 hidden items-center justify-center bg-black/40 p-4">
            <div class="max-w-4xl w-full">
              <div class="rounded-xl bg-surface border border-border shadow-md overflow-hidden">
                <div class="flex items-center justify-between p-3 border-b border-border">
                  <div class="text-sm text-text2">Preview</div>
                  <button id="closeLightbox" class="text-sm text-text2 hover:text-text">
                    Close
                  </button>
                </div>
                <div class="bg-bg p-4">
                  <img id="lightboxImg" class="w-full max-h-[70vh] object-contain rounded-lg bg-surface" />
                </div>
                <div class="p-3 flex flex-wrap gap-2 justify-end border-t border-border">
                  <Button id="downloadBtn" type="button" variant="secondary">
                    Download
                  </Button>
                  <Button id="copyPromptBtn" type="button" variant="secondary">
                    Copy prompt
                  </Button>
                  <Button id="regenBtn" type="button">
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
      </body>
    </html>,
  );
});

const inlineJs = `
(() => {
  const auth = document.body.dataset.auth === '1';
  const $ = (sel) => document.querySelector(sel);
  const dropzone = $('#dropzone');
  const fileInput = $('#file');
  const uploadBtn = $('#uploadBtn');
  const demoBtn = $('#demoBtn');
  const controls = $('#controls');
  const status = $('#status');
  const results = $('#results');
  const grid = $('#grid');
  const requestId = $('#requestId');
  const videoSection = $('#videoSection');
  const makeVideoBtn = $('#makeVideoBtn');
  const videoPreview = $('#videoPreview');
  const previewWrap = $('#previewWrap');
  const thumb = $('#thumb');
  const fileName = $('#fileName');
  const advancedBtn = $('#advancedBtn');
  const advanced = $('#advanced');
  const generateBtn = $('#generateBtn');
  const authHint = $('#authHint');

  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const closeLightbox = $('#closeLightbox');
  const downloadBtn = $('#downloadBtn');
  const copyPromptBtn = $('#copyPromptBtn');
  const regenBtn = $('#regenBtn');

  let currentFile = null;
  let currentPrompt = '';
  let lastFrames = [];
  let lastObjectKey = null;
  let thumbUrl = null;

  if (!auth) {
    authHint.textContent = 'Sign in to generate';
  }

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const setStatus = (msg) => { status.textContent = msg; show(status); };

  const openLightbox = (src) => {
    lightboxImg.src = src;
    downloadBtn.onclick = () => window.open(src, '_blank');
    copyPromptBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(currentPrompt || ''); setStatus('Copied prompt'); } catch {}
    };
    regenBtn.onclick = () => { lightbox.classList.add('hidden'); runGenerate(); };
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
  };

  closeLightbox?.addEventListener('click', () => { lightbox.classList.add('hidden'); lightbox.classList.remove('flex'); });
  lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) { lightbox.classList.add('hidden'); lightbox.classList.remove('flex'); } });

  advancedBtn?.addEventListener('click', () => {
    advanced.classList.toggle('hidden');
  });

  const loadFile = (file) => {
    currentFile = file;
    show(controls);
    if (thumb) {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      thumbUrl = URL.createObjectURL(file);
      thumb.src = thumbUrl;
    }
    if (fileName) fileName.textContent = file.name;
    show(previewWrap);
    setStatus('Ready');
  };

  uploadBtn?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFile(f);
  });

  demoBtn?.addEventListener('click', async () => {
    const res = await fetch('/demo/sample');
    const svgText = await res.text();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 768;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return;
        const file = new File([blob], 'demo.png', { type: 'image/png' });
        loadFile(file);
        setStatus('Demo loaded');
      }, 'image/png', 0.92);
    };
    img.src = url;
  });

  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('ring-2','ring-accent/30'); });
  dropzone?.addEventListener('dragleave', () => { dropzone.classList.remove('ring-2','ring-accent/30'); });
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('ring-2','ring-accent/30');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  async function initUpload(file) {
    const initRes = await fetch('/api/upload/init', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
    });
    if (initRes.status === 401) { window.location.href = '/login'; return null; }
    if (!initRes.ok) throw new Error('upload_init_failed');
    const { key, uploadUrl } = await initRes.json();
    const putRes = await fetch(uploadUrl, { method:'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    if (!putRes.ok) throw new Error('upload_put_failed');
    return key;
  }

  function buildPrompt() {
    const scene = $('#scene').value;
    const aspect = $('#aspect').value;
    const extra = ($('#prompt').value || '').trim();
    const base = 'Place the product naturally in a ' + scene + ' scene. Clean, premium lighting. ' + 'Aspect ratio ' + aspect + '.';
    return extra ? (base + ' ' + extra) : base;
  }

  async function runGenerate() {
    if (!currentFile) { setStatus('Choose an image first'); return; }
    if (!auth) { window.location.href = '/login'; return; }
    generateBtn.disabled = true;

    let sseStarted = false;
    try {
      hide(results);
      grid.innerHTML = '';
      requestId.textContent = '';
      hide(videoSection);
      videoPreview.classList.add('hidden');
      videoPreview.removeAttribute('src');
      lastFrames = [];

      setStatus('Uploading…');
      const objectKey = await initUpload(currentFile);
      if (!objectKey) return;
      lastObjectKey = objectKey;

      const count = parseInt($('#count').value, 10) || 1;
      currentPrompt = buildPrompt();
      setStatus('Generating images…');

      const sseUrl = '/api/generate-images-sse?objectKey=' + encodeURIComponent(objectKey) + '&prompt=' + encodeURIComponent(currentPrompt) + '&count=' + encodeURIComponent(String(count));
      sseStarted = true;
      const sse = new EventSource(sseUrl);
      sse.addEventListener('start', (ev) => {
        const payload = JSON.parse(ev.data);
        requestId.textContent = payload.requestId ? ('requestId: ' + payload.requestId) : '';
      });
      sse.addEventListener('image', (ev) => {
        const payload = JSON.parse(ev.data);
        lastFrames.push(payload.key);
        const src = '/api/file?key=' + encodeURIComponent(payload.key);
        const btn = document.createElement('button');
        btn.className = 'group rounded-xl border border-border bg-surface overflow-hidden shadow-sm hover:-translate-y-[1px] transition';
        const img = document.createElement('img');
        img.src = src;
        img.className = 'block w-full h-40 object-cover';
        btn.appendChild(img);
        btn.addEventListener('click', () => openLightbox(src));
        grid.appendChild(btn);
        show(results);
      });
      sse.addEventListener('log', (ev) => { setStatus(String(ev.data).slice(0, 140)); });
      sse.addEventListener('error', () => { sse.close(); setStatus('AI Unavailable. Please retry.'); generateBtn.disabled = false; });
      sse.addEventListener('done', async () => {
        sse.close();
        setStatus('Done');
        if (lastFrames.length > 0) show(videoSection);
        generateBtn.disabled = false;
      });
    } catch {
      setStatus('Something Went Wrong. Please try again.');
    } finally {
      // If we failed before starting SSE, re-enable.
      if (generateBtn.disabled && !sseStarted) generateBtn.disabled = false;
    }
  }

  generateBtn?.addEventListener('click', runGenerate);

  makeVideoBtn?.addEventListener('click', async () => {
    if (!auth) { window.location.href = '/login'; return; }
    if (!lastFrames.length) return;
    setStatus('Generating video…');
    makeVideoBtn.disabled = true;
    try {
      const provider = ($('#videoProvider') && $('#videoProvider').value) || 'kling';
      const prompt = ($('#videoPrompt') && $('#videoPrompt').value) || '';
      const res = await fetch('/api/generate-video', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ frames: lastFrames, provider, prompt })
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error('video_failed');
      const { video } = await res.json();
      const src = '/api/file?key=' + encodeURIComponent(video.key);
      videoPreview.src = src;
      videoPreview.classList.remove('hidden');
      setStatus('Video ready');
    } catch {
      setStatus('AI Unavailable. Please retry.');
    } finally {
      makeVideoBtn.disabled = false;
    }
  });
})();
`;

export default router;
