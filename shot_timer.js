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

const delayType = document.getElementById('delayType');
const parTimeInput = document.getElementById('parTime');
const targetShotsInput = document.getElementById('targetShots');
const sensitivitySlider = document.getElementById('sensitivity');
const sensValueDisplay = document.getElementById('sensValueDisplay');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const deleteAllBtn = document.getElementById('deleteAllBtn');

// Update UI number when sliding
sensitivitySlider.addEventListener('input', (e) => {
    sensValueDisplay.innerText = e.target.value;
});

let allRuns = [];
try {
    const localData = localStorage.getItem('shotTimer_allRuns');
    if (localData) {
        allRuns = JSON.parse(localData);
        // Wait for DOM to load before rendering
        setTimeout(renderHistory, 100);
    }
} catch (e) { console.error('Storage err:', e); }

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
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true }, video: false });
    } catch (err) {
        alert("Microphone access is required.");
        return;
    }
    
    const isResume = startBtn.innerText === "RESUME";

    // UI Updates
    document.querySelectorAll('.data-actions').forEach(el => el.style.display = 'none');
    startBtn.style.display = 'none';
    settingsPanel.style.display = 'none';
    newStringBtn.style.display = 'none';
    currentStringDiv.style.display = 'block';
    
    // Clear current run ONLY if it's a fresh start
    if (!isResume) {
        currentShots = [];
        splitsDiv.innerHTML = '';
        display.innerText = "READY";
    }
    
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
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    osc.start();
    osc.stop(audioContext.currentTime + 0.3);
    
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
    // Ignore any sound registered while the start beep is playing (0.3s beep + 0.05s buffer)
    if (time < 0.35) return;

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

    const target = parseInt(targetShotsInput.value, 10);
    if (target > 0 && currentShots.length >= target) {
        stopTimer();
    }
}

function updateDisplay() {
    if (!isRunning) return;
    display.innerText = (audioContext.currentTime - startTime).toFixed(2);
    requestAnimationFrame(updateDisplay);
}

function stopTimer() {
    isRunning = false;
    stopBtn.style.display = 'none';
    
    startBtn.className = "btn btn-small-blue";
    startBtn.innerText = "RESUME";
    startBtn.style.display = 'block';
    
    settingsPanel.style.display = 'block';
    document.querySelectorAll('.data-actions').forEach(el => el.style.display = 'flex');
    
    if (parOsc) {
        try { parOsc.stop(); } catch(e) {}
    }
    
    if (currentShots.length > 0) {
        newStringBtn.className = "btn btn-large-green";
        newStringBtn.style.display = 'block';
    }
}

stopBtn.addEventListener('click', stopTimer);

function getGeoLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("Geo Not Supported");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
            },
            (err) => {
                resolve("Location Denied");
            },
            { timeout: 4000 }
        );
    });
}

newStringBtn.addEventListener('click', async () => {
    if (currentShots.length === 0) return;
    
    newStringBtn.disabled = true;
    newStringBtn.innerText = "SAVING...";

    const geoLoc = await getGeoLocation();
    
    const runData = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        location: geoLoc,
        shots: [...currentShots],
        settings: {
            delayType: delayType.value,
            parTime: parseFloat(parTimeInput.value) || 0,
            targetShots: parseInt(targetShotsInput.value, 10) || 0,
            sensitivity: parseInt(sensitivitySlider.value, 10)
        }
    };
    allRuns.push(runData);
    
    renderHistory();
    
    currentShots = [];
    splitsDiv.innerHTML = '';
    display.innerText = "READY";
    newStringBtn.style.display = 'none';
    currentStringDiv.style.display = 'none';
    
    startBtn.className = "btn btn-large-green";
    startBtn.innerText = "START";
    
    newStringBtn.disabled = false;
    newStringBtn.innerText = "START";
    
    // Auto-start the new round seamlessly
    startBtn.click();
});

