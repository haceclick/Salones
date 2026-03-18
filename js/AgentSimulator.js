
const { useState, useEffect, useRef, useMemo } = React;

const CLIENT_PORTAL_LINK = window.SCRIPT_URL ? `${window.SCRIPT_URL}?view=client` : "https://myapp.com/client";

const INITIAL_AGENT_CONFIG = {
  id: 'agent_config',
  businessName: "haceclick-ai",
  agentName: "La secre virtual",
  tone: 'amigable', 
  address: "",
  mapsUrl: "", 
  contactPhone: "",
  schedulerUrl: CLIENT_PORTAL_LINK, 
  paymentUrl: "", 
  depositAmount: 1000,
  currency: "ARS",
  cancellationPolicy: "24hs de anticipación.",
  extraInstructions: "Solo aceptamos efectivo para el saldo restante.",
  services: [] 
};

// =====================================================================
// 🧠 BUSCADOR INTELIGENTE DE SERVICIOS (Tolerante a plurales/errores)
// =====================================================================
const findService = (searchName, services) => {
    if (!searchName || !services || services.length === 0) return null;
    
    // Limpieza total (minúsculas, sin acentos)
    const cleanSearch = String(searchName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Intento 1: Coincidencia directa o contenido (ej: "belleza de manos" en "belleza de manos y pies")
    let found = services.find(s => {
        const cleanName = String(s.name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return cleanName === cleanSearch || cleanName.includes(cleanSearch) || cleanSearch.includes(cleanName);
    });
    
    if (found) return found;

    // Intento 2: Coincidencia difusa (Singular/Plural) - Quitando la "s" final de las palabras clave
    const searchWords = cleanSearch.split(' ').map(w => w.replace(/s$/, ''));
    return services.find(s => {
        const cleanName = String(s.name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const nameWords = cleanName.split(' ').map(w => w.replace(/s$/, ''));
        
        // Si alguna palabra clave de más de 3 letras coincide
        return searchWords.some(sw => sw.length >= 3 && nameWords.some(nw => nw === sw || nw.includes(sw) || sw.includes(nw)));
    });
};

// =====================================================================
// 🧠 MOTOR MATEMÁTICO IA
// =====================================================================

const getProfShift = (p, dayIndex) => {
    let sh = 8, sm = 0, eh = 20, em = 0;
    let useDaily = false;
    
    let wDays = p.workingDays;
    if (typeof wDays === 'string') { try { wDays = JSON.parse(wDays); } catch(e){} }
    
    if (Array.isArray(wDays) && wDays[dayIndex]) {
        const dConf = wDays[dayIndex];
        if (dConf.start && dConf.end && (dConf.active === true || String(dConf.active).toLowerCase() === 'true')) {
            let startStr = String(dConf.start).replace(':', '');
            if (startStr.length <= 2) { sh = parseInt(startStr, 10); sm = 0; }
            else { 
                startStr = startStr.padStart(4, '0');
                sh = parseInt(startStr.substring(0,2), 10); 
                sm = parseInt(startStr.substring(2,4), 10); 
            }
            
            let endStr = String(dConf.end).replace(':', '');
            if (endStr.length <= 2) { eh = parseInt(endStr, 10); em = 0; }
            else {
                endStr = endStr.padStart(4, '0');
                eh = parseInt(endStr.substring(0,2), 10);
                em = parseInt(endStr.substring(2,4), 10);
            }
            useDaily = true;
        }
    }
    
    if (!useDaily) {
        if (p.startHour && String(p.startHour).trim() !== '') {
            const pts = String(p.startHour).split(':');
            sh = parseInt(pts[0], 10) || 8; sm = parseInt(pts[1], 10) || 0;
        }
        if (p.endHour && String(p.endHour).trim() !== '') {
            const pts = String(p.endHour).split(':');
            eh = parseInt(pts[0], 10) || 20; em = parseInt(pts[1], 10) || 0;
        }
    }
    
    return { sh, sm, eh, em };
};

const getAvailableSlots = (dateStr, appointments, services = [], serviceName = null, professionals = []) => {
    if (!dateStr) return [];
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return [];
    
    const selectedDateObj = new Date(year, month - 1, day);
    const todayZero = new Date();
    todayZero.setHours(0,0,0,0);
    if (selectedDateObj < todayZero) return []; 

    const jsDayOfWeek = selectedDateObj.getDay(); 
    const dayIndex = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; 

    // Aquí usamos el nuevo buscador inteligente
    let targetService = findService(serviceName, services) || services[0];
    
    const duration = targetService && targetService.duration ? parseInt(String(targetService.duration).replace(/\D/g, '')) || 30 : 30;

    const safeProfs = (!professionals || professionals.length === 0) ? [] : professionals;
    
    const workingProfs = safeProfs.filter(p => {
        let doesService = false;
        let specs = p.specialties;
        if (typeof specs === 'string') { try { specs = JSON.parse(specs); } catch(e){ specs = [specs]; } }
        
        if (Array.isArray(specs) && specs.length > 0) {
            const tCat = targetService.category ? String(targetService.category).toLowerCase().trim() : '';
            const tName = targetService.name ? String(targetService.name).toLowerCase().trim() : '';
            
            doesService = specs.some(sp => {
                const s = String(sp).toLowerCase().trim();
                return (tCat && s === tCat) || (tName && s === tName) || 
                       (tCat && s.includes(tCat)) || (tName && s.includes(tName));
            });
        } else {
            doesService = true; 
        }
        
        if (!doesService) return false; 

        let wDays = p.workingDays;
        if (typeof wDays === 'string') { try { wDays = JSON.parse(wDays); } catch(e){} }
        if (Array.isArray(wDays) && wDays.length > dayIndex) {
            const dayConfig = wDays[dayIndex];
            if (!dayConfig || (dayConfig.active !== true && String(dayConfig.active).toLowerCase() !== 'true')) return false; 
        } else {
            return false;
        }
        return true;
    });

    if (workingProfs.length === 0) return []; 

    let minStartH = 24;
    let maxEndH = 0;
    
    workingProfs.forEach(p => {
        const shift = getProfShift(p, dayIndex);
        if (shift.sh < minStartH) minStartH = shift.sh;
        if (shift.eh > maxEndH) maxEndH = shift.eh;
    });

    if (minStartH >= 24) minStartH = 8;
    if (maxEndH <= 0) maxEndH = 20;

    const slots = [];
    for (let h = minStartH; h < maxEndH; h++) {
        slots.push(`${h < 10 ? '0'+h : h}:00`);
        slots.push(`${h < 10 ? '0'+h : h}:30`);
    }

    const safeAppts = Array.isArray(appointments) ? appointments : [];

    return slots.filter(timeStr => {
        const [h, m] = timeStr.split(':').map(Number);
        const slotStart = new Date(year, month - 1, day, h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        if (slotStart < new Date()) return false; 

        const availableProfs = workingProfs.filter(p => {
            const shift = getProfShift(p, dayIndex);
            const pStart = new Date(year, month - 1, day, shift.sh, shift.sm, 0, 0);
            const pEnd = new Date(year, month - 1, day, shift.eh, shift.em, 0, 0);

            if (slotStart < pStart || slotEnd > pEnd) return false;

            const isOccupied = safeAppts.some(a => {
                if (a.status === 'cancelled') return false;
                if (a.professionalId !== 'any' && a.professionalId !== 'ALL' && a.professionalId !== p.id) return false;
                
                const aDate = new Date(a.date);
                if (isNaN(aDate.getTime())) return false; 
                
                if (a.status === 'holiday') {
                    if (aDate.getDate() === day && aDate.getMonth() === month - 1 && aDate.getFullYear() === year) return true;
                    return false;
                }

                if (aDate.getDate() !== day || aDate.getMonth() !== month - 1 || aDate.getFullYear() !== year) return false;

                let aEnd;
                if (a.treatmentId === 'BLOCK' || a.status === 'blocked') {
                    aEnd = new Date(aDate.getTime() + 60 * 60000); 
                    if (a.endDate) aEnd = new Date(a.endDate); 
                } else {
                    const apptTr = services.find(x => x.id === a.treatmentId);
                    const apptDuration = apptTr && apptTr.duration ? parseInt(String(apptTr.duration).replace(/\D/g, '')) || 30 : 30;
                    aEnd = new Date(aDate.getTime() + apptDuration * 60000);
                }
                
                return slotStart < aEnd && slotEnd > aDate;
            });

            return !isOccupied; 
        });

        return availableProfs.length > 0;
    });
};
// =====================================================================

const callGeminiAPI = async (history, config) => {
    if (!window.GOOGLE_API_KEY) throw new Error("Falta la API Key");

    const today = new Date();
    const isoDate = today.toISOString().split('T')[0];
    const dateString = today.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const servicesList = config.services && config.services.length > 0 
        ? config.services.map(s => `- ${s.name}: $${s.price || 0} (${s.duration || 30} min)`).join('\n')
        : "Consultar lista de precios.";

    const systemInstruction = `
      ERES: ${config.agentName}, asistente de "${config.businessName}". TONO: ${config.tone}.
      FECHA ACTUAL: Hoy es ${dateString}. (Formato YYYY-MM-DD: ${isoDate}). 
      
      SERVICIOS DISPONIBLES: \n${servicesList}
      
      REGLA DE ORO: Si saludan ("Hola"), responde solo saludando. ¡PROHIBIDO listar servicios a menos que te pregunten!
      
      IMPORTANTE: Antes de revisar la agenda, vincula lo que pide el cliente con un servicio de tu lista. Si te pide algo parecido (ej. "axila" y tienes "Axilas"), asume que es ese. Si pide algo que CLARAMENTE NO TIENES en la lista, NO revises la agenda.
      
      HERRAMIENTAS ESPECIALES (NUNCA USES JSON):
      1. __REVISAR_AGENDA__|YYYY-MM-DD|Nombre del servicio de tu lista
      2. __BUSCAR_CLIENTE__|NumeroWhatsApp
      3. __NUEVO_CLIENTE__|Telefono|Nombre|Email|YYYY-MM-DD
      4. __AGENDAR_TURNO__|YYYY-MM-DD|HH:MM|ID_DEL_CLIENTE|Nombre del servicio de tu lista
    `;

    const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: history,
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${window.GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`API Error ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

const WhatsAppSimulator = ({ config, chatId, appointments, settings, saveAppointments, notify, clients = [], saveClients, professionals = [] }) => {
  const [messages, setMessages] = useState([{id: 'welcome', role: 'model', text: `¡Hola! Soy ${config.agentName}. ¿En qué puedo ayudarte?`, timestamp: new Date()}]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const historyRef = useRef([]);

  const formatAvailabilityText = (dateStr, serviceName) => {
     // USAMOS EL BUSCADOR INTELIGENTE PARA VER SI EL SERVICIO EXISTE ANTES DE BUSCAR TURNOS
     const targetService = findService(serviceName, config.services);
     
     if (!targetService) {
         const nombresServicios = config.services.map(s => s.name).join(', ');
         return `[SISTEMA] No encontré un servicio que coincida bien con "${serviceName}". Dile amablemente al cliente que no ofreces exactamente eso y dale opciones de lo que sí tienes: ${nombresServicios}.`;
     }

     const slots = getAvailableSlots(dateStr, appointments, config.services, targetService.name, professionals);
     if (slots.length === 0) return `Lo siento, no tenemos turnos disponibles el ${dateStr} para ${targetService.name}. ¿Probamos otra fecha?`;
     
     const morning = slots.filter(s => parseInt(s) < 12);
     const afternoon = slots.filter(s => parseInt(s) >= 12);
     let text = `¡Perfecto! Para *${targetService.name}* el ${dateStr} tengo estos horarios:\n`;
     if (morning.length) text += `*Mañana:* ${morning.join(', ')}\n`;
     if (afternoon.length) text += `*Tarde:* ${afternoon.join(', ')}\n`;
     text += `\n¿Qué horario te queda mejor?`;
     return text;
  };

  const handleBookTool = (dateStr, timeStr, clientId, serviceName) => {
      try {
          const [year, month, day] = dateStr.split('-').map(Number);
          const [hours, minutes] = timeStr.split(':').map(Number);
          const isoDate = new Date(year, month - 1, day, hours, minutes).toISOString();
          
          const targetService = findService(serviceName, config.services);
          if (!targetService) return { success: false, msg: "Servicio no encontrado" };
          
          const treatmentId = targetService.id;
          
          if(appointments.some(a => a.date === isoDate && a.status !== 'cancelled' && a.treatmentId === treatmentId)) return { success: false };

          const newAppt = { id: Date.now().toString(), clientId: clientId, treatmentId: treatmentId, professionalId: 'any', date: isoDate, status: 'reserved', origin: 'bot' };
          saveAppointments([...appointments, newAppt]);
          if(notify) notify("¡Nueva Solicitud IA!", "info");
          return { success: true, serviceName: targetService.name };
      } catch (e) { return { success: false }; }
  };

  useEffect(() => { 
      setMessages([{id: 'welcome', role: 'model', text: `¡Hola! Soy ${config.agentName}. ¿En qué puedo ayudarte?`, timestamp: new Date()}]); 
      setInputValue(''); historyRef.current = []; 
  }, [chatId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userText = inputValue;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText, timestamp: new Date() }]);
    setInputValue(''); setIsTyping(true);
    historyRef.current.push({ role: 'user', parts: [{ text: userText }] });

    try {
        let responseText = await callGeminiAPI(historyRef.current, config);
        
        let isInternalTool = true;
        let loopGuard = 0;
        
        while (isInternalTool && loopGuard < 3) {
            loopGuard++;
            if (responseText.includes('__BUSCAR_CLIENTE__')) {
                const parts = responseText.split('|');
                const phone = parts[1]?.trim();
                const client = clients.find(c => c.phone && c.phone.includes(phone));
                historyRef.current.push({ role: 'model', parts: [{ text: responseText }] });
                let systemMsg = client ? `[SISTEMA] Cliente encontrado: ${client.name} (ID: ${client.id}). Pregúntale la hora y usa su ID para agendar.` : `[SISTEMA] Cliente NO encontrado. Pídele Nombre, Email y Fecha Nacimiento (YYYY-MM-DD).`;
                historyRef.current.push({ role: 'user', parts: [{ text: systemMsg }] });
                responseText = await callGeminiAPI(historyRef.current, config);
            } else if (responseText.includes('__NUEVO_CLIENTE__')) {
                const parts = responseText.split('|');
                const newClient = { id: 'CLI-' + Date.now(), phone: parts[1]?.trim(), name: parts[2]?.trim(), email: parts[3]?.trim(), birthday: parts[4]?.trim() };
                if (saveClients) saveClients([...clients, newClient]);
                historyRef.current.push({ role: 'model', parts: [{ text: responseText }] });
                historyRef.current.push({ role: 'user', parts: [{ text: `[SISTEMA] Creado. Su ID es: ${newClient.id}. Confírmale la hora y agenda.` }] });
                responseText = await callGeminiAPI(historyRef.current, config);
            } else {
                isInternalTool = false;
            }
        }

        if (responseText.includes('__REVISAR_AGENDA__')) {
            const parts = responseText.split('|');
            responseText = formatAvailabilityText(parts[1]?.trim(), parts[2]?.trim());
            
            // Si el servicio existe, mandamos a la IA a pedir el WhatsApp. Si no existe, la IA le ofrecerá las opciones.
            if (!responseText.includes("[SISTEMA]") && !responseText.includes("Lo siento")) {
                responseText += "\n\nPara continuar, ¿me pasas tu número de WhatsApp con código de área?";
            } else if (responseText.includes("[SISTEMA]")) {
                // Forzamos a la IA a que procese el mensaje del sistema
                historyRef.current.push({ role: 'user', parts: [{ text: responseText }] });
                responseText = await callGeminiAPI(historyRef.current, config);
            }
            
        } else if (responseText.includes('__AGENDAR_TURNO__')) {
            const match = responseText.match(/__AGENDAR_TURNO__\|([^|]+)\|([^|]+)\|([^|]+)\|([^\n|]+)/);
            
            if (match) {
                const dateStr = match[1].trim();
                const timeStr = match[2].trim();
                const clientId = match[3].trim();
                const serviceName = match[4].trim();
                
                const result = handleBookTool(dateStr, timeStr, clientId, serviceName);
                
                if (result.success) {
                    let cleanText = responseText.replace(/__AGENDAR_TURNO__\|[^\n]*/, '').trim();
                    if (!cleanText || cleanText.length < 5) {
                        const clientName = clients.find(c => c.id === clientId)?.name || '';
                        cleanText = `📝 ¡Listo ${clientName}! Tu solicitud para ${result.serviceName} el ${dateStr} a las ${timeStr} hs quedó registrada.`;
                    }
                    responseText = `${cleanText}\n\n⚠️ Tu turno está en estado de *Reserva*. En breve lo revisaremos para confirmarlo.`;
                } else {
                    responseText = `Uy, parece que ese horario acaba de ocuparse o hubo un problema. ¿Me confirmas para cuándo querías?`;
                }
            }
        }
        
        historyRef.current.push({ role: 'model', parts: [{ text: responseText }] });
        setMessages(p => [...p, { id: Date.now(), role: 'model', text: responseText, timestamp: new Date() }]);
        
    } catch (e) { 
        let errMsg = "⚠️ Error técnico. Intenta en unos segundos.";
        if (e.message.includes('429')) errMsg = "🛑 Espera 1 minuto por favor.";
        setMessages(p => [...p, { id: Date.now(), role: 'model', text: errMsg, timestamp: new Date() }]); 
    }
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-sm mx-auto bg-[#efeae2] relative overflow-hidden shadow-2xl rounded-3xl border-8 border-gray-800">
      <div className="bg-[#00a884] p-3 flex items-center justify-between text-white z-10 shrink-0"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"><Icon name="bot" size={20}/></div><div className="flex flex-col"><span className="font-semibold text-sm">{config.businessName}</span><span className="text-[10px] text-white/80">{isTyping ? 'Escribiendo...' : 'En línea'}</span></div></div></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 z-10">
        {messages.map(msg => (<div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm text-sm ${msg.role === 'user' ? 'bg-[#d9fdd3] text-black' : 'bg-white text-black whitespace-pre-line'}`}>{msg.text}</div></div>))}
      </div>
      <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 z-10"><input className="w-full bg-white rounded-full px-4 py-2 border-none text-sm focus:outline-none" placeholder="Escribe un mensaje..." value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}/><button onClick={handleSend} className="bg-[#00a884] p-2 rounded-full text-white"><Icon name="send" size={16} /></button></div>
    </div>
  );
};

const AgentBuilder = ({ treatments, appointments, settings, saveAppointments, initialSettings, onSaveSettings, notify, clients, saveClients, professionals }) => {
  const [config, setConfig] = useState(INITIAL_AGENT_CONFIG);
  const [chatId, setChatId] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
      if (!hasLoaded && initialSettings && Array.isArray(initialSettings)) {
        const saved = initialSettings.find(s => s.id === 'agent_config');
        if (saved) {
            setConfig(prev => ({ ...prev, ...saved, services: treatments || [] }));
        } else {
            setConfig(prev => ({ ...prev, services: treatments || [] }));
        }
        setHasLoaded(true); 
      }
  }, [initialSettings, treatments, hasLoaded]);

  const handleSave = () => { 
      try {
          let currentSettings = Array.isArray(initialSettings) ? initialSettings : [];
          let others = currentSettings.filter(s => s.id !== 'agent_config');
          const newSettingsArray = [...others, config];

          onSaveSettings('settings', newSettingsArray);
          
          setChatId(p => p + 1); 
          if(notify) notify("Configuración guardada", "success");
      } catch (e) {
          console.error(e);
      }
  };

  const handleChange = (k, v) => setConfig(p => ({...p, [k]:v}));

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full p-4 overflow-hidden">
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Icon name="settings"/> Configuración IA</h2>
            <button 
                onClick={(e) => { e.preventDefault(); handleSave(); }} 
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold hover:opacity-90 flex items-center gap-2 transition-colors"
            >
                <Icon name="save" size={16}/> Guardar
            </button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Identidad</h3>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Negocio</label><input className="w-full border p-2 rounded text-sm" value={config.businessName || ''} onChange={e=>handleChange('businessName', e.target.value)}/></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Nombre Agente</label><input className="w-full border p-2 rounded text-sm" value={config.agentName || ''} onChange={e=>handleChange('agentName', e.target.value)}/></div>
            </div>
            
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1 mt-4">Contacto y Ubicación</h3>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Teléfono / Wa</label><input className="w-full border p-2 rounded text-sm" value={config.contactPhone || ''} onChange={e=>handleChange('contactPhone', e.target.value)}/></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Dirección Física</label><input className="w-full border p-2 rounded text-sm" value={config.address || ''} onChange={e=>handleChange('address', e.target.value)}/></div>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Link de Google Maps</label><input className="w-full border p-2 rounded text-sm" placeholder="URL de Maps..." value={config.mapsUrl || ''} onChange={e=>handleChange('mapsUrl', e.target.value)}/></div>
            
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1 mt-4">Políticas y Pagos</h3>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 my-2">
                <label className="flex items-center cursor-pointer gap-3">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 text-green-600 rounded"
                        checked={config.requireDeposit || false} 
                        onChange={e => handleChange('requireDeposit', e.target.checked)} 
                    />
                    <span className="text-sm font-bold text-gray-700">Solicitar seña previa para confirmar</span>
                </label>
            </div>

            <div><label className="text-xs text-gray-500 mb-1 block">Link de Pago (Mercado Pago / Otros)</label><input className="w-full border p-2 rounded text-sm" value={config.paymentUrl || ''} onChange={e=>handleChange('paymentUrl', e.target.value)}/></div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500 mb-1 block">Monto Seña ($)</label><input type="number" className="w-full border p-2 rounded text-sm" value={config.depositAmount || 0} onChange={e=>handleChange('depositAmount', Number(e.target.value))}/></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Política Cancelación</label><input className="w-full border p-2 rounded text-sm" value={config.cancellationPolicy || ''} onChange={e=>handleChange('cancellationPolicy', e.target.value)}/></div>
            </div>
            
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1 mt-4">Instrucciones Extra</h3>
            <textarea className="w-full border p-2 rounded text-sm h-20 resize-none" value={config.extraInstructions || ''} onChange={e=>handleChange('extraInstructions', e.target.value)}></textarea>
         </div>
      </div>
      
      <div className="w-full lg:w-[400px]">
          <WhatsAppSimulator config={config} chatId={chatId} appointments={appointments} settings={settings} saveAppointments={saveAppointments} notify={notify} clients={clients} saveClients={saveClients} professionals={professionals} />
      </div>
    </div>
  );
};
window.AgentBuilder = AgentBuilder;
