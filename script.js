// DOM Elements
const canvas = document.getElementById('piCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimization
const width = canvas.width;
const height = canvas.height;
const centerX = width / 2;
const centerY = height / 2;
const radius = width / 2;

// Stats Elements
const piValueEl = document.getElementById('piValue');
const piDiffEl = document.getElementById('piDiff');
const fpsDisplay = document.getElementById('fpsDisplay');
const ppsDisplay = document.getElementById('ppsValue');
const totalPointsEl = document.getElementById('totalPoints');
const timerEl = document.getElementById('timerValue');
const batchInput = document.getElementById('batchSize');
const batchDisplay = document.getElementById('batchValue');
const progressBar = document.getElementById('accuracyBar');
const accuracyText = document.getElementById('accuracyValue');
const insidePointsEl = document.getElementById('insidePoints');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

// Add Worker Count Display to Header or new stat box
const existingContainer = document.querySelector('.overlay-stats');
let workerCountEl = document.getElementById('workerStats');
if (!workerCountEl) {
    workerCountEl = document.createElement('div');
    workerCountEl.id = 'workerStats';
    workerCountEl.className = 'stat-item';
    workerCountEl.style.marginTop = '5px';
    workerCountEl.innerHTML = `<span class="label">THREADS</span> <span class="value" id="threadCount">0</span>`;
    existingContainer.appendChild(workerCountEl);
}

// State
let isRunning = false;
let totalPoints = 0;
let insidePoints = 0;
let startTime = 0;
let lastFrameTime = 0;
let lastUiUpdateTime = 0;
let batchSize = parseInt(batchInput.value);

// Performance / Stats
let frames = 0;
let pointsThisSecond = 0;
let lastPpsCheck = 0;

// ImageData buffer for fast pixel manipulation
let imageData = ctx.createImageData(width, height);
let buf = new Uint32Array(imageData.data.buffer);

// Colors (ABGR format because little-endian usually)
const COLOR_INSIDE = 0xFF99D334;
const COLOR_OUTSIDE = 0xFFB672F4;

// Workers (dynamic)
let workers = [];
document.getElementById('threadCount').textContent = navigator.hardwareConcurrency || 4;

// INLINED WORKER CODE (to fix file:// cross-origin issues)
const workerCode = `
    let isRunning = false;
    let batchSize = 10000;

    self.onmessage = function (e) {
        const data = e.data;
        if (data.cmd === 'start') {
            isRunning = true;
            batchSize = data.batchSize;
            loop();
        }
        else if (data.cmd === 'stop') {
            isRunning = false;
        }
        else if (data.cmd === 'update_batch') {
            batchSize = data.batchSize;
        }
    };

    function loop() {
        if (!isRunning) return;

        // Execute the batch
        let inside = 0;
        const total = batchSize;

        for (let i = 0; i < total; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;

            if ((x * x + y * y) <= 1) {
                inside++;
            }
        }

        self.postMessage({
            inside: inside,
            total: total
        });

        if (isRunning) {
            setTimeout(loop, 0);
        }
    }
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);


function handleWorkerMessage(e) {
    if (!isRunning) return;

    const data = e.data;
    totalPoints += data.total;
    insidePoints += data.inside;
    pointsThisSecond += data.total;

    // We update stats less frequently to save UI thread
}

function init() {
    // Fill buffer with black
    buf.fill(0xFF000000); // Opaque black
    ctx.putImageData(imageData, 0, 0);

    // Draw a circle outline for reference
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Capture the drawn circle into our buffer so it persists
    imageData = ctx.getImageData(0, 0, width, height);
    buf = new Uint32Array(imageData.data.buffer);
}

// Helper to format time
function formatTime(ms) {
    if (ms < 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = s % 60;
    const mm = m % 60;
    return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

// Main Loop (Visuals Only)
function loop(timestamp) {
    if (!isRunning) return;

    if (lastFrameTime === 0) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // Run a small local Monte Carlo Batch strictly for visualization purposes
    // We throttle this to keep the UI responsive while workers crush the numbers
    // Draw 2000 points per frame (enough to look cool, light enough for 60fps)
    const visualBatch = 5000;

    const data = buf;
    const w = width;
    const w_2 = w / 2;

    for (let i = 0; i < visualBatch; i++) {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const isInside = (x * x + y * y) <= 1;

        // We don't add to totalPoints here to avoid double counting if we want pure worker stats
        // But users want to see the points count up. 
        // Let's add them to the stats too, why not. Every point counts!
        totalPoints++;
        if (isInside) insidePoints++;
        pointsThisSecond++;

        // Map to pixel coordinates
        const px = Math.floor((x + 1) * w_2);
        const py = Math.floor((y + 1) * w_2);

        const index = (py * w) + px;
        if (index >= 0 && index < data.length) {
            // Only update if pixel is not already set (optional optimization or just overwrite)
            // Overwriting is fine
            data[index] = isInside ? COLOR_INSIDE : COLOR_OUTSIDE;
        }
    }

    // Render
    ctx.putImageData(imageData, 0, 0);

    // Stats & UI Updates (throttled)
    if (timestamp - lastUiUpdateTime > 100) {
        updateStats(timestamp);
        lastUiUpdateTime = timestamp;
    }

    // PPS calc (every second)
    if (timestamp - lastPpsCheck > 1000) {
        // Calculate true PPS from all workers + main thread
        const pps = pointsThisSecond * (1000 / (timestamp - lastPpsCheck));

        ppsDisplay.textContent = new Intl.NumberFormat('de-DE').format(Math.floor(pps));
        ppsDisplay.style.color = pps > 100000000 ? '#f472b6' : (pps > 1000000 ? '#34d399' : '#f8fafc');

        pointsThisSecond = 0;
        lastPpsCheck = timestamp;

        // FPS
        const fps = Math.round(1000 / dt);
        fpsDisplay.textContent = fps;
    }

    requestAnimationFrame(loop);
}

// Duration & Modal Elements
const durationInput = document.getElementById('duration');
const durationDisplay = document.getElementById('durationValue');
const resultsModal = document.getElementById('resultsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const threadInput = document.getElementById('threadCountInput');
const threadDisplay = document.getElementById('threadValue');

// Initialize Thread Slider
const maxThreads = navigator.hardwareConcurrency || 4;
threadInput.max = maxThreads * 2; // Allow overclock/overcommit
threadInput.value = maxThreads;
threadDisplay.textContent = maxThreads;

// Result Elements
const resultPPS = document.getElementById('resultPPS');
const resultTotal = document.getElementById('resultTotal');
const resultAccuracy = document.getElementById('resultAccuracy');
const resultPi = document.getElementById('resultPi');
const resultTime = document.getElementById('resultTime');
const resultThreads = document.getElementById('resultThreads');
const resultHardware = document.getElementById('resultHardware');

let durationSeconds = 0;
let averagePPS = 0;
let ppsSamples = 0;
let ppsSum = 0;

// Hardware Detection Helper
function getHardwareInfo() {
    let gpuInfo = "Unknown GPU";
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) { console.error("GPU Detection error:", e); }
    
    // Clean up GPU string (often verbose)
    // Remove "ANGLE (" and closing ")" if present
    if (gpuInfo.startsWith("ANGLE (")) {
        gpuInfo = gpuInfo.substring(7, gpuInfo.length - 1);
    }

    const cores = navigator.hardwareConcurrency || "?";
    return `${gpuInfo} | ${cores} Logical Cores`;
}

function finishBenchmark() {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Capture thread count used before stopping
    const usedThreads = workers.length > 0 ? workers.length : parseInt(threadInput.value);

    // Stop Workers
    workers.forEach(w => w.terminate()); // Kill them to clear memory/state
    workers = [];

    // Show Results
    const totalTimeSec = (performance.now() - startTime) / 1000;
    const finalPPS = totalPoints / totalTimeSec;

    // Calculate final stats
    const pi = 4 * (insidePoints / totalPoints);
    const error = Math.abs(Math.PI - pi);
    const accuracy = Math.max(0, 100 - (error / Math.PI) * 100);

    resultPPS.textContent = new Intl.NumberFormat('de-DE').format(Math.floor(finalPPS));
    resultTotal.textContent = new Intl.NumberFormat('de-DE').format(totalPoints);
    resultAccuracy.textContent = `${accuracy.toFixed(5)}%`;
    resultPi.textContent = pi.toFixed(8);
    resultTime.textContent = `${totalTimeSec.toFixed(2)}s`;
    
    // New stats
    if(resultThreads) resultThreads.textContent = usedThreads;
    if(resultHardware) resultHardware.textContent = getHardwareInfo();

    // Show Modal
    resultsModal.classList.remove('hidden');
}

function updateStats(timestamp) {
    if (totalPoints === 0) return;

    const elapsed = timestamp - startTime;

    // Check Duration
    if (durationSeconds > 0 && elapsed >= durationSeconds * 1000) {
        finishBenchmark();
        // Force final update of UI
    }

    // Current Pi Calculation
    const pi = 4 * (insidePoints / totalPoints);

    // To string, fixed 8
    const piStr = pi.toFixed(8);
    piValueEl.innerText = piStr;

    // Diff / Error
    const realPi = Math.PI;
    const diff = pi - realPi;
    const percentError = (Math.abs(diff) / realPi) * 100;

    piDiffEl.textContent = `(Err: ${diff.toExponential(2)})`;

    // Accuracy
    const accuracy = Math.max(0, 100 - percentError);
    accuracyText.textContent = `${accuracy.toFixed(5)}%`;
    progressBar.style.width = `${Math.min(100, accuracy)}%`;

    // Color code accuracy bar
    if (accuracy > 99.999) progressBar.style.background = '#f472b6'; // Godlike
    else if (accuracy > 99.9) progressBar.style.background = '#34d399'; // Good
    else progressBar.style.background = ''; // Normal

    // Counts
    // Use smaller font or condensed format if numbers get HUGE
    totalPointsEl.innerText = new Intl.NumberFormat('de-DE').format(totalPoints);
    insidePointsEl.innerText = new Intl.NumberFormat('de-DE').format(insidePoints);

    // Timer
    timerEl.innerText = formatTime(elapsed);
}

// Event Listeners
startBtn.addEventListener('click', () => {
    if (isRunning) return;

    // Get settings
    durationSeconds = parseInt(durationInput.value);
    const numThreads = parseInt(threadInput.value);
    document.getElementById('threadCount').textContent = numThreads;

    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // Reset stats if starting fresh
    if (startTime === 0 && totalPoints === 0) {
        startTime = performance.now();
        lastPpsCheck = startTime;
        ppsSum = 0;
        ppsSamples = 0;
    } else {
        lastPpsCheck = performance.now();
        pointsThisSecond = 0;
    }

    // Spawn Workers
    workers = [];
    for (let i = 0; i < numThreads; i++) {
        // Use Blob URL instead of external file
        const worker = new Worker(workerUrl);
        worker.onmessage = handleWorkerMessage;
        worker.postMessage({ cmd: 'start', batchSize: batchSize });
        workers.push(worker);
    }

    lastFrameTime = performance.now();
    requestAnimationFrame(loop);
});

stopBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Kill Workers
    workers.forEach(w => w.terminate());
    workers = [];
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Kill Workers
    workers.forEach(w => w.terminate());
    workers = [];

    totalPoints = 0;
    insidePoints = 0;
    startTime = 0;
    pointsThisSecond = 0;
    ppsSum = 0;
    ppsSamples = 0;

    // UI Reset
    piValueEl.textContent = "3.00000000";
    piDiffEl.textContent = "";
    ppsDisplay.textContent = "0";
    totalPointsEl.textContent = "0";
    timerEl.textContent = "00:00:00";
    accuracyText.textContent = "0.00000%";
    progressBar.style.width = "0%";
    progressBar.style.background = '';

    // Clear Canvas
    buf.fill(0xFF000000); // Black
    ctx.putImageData(imageData, 0, 0);

    // Draw outline again
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Update Image Data from canvas
    imageData = ctx.getImageData(0, 0, width, height);
    buf = new Uint32Array(imageData.data.buffer);
});

// Update batch size input
batchInput.addEventListener('input', (e) => {
    batchSize = parseInt(e.target.value);
    if (isRunning) {
        workers.forEach(w => w.postMessage({ cmd: 'update_batch', batchSize: batchSize }));
    }

    let val = batchSize;
    if (val >= 1000000) batchDisplay.textContent = (val / 1000000).toFixed(1) + 'M';
    else if (val >= 1000) batchDisplay.textContent = (val / 1000).toFixed(0) + 'k';
    else batchDisplay.textContent = val;
});

// Duration Input
durationInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    durationDisplay.textContent = val === 0 ? "Endlos" : `${val}s`;
});

// Thread Input
threadInput.addEventListener('input', (e) => {
    threadDisplay.textContent = e.target.value;
    // We don't update running workers dynamically for complexity reasons, 
    // user must restart to change thread count (standard behavior for benchmarks)
});

// Modal Close
closeModalBtn.addEventListener('click', () => {
    resultsModal.classList.add('hidden');
});

// Close modal on click outside
resultsModal.addEventListener('click', (e) => {
    if (e.target === resultsModal) {
        resultsModal.classList.add('hidden');
    }
});

// Init
init();