function renderHistory() {
    const histContainer = document.getElementById('historyContainer');
    
    // Remove old saved runs from UI
    document.querySelectorAll('.history-block-saved').forEach(el => el.remove());
    
    // Render normal order, because insertBefore pushes older runs down, leaving newest on top!
    allRuns.forEach((run, index) => {
        const historyBlock = document.createElement('div');
        historyBlock.className = 'string-block history-block-saved';
        
        const header = document.createElement('div');
        header.className = 'string-header';
        
        const runNum = index + 1;
        const lastShotTime = run.shots.length > 0 ? run.shots[run.shots.length-1].toFixed(2) : "0.00";
        
        // Build settings summary string if settings were saved
        let settingsParts = [];
        if (run.settings) {
            const s = run.settings;
            const delayLabel = s.delayType === 'fixed' ? 'Fixed 3s delay' : s.delayType === 'random' ? 'Random delay' : 'No delay';
            settingsParts.push(delayLabel);
            if (s.parTime > 0) settingsParts.push(`Par ${s.parTime}s`);
            if (s.targetShots > 0) settingsParts.push(`Auto-stop @${s.targetShots}`);
            settingsParts.push(`Sensitivity ${s.sensitivity}`);
        }
        const settingsStr = settingsParts.length > 0
            ? `<span style="font-size:0.7rem; font-weight:normal; display:block; color:var(--text-muted); margin-top:1px; opacity:0.8;">${settingsParts.join(' · ')}</span>`
            : '';
        
        header.innerHTML = `
            <div style="line-height: 1.2;">
                <span>Run ${runNum}</span>
                <span style="font-size:0.75rem; font-weight:normal; display:block; color:var(--text-muted); margin-top:2px;">${run.date} - ${run.location}</span>
                ${settingsStr}
            </div>
            <div style="display: flex; align-items: center;">
                <span>${lastShotTime}s</span>
                <button class="delete-btn" data-id="${run.id}">X</button>
            </div>
        `;
        
        const splitsClone = document.createElement('div');
        splitsClone.style.marginTop = '10px';
        
        let lastTime = 0;
        run.shots.forEach((time, i) => {
            const split = (time - lastTime).toFixed(2);
            lastTime = time;
            
            const entry = document.createElement('div');
            entry.className = 'shot-entry';
            
            const shotNum = document.createElement('span');
            shotNum.innerText = `Shot ${i + 1}`;
            
            const times = document.createElement('span');
            times.innerHTML = `${time.toFixed(2)}s <span class="split-time">(+${split})</span>`;
            
            entry.appendChild(shotNum);
            entry.appendChild(times);
            splitsClone.prepend(entry); // Prepend to show last shot at top
        });
        
        historyBlock.appendChild(header);
        historyBlock.appendChild(splitsClone);
        
        histContainer.insertBefore(historyBlock, currentStringDiv.nextSibling);
    });

    // Automatically backup to local storage
    try {
        localStorage.setItem('shotTimer_allRuns', JSON.stringify(allRuns));
    } catch (e) {}
}

// EXPORT / IMPORT LOGIC
exportBtn.addEventListener('click', () => {
    if (allRuns.length === 0) {
        alert("No runs to export. Record some shots first!");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allRuns, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `shot_timer_export_${Date.now()}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
});

importBtn.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (Array.isArray(importedData)) {
                allRuns = allRuns.concat(importedData);
                renderHistory();
                alert(`Successfully imported ${importedData.length} runs!`);
            } else {
                alert("File format not recognized (must be a JSON array of runs).");
            }
        } catch(err) {
            console.error(err);
            alert("Error parsing JSON file. Is it corrupted?");
        }
        importFile.value = '';
    };
    reader.readAsText(file);
});

// DELETION LOGIC
document.getElementById('historyContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const idToRemove = parseInt(e.target.getAttribute('data-id'), 10);
        if (confirm("Delete this run? This cannot be undone.")) {
            allRuns = allRuns.filter(r => r.id !== idToRemove);
            renderHistory();
        }
    }
});

deleteAllBtn.addEventListener('click', () => {
    if (allRuns.length === 0) return;
    if (confirm("Are you sure you want to delete ALL history? This cannot be undone.")) {
        allRuns = [];
        renderHistory();
    }
});