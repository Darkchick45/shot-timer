let audioContext;
let analyser;
let microphone;
let javascriptNode;
let startTime;
let isRunning = false;
const noSleep = new NoSleep();

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const newStringBtn = document.getElementById('newStringBtn');
const display = document.getElementById('display');
const splitsDiv = document.getElementById('splits');
const currentStringDiv = document.getElementById('currentString');
const settingsPanel = document.getElementById('settingsPanel');

// Inputs
const delayType = document.getElementById('delayType');
const parTimeInput = document.getElementById('parTime');
const sensitivitySlider = document.getElementById('sensitivity');
const sensValueDisplay = document.getElementById('sensValueDisplay');

// Update UI number when sliding
sensitivitySlider.addEventListener('input', (e) => {
    sensValueDisplay.innerText = e.target.value;
});

let currentShots = [];
let runCount = 1;
let parOsc; // Keep track so we can cancel it if stopped early

startBtn.addEventListener('click', async () => {
    noSleep.enable();

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        alert("Microphone access is required.");
        return;
    }
    
    // UI Updates
    startBtn.style.display = 'none';
    settingsPanel.style.display = 'none';
    newStringBtn.style.display = 'none';
    currentStringDiv.style.display = 'block';
    
    // Clear current run (but keep history)
    currentShots = [];
    splitsDiv.innerHTML = '';
    display.innerText = "READY";
    
    // Calculate Delay
    let delayMs = 0;
    if (delayType.value === 'fixed') delayMs = 3000;
    else if (delayType.value === 'random') delayMs = 2000 + Math.random() * 3000;

    setTimeout(() => {
        if (startBtn.style.display === 'none' && !isRunning) { // ensure not cancelled
            playBeep();
            initCapture(stream);
        }
    }, delayMs);
});

function playBeep() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
    
    startTime = audioContext.currentTime;
    isRunning = true;
    stopBtn.style.display = 'block';
    
    // Schedule Par Time beep if set
    const pTime = parseFloat(parTimeInput.value);
    if (pTime > 0) {
        parOsc = audioContext.createOscillator();
        const parGain = audioContext.createGain();
        parOsc.connect(parGain);
        parGain.connect(audioContext.destination);
        
        parOsc.frequency.value = 1200; // higher pitch for par time
        parGain.gain.setValueAtTime(0, startTime + pTime);
        parGain.gain.linearRampToValueAtTime(1, startTime + pTime + 0.05);
        parGain.gain.exponentialRampToValueAtTime(0.001, startTime + pTime + 0.5);
        parOsc.start(startTime + pTime);
        parOsc.stop(startTime + pTime + 0.5);
    }
    
    updateDisplay();
}

async function initCapture(stream) {
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (javascriptNode) javascriptNode.disconnect();

    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
        if (!isRunning) return;
        
        const array = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(array);
        
        let peak = 0;
        for (let i = 0; i < array.length; i++) {
            if (Math.abs(array[i]) > peak) peak = Math.abs(array[i]);
        }

        // Sensitivity 0-100 mapped to threshold logic
        const val = parseInt(sensitivitySlider.value);
        let threshold = (100 - val) / 100;
        if (threshold < 0.02) threshold = 0.02;

        if (peak > threshold) {
            recordShot(audioContext.currentTime - startTime);
        }
    };
}

function recordShot(time) {
    // 0.12s lockout to prevent double taps
    const lastShotTime = currentShots.length > 0 ? currentShots[currentShots.length - 1] : 0;
    if (time - lastShotTime < 0.12) return;
    
    const split = (time - lastShotTime).toFixed(2);
    currentShots.push(time);

    const entry = document.createElement('div');
    entry.className = 'shot-entry';
    
    const shotNum = document.createElement('span');
    shotNum.innerText = `Shot ${currentShots.length}`;
    
    const times = document.createElement('span');
    times.innerHTML = `${time.toFixed(2)}s <span class="split-time">(+${split})</span>`;
    
    entry.appendChild(shotNum);
    entry.appendChild(times);
    
    splitsDiv.prepend(entry);
    
    document.body.style.background = '#ef4444';
    setTimeout(() => document.body.style.background = 'var(--bg-color)', 50);
}

function updateDisplay() {
    if (!isRunning) return;
    display.innerText = (audioContext.currentTime - startTime).toFixed(2);
    requestAnimationFrame(updateDisplay);
}

function stopTimer() {
    isRunning = false;
    stopBtn.style.display = 'none';
    startBtn.style.display = 'block';
    startBtn.innerText = "RESUME / START";
    settingsPanel.style.display = 'block';
    
    if (parOsc) {
        try { parOsc.stop(); } catch(e) {}
    }
    
    if (currentShots.length > 0) {
        newStringBtn.style.display = 'block';
    }
}

stopBtn.addEventListener('click', stopTimer);

newStringBtn.addEventListener('click', () => {
    if (currentShots.length === 0) return;
    
    const historyBlock = document.createElement('div');
    historyBlock.className = 'string-block';
    
    const header = document.createElement('div');
    header.className = 'string-header';
    header.innerHTML = `<span>Run ${runCount}</span> <span>${currentShots[currentShots.length-1].toFixed(2)}s</span>`;
    
    const splitsClone = splitsDiv.cloneNode(true);
    splitsClone.id = '';
    
    historyBlock.appendChild(header);
    historyBlock.appendChild(splitsClone);
    
    const histContainer = document.getElementById('historyContainer');
    histContainer.insertBefore(historyBlock, currentStringDiv.nextSibling);
    
    runCount++;
    currentShots = [];
    splitsDiv.innerHTML = '';
    display.innerText = "0.00";
    newStringBtn.style.display = 'none';
    currentStringDiv.style.display = 'none';
    startBtn.innerText = "START";
});