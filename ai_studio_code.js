let audioContext;
let analyser;
let microphone;
let javascriptNode;
let startTime;
let isRunning = false;
const threshold = 0.3; // Sensitivity: Adjust this (0.0 to 1.0)
const noSleep = new NoSleep();

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const display = document.getElementById('display');
const splitsDiv = document.getElementById('splits');

startBtn.addEventListener('click', async () => {
    // 1. Enable NoSleep (iOS hack to keep screen on)
    noSleep.enable();

    // 2. Resume or create AudioContext (Must be triggered by user click on iOS)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    let stream;
    try {
        // Request mic access immediately on click to comply with browser policies
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        console.error("Microphone access denied or error:", err);
        alert("Microphone access is required to detect shots.");
        return;
    }
    
    // 3. Short delay before the "Beep" (Simulating a real shot timer)
    startBtn.disabled = true;
    startBtn.innerText = "GET READY...";
    
    setTimeout(() => {
        playBeep();
        initCapture(stream);
    }, 2000 + Math.random() * 2000); // Random delay 2-4 seconds
});

function playBeep() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 1000;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);
    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
    
    startTime = audioContext.currentTime;
    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    updateDisplay();
}

async function initCapture(stream) {
    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    // Use a ScriptProcessor to monitor volume levels
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
        if (!isRunning) return;
        
        const array = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(array);
        
        // Find the peak in this buffer
        let peak = 0;
        for (let i = 0; i < array.length; i++) {
            if (Math.abs(array[i]) > peak) peak = Math.abs(array[i]);
        }

        // If peak exceeds threshold, it's a "shot"
        if (peak > threshold) {
            recordShot(audioContext.currentTime - startTime);
        }
    };
}

let lastShotTime = 0;
function recordShot(time) {
    // Debounce to prevent one shot being counted multiple times (0.1s lockout)
    if (time - lastShotTime < 0.1) return;
    
    const split = (time - lastShotTime).toFixed(2);
    lastShotTime = time;

    const entry = document.createElement('div');
    entry.className = 'shot-entry';
    entry.innerHTML = `<span>Shot ${splitsDiv.children.length + 1}</span> <span>${time.toFixed(2)}s (+${split})</span>`;
    splitsDiv.prepend(entry);
    
    // Pulse the screen red for visual feedback
    document.body.style.background = 'red';
    setTimeout(() => document.body.style.background = '#111', 50);
}

function updateDisplay() {
    if (!isRunning) return;
    display.innerText = (audioContext.currentTime - startTime).toFixed(2);
    requestAnimationFrame(updateDisplay);
}

stopBtn.addEventListener('click', () => {
    isRunning = false;
    noSleep.disable();
    location.reload(); // Simple way to reset everything
});