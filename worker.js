/* Worker for Pi Benchmark */
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
        // Random point -1 to 1
        // We use simple Math.random(). 
        // For cryptographic benchmarks we'd use crypto.getRandomValues but that's slow.
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;

        if ((x * x + y * y) <= 1) {
            inside++;
        }
    }

    // Send back results
    // We send just the aggregates to keep main thread light
    self.postMessage({
        inside: inside,
        total: total
    });

    // Keep running
    // We use a MessageChannel hack or just simple recursion with zero timeout 
    // to prevent call stack issues but keep high utilization
    if (isRunning) {
        setTimeout(loop, 0);
    }
}
