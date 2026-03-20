// --- COMPONENTE PORTAL DE CLIENTES (INTELIGENTE Y FLEXIBLE) ---
const ClientPortal = ({ 
    alias,
    clients = [], 
    appointments = [], 
    treatments = [], 
    categories = [], 
    professionals = [], 
    settings = [], 
    notifications = [], 
    saveAppointments, 
    saveClients, 
    saveNotifications, 
    notify, 
    refreshData 
}) => {
    // --- ESTADOS DE LOGIN Y ALTA ---
    const [phone, setPhone] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [clientForm, setClientForm] = useState({ name: '', email: '', birthday: '' });
    const [currentUser, setCurrentUser] = useState(null);
    
    // ✅ NUEVOS ESTADOS DE INTERACTIVIDAD PARA BOTONES Y MODALES
    const [isCheckingLogin, setIsCheckingLogin] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false); // <-- Estado para el modal de Políticas
    
    // --- ESTADOS DEL FORMULARIO DE RESERVA ---
    const [category, setCategory] = useState('');
    const [treatmentId, setTreatmentId] = useState('');
    const [profId, setProfId] = useState('any');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [reschedulingId, setReschedulingId] = useState(null);
    
    // --- ESTADO PARA EL MODAL DE SEGURIDAD ---
    const [showSecurityModal, setShowSecurityModal] = useState(false);
        
    // --- LECTURA DE CONFIGURACIÓN ---
    const agentConfig = (settings || []).find(s => s.id === 'agent_config') || {};
    const brandingConfig = (settings || []).find(s => s.id === 'branding') || {};
    
    // =========================================================
    // 🔥 AUTO-CIERRE DE SESIÓN (TIMEOUT LOCAL SIN CONSUMIR CUOTA)
    // =========================================================
    useEffect(() => {
        // Definimos el tiempo máximo de inactividad (Ejemplo: 15 minutos)
        const SESSION_TIMEOUT = 15 * 60 * 1000; 

        const checkSessionTimeout = () => {
            const loginTime = localStorage.getItem('client_login_timestamp');
            
            if (loginTime) {
                const timeElapsed = Date.now() - parseInt(loginTime, 10);
                
                // Si ya pasó el tiempo límite...
                if (timeElapsed > SESSION_TIMEOUT) {
                    // 1. Borramos su rastro de la memoria del celular
                    localStorage.removeItem('client_login_timestamp');
                    // Si guardas el teléfono o id en localStorage, bórralo también aquí, ej:
                    // localStorage.removeItem('saved_client_phone');
                    
                    // 2. Recargamos la página forzadamente para limpiar la pantalla
                    // Esto lo devolverá a la pantalla de "Ingresa tu celular"
                    window.location.reload();
                }
            }
        };

        // Chequeamos apenas carga el componente
        checkSessionTimeout();

        // Chequeamos cada vez que el cliente minimiza y vuelve a abrir el navegador
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                checkSessionTimeout();
            }
        };
        
        document.addEventListener("visibilitychange", handleVisibility);

        // Limpieza de seguridad
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);
    
    // =====================================================================
    // 🔄 MOTOR DE MARCA BLANCA (Reemplaza Favicon y Título en el navegador)
    // =====================================================================
    React.useEffect(() => {
        // 1. Cambiar el Icono de la pestaña (Favicon) por el Logo del Local
        if (brandingConfig.logoBase64) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = brandingConfig.logoBase64;
        }
        
        // 2. Cambiar el Título de la página
        if (agentConfig.businessName) {
            document.title = `${agentConfig.businessName} | Reservas`;
        } else {
            document.title = "Portal de Reservas";
        }
    }, [brandingConfig.logoBase64, agentConfig.businessName]);

    // 🛡️ EL SÚPER RESCATADOR DE ALIAS: Busca el alias en 4 lugares distintos para no perderlo JAMÁS
    const actualAlias = alias 
        || agentConfig?.tenantAlias 
        || new URLSearchParams(window.location.search).get('local') 
        || window.location.hash.replace('#/', '').replace('/', '').toLowerCase();

    // 1. LISTA DE CATEGORÍAS BLINDADA
    const categoryList = useMemo(() => {
        let list = [];
        if (categories && categories.length > 0) {
            list = categories.map(c => typeof c === 'object' ? (c.name || c.id) : c).filter(Boolean);
        }
        if (list.length === 0 && treatments && treatments.length > 0) {
            list = [...new Set((treatments || []).map(t => t?.category).filter(Boolean))];
        }
        return list;
    }, [categories, treatments]);

    // 2. FILTRO DE SERVICIOS SEGURO
    const filteredTreatments = useMemo(() => {
        if (!category) return treatments || []; 
        return (treatments || []).filter(t => 
            String(t?.category || '').trim().toLowerCase() === String(category).trim().toLowerCase()
        );
    }, [treatments, category]);

    // 3. FILTRO DE PROFESIONALES
    const filteredProfs = useMemo(() => {
        if (!treatmentId) return (professionals || []);
        const selectedT = (treatments || []).find(t => t.id === treatmentId);
        if (!selectedT) return (professionals || []);
        return (professionals || []).filter(p => !p?.specialties || p.specialties.length === 0 || p.specialties.includes(selectedT.category));
    }, [professionals, treatmentId, treatments]);

    const myAppointments = useMemo(() => {
        if (!currentUser) return [];
        return (appointments || [])
            .filter(a => a?.clientId === currentUser.id && a?.status !== 'rescheduling')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [appointments, currentUser]);

    // =====================================================================
    // MOTOR DINÁMICO DE ENCASTRE (Con Buffer/Margen Oculto)
    // =====================================================================
    const availableSlots = useMemo(() => {
        if (!date || !treatmentId) return [];
        
        const safeProfs = (!professionals || professionals.length === 0) ? [{ id: 'any', name: 'General' }] : professionals;
        const safeAppts = Array.isArray(appointments) ? appointments : [];
        const t = (treatments || []).find(x => x.id === treatmentId);
        
        const baseDuration = t?.duration ? parseInt(String(t.duration).replace(/\D/g, '')) || 30 : 30;
        const marginDuration = t?.hasMargin ? (parseInt(t?.margin) || 0) : 0;
        const totalDurationToBlock = baseDuration + marginDuration; 

        let capableProfs = safeProfs.filter(p => {
            if (!p?.specialties || p.specialties.length === 0) return true;
            return p.specialties.includes(t?.category);
        });
        
        if (profId && profId !== 'any') {
            capableProfs = capableProfs.filter(p => p.id === profId);
        }
        
        if (capableProfs.length === 0) return [];

        const [year, month, day] = date.split('-').map(Number);
        const selectedDateObj = new Date(year, month - 1, day);
        const dayIndex = selectedDateObj.getDay();

        const slotsSet = new Set(); 

        capableProfs.forEach(p => {
            let pStartH = 8, pStartM = 0, pEndH = 20, pEndM = 0;
            const dayConfig = p?.workingDays?.[dayIndex];

            if (dayConfig && dayConfig.active) {
                pStartH = parseInt(dayConfig.start.substring(0, 2), 10);
                pStartM = parseInt(dayConfig.start.substring(2, 4), 10);
                pEndH = parseInt(dayConfig.end.substring(0, 2), 10);
                pEndM = parseInt(dayConfig.end.substring(2, 4), 10);
            } else if (!p.workingDays) { 
                pStartH = parseInt(p.startHour || 8);
                pEndH = parseInt(p.endHour || 20);
            } else {
                return; 
            }

            const workStart = new Date(year, month - 1, day, pStartH, pStartM, 0);
            const workEnd = new Date(year, month - 1, day, pEndH, pEndM, 0);
            
            const occupied = safeAppts.filter(a => {
                if (a.status === 'cancelled' || a.id === reschedulingId) return false;
                const aDate = new Date(a.date);
                return a.professionalId === p.id && 
                       aDate.getDate() === day && 
                       aDate.getMonth() === month - 1 && 
                       aDate.getFullYear() === year;
            }).map(a => {
                const aStart = new Date(a.date);
                const apptTr = (treatments || []).find(x => x.id === a.treatmentId);
                const aBaseDur = apptTr?.duration ? parseInt(String(apptTr.duration).replace(/\D/g, '')) || 30 : 30;
                const aMargin = apptTr?.hasMargin ? parseInt(apptTr.margin) || 0 : 0;
                const aTotalDur = aBaseDur + aMargin;
                return { start: aStart.getTime(), end: aStart.getTime() + (aTotalDur * 60000) };
            });

            let potentialStarts = [workStart.getTime()];
            occupied.forEach(o => potentialStarts.push(o.end)); 
            
            for(let time = workStart.getTime(); time < workEnd.getTime(); time += 30 * 60000) {
                potentialStarts.push(time);
            }

            potentialStarts.sort().forEach(startTime => {
                const endTime = startTime + (totalDurationToBlock * 60000); 
                const now = new Date().getTime();

                if (startTime < now) return; 
                if (endTime > workEnd.getTime()) return; 

                const isOverlapping = occupied.some(o => (startTime < o.end && endTime > o.start));

                if (!isOverlapping) {
                    const d = new Date(startTime);
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    slotsSet.add(timeStr);
                }
            });
        });

        return Array.from(slotsSet).sort();
    }, [date, treatmentId, profId, appointments, treatments, professionals, reschedulingId]);

    const handleLogin = (e) => {
        e.preventDefault();
        const cleanPhone = String(phone).replace(/\D/g, '');
        if(cleanPhone.length < 8) return notify("Ingresa un teléfono válido", "error");
        
        if(!actualAlias) return notify("Error: El sistema no detectó a qué local intentas acceder.", "error");

        setIsCheckingLogin(true); 

        window.google.script.run
            .withSuccessHandler(res => {
                setIsCheckingLogin(false); 
                if (res.success && res.exists) {
                    
                    // 🔥 AQUÍ GUARDAMOS LA HORA EXACTA DEL LOGIN 🔥
                    localStorage.setItem('client_login_timestamp', Date.now());
                    
                    setCurrentUser(res.client);
                    setIsLoggedIn(true);
                    notify(`¡Hola de nuevo, ${res.client.name}!`, "success");
                    
                } else if (res.success && !res.exists) {
                    setIsRegistering(true);
                    notify("No encontramos tu perfil. Por favor regístrate.", "info");
                } else {
                    notify("Error al verificar: " + res.message, "error");
                }
            })
            .withFailureHandler(() => {
                setIsCheckingLogin(false);
                notify("Error de conexión con el servidor", "error");
            })
            .checkClientPublic(actualAlias, cleanPhone); 
    };

    const handleRegister = (e) => {
        e.preventDefault();
        if(!actualAlias) return notify("Error: Local no identificado.", "error");
        
        setIsSavingProfile(true); 
        
        const newClient = {
            id: 'CLI-' + Date.now(),
            phone: phone,
            name: clientForm.name,
            email: clientForm.email,
            birthday: clientForm.birthday,
            origin: 'web'
        };
        
        window.google.script.run
            .withSuccessHandler(res => {
                setIsSavingProfile(false); 
                if (res.success) {
                    setCurrentUser(newClient);
                    setIsRegistering(false);
                    setIsLoggedIn(true);
                    notify("¡Perfil creado con éxito!", "success");
                } else {
                    notify("Error al registrar: " + res.message, "error");
                }
            })
            .withFailureHandler(() => {
                setIsSavingProfile(false);
                notify("Error de conexión al registrar", "error");
            })
            .savePublicClient(actualAlias, JSON.stringify(newClient)); 
    };

    const handleInitReschedule = (appt) => {
        const tr = (treatments || []).find(t => t.id === appt.treatmentId);
        setCategory(tr ? tr.category : '');
        setTreatmentId(appt.treatmentId);
        setProfId(appt.professionalId === 'any' ? 'any' : appt.professionalId);
        setReschedulingId(appt.id);
        setDate(''); setTime('');
        document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelReschedule = () => {
        setReschedulingId(null);
        setCategory(''); setTreatmentId(''); setProfId('any'); setDate(''); setTime('');
    };

    // ✅ NUEVO FLUJO: 1. Botón "Solicitar" -> Abre modal (si aplica). 2. Botón del modal -> Llama a confirmBooking
    const handleBookClick = () => {
        if (!treatmentId || !date || !time) return notify("Completa todos los campos", "error");
        if (!actualAlias) return notify("Error: Falta el identificador del local", "error");

        // Si el admin activó las políticas y hay texto, mostramos el modal
        if (agentConfig.showPolicyModal && agentConfig.policyText) {
            setShowTermsModal(true);
        } else {
            // Si no hay políticas, guardamos directo
            confirmBooking();
        }
    };

    // Lógica real de guardado
    const confirmBooking = () => {
        setIsBooking(true); 

        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const isoDate = new Date(year, month - 1, day, hours, minutes).toISOString();

        const newAppt = {
            id: reschedulingId || Date.now().toString(),
            clientId: currentUser?.id,
            treatmentId: treatmentId,
            professionalId: profId || 'any',
            date: isoDate,
            status: 'pending_payment', 
            origin: 'web'
        };

        window.google.script.run
            .withSuccessHandler((res) => {
                setIsBooking(false); 
                if (res.success) {
                    notify("Solicitud enviada, la confirmación te llegará via Whatsapp", "success");
                    cancelReschedule();
                    if(refreshData) refreshData(); 
                } else if (res.message === "overlap") {
                    notify("¡Ups! Alguien acaba de reservar ese horario hace un instante. Por favor elige otro.", "error");
                    if(refreshData) refreshData(); 
                    setTime(''); 
                } else {
                    notify("Error al reservar: " + res.message, "error");
                }
            })
            .withFailureHandler((err) => {
                setIsBooking(false);
                notify("Error de conexión con el servidor", "error");
            })
            .savePublicAppointment(actualAlias, JSON.stringify(newAppt)); 
    };

    const getStatusBadge = (status) => {
        const badges = {
            'reserved': <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">En Revisión</span>,
            'pending_payment': <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">En Revisión</span>,
            'awaiting_deposit': <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold uppercase animate-pulse">Falta Seña</span>,
            'confirmed': <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Confirmado</span>,
            'confirmed_paid': <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Confirmado (Señado)</span>,
            'completed': <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Atendido</span>,
            'cancelled': <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>
        };
        return badges[status] || <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Desconocido</span>;
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-brand-bg p-4">
                
                {/* LA TARJETA BLANCA DE LOGIN/REGISTRO */}
                <div className="bg-white p-8 rounded-brand shadow-2xl w-full max-w-sm border border-brand-border text-center">
                    <div className="flex justify-center mb-6">
                        {brandingConfig.logoBase64 ? <img src={brandingConfig.logoBase64} className="h-40 max-w-[250px] w-auto object-contain drop-shadow-sm" /> : <div className="w-24 h-24 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center font-bold text-4xl shadow-md">S</div>}                    </div>
                    {!isRegistering ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <h2 className="text-2xl font-bold text-brand-text mb-2">Portal de Clientes</h2>
                            <p className="text-brand-text-light text-sm mb-8">Ingresa con tu WhatsApp.</p>
                            <input type="tel" required placeholder="Ej: 1155554444" className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg text-center text-lg outline-none focus:border-[var(--color-primary)] transition-colors" value={phone} onChange={e => setPhone(e.target.value)} />
                            
                            <button type="submit" disabled={isCheckingLogin} className={`w-full text-white font-bold py-3 rounded-brand shadow-lg transition-all ${isCheckingLogin ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--color-primary)] hover:opacity-90'}`}>
                                {isCheckingLogin ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Icon name="loader" size={18} className="animate-spin" /> Verificando...
                                    </span>
                                ) : "Ingresar"}
                            </button>
                            
                            {/* SELLO DE CONFIANZA */}
                            <button type="button" onClick={() => setShowSecurityModal(true)} className="text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1.5 hover:text-[#008395] transition-colors w-full">
                                <Icon name="shield-check" size={14} /> 
                                <span className="underline decoration-dashed underline-offset-2">Protegido por HaceClick.ai</span>
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4 text-left animate-fade-in">
                            <h2 className="text-xl font-bold text-brand-text mb-2 text-center">¡Bienvenido!</h2>
                            
                            <div>
                                <label className="block text-xs font-bold text-brand-text-light uppercase mb-1">Nombre Completo</label>
                                <input type="text" required className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" value={clientForm.name} onChange={e=>setClientForm({...clientForm, name:e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-brand-text-light uppercase mb-1">Email</label>
                                <input type="email" required className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" value={clientForm.email} onChange={e=>setClientForm({...clientForm, email:e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-brand-text-light uppercase mb-1">Fecha de Nacimiento</label>
                                <input type="date" required className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" value={clientForm.birthday} onChange={e=>setClientForm({...clientForm, birthday:e.target.value})} />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={()=>setIsRegistering(false)} className="w-1/3 bg-gray-100 py-3 rounded-brand font-bold text-gray-600 hover:bg-gray-200 transition-colors">Atrás</button>
                                
                                <button type="submit" disabled={isSavingProfile} className={`w-2/3 text-white font-bold py-3 rounded-brand shadow-lg transition-all ${isSavingProfile ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--color-primary)] hover:opacity-90'}`}>
                                    {isSavingProfile ? "Creando..." : "Crear Perfil"}
                                </button>
                            </div>
                            
                            {/* SELLO DE CONFIANZA */}
                            <button type="button" onClick={() => setShowSecurityModal(true)} className="text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1.5 hover:text-[#008395] transition-colors w-full">
                                <Icon name="shield-check" size={14} /> 
                                <span className="underline decoration-dashed underline-offset-2">Tus datos están encriptados y seguros</span>
                            </button>
                        </form>
                    )}
                </div>

                {/* 🚀 ESTRATEGIA DE GROWTH MARKETING: "Powered By" EN EL LOGIN */}
                <div className="mt-8 flex flex-col items-center justify-center transition-opacity duration-300 opacity-60 hover:opacity-100">
                    <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold tracking-[0.2em] text-gray-500 mt-1">POWERED BY |</p>
                        <a 
                            href="https://haceclick-ai.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Obtén este sistema para tu negocio"
                            className="transform hover:scale-105 transition-transform"
                        >
                            <img 
                                src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" 
                                alt="HaceClick.ai" 
                                className="h-6 md:h-7 object-contain grayscale hover:grayscale-0 transition-all duration-300" 
                            />
                        </a>
                    </div>
                </div>

                {/* MODAL DE SEGURIDAD (Para que funcione si hacen clic en el sello antes de loguearse) */}
                {showSecurityModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col animate-scale-in border-t-4 border-[#008395]">
                            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <Icon name="shield-check" className="text-[#008395]"/> Tu Privacidad
                                </h3>
                                <button onClick={() => setShowSecurityModal(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 p-2 rounded-full shadow-sm">
                                    <Icon name="x" size={18}/>
                                </button>
                            </div>
                            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar text-left">
                                <p className="text-sm text-gray-600 mb-2">Nos tomamos muy en serio la seguridad de tu información. Así es como <strong>HaceClick.ai</strong> protege tus datos en este local:</p>
                                <div className="flex gap-3"><div className="mt-1 text-[#008395]"><Icon name="server" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Infraestructura Enterprise</h4><p className="text-xs text-gray-500 mt-1">Este sistema corre sobre servidores nativos de Google Cloud, utilizando los mismos protocolos de encriptación (AES-256) que Gmail y Drive.</p></div></div>
                                <div className="flex gap-3"><div className="mt-1 text-[#008395]"><Icon name="database" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Bases de Datos Aisladas</h4><p className="text-xs text-gray-500 mt-1">A diferencia de otras apps, tus datos no se mezclan con los de otros comercios. Este local tiene una base de datos privada e impenetrable para terceros.</p></div></div>
                                <div className="flex gap-3"><div className="mt-1 text-[#008395]"><Icon name="lock" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Privacidad Absoluta</h4><p className="text-xs text-gray-500 mt-1">Tus datos le pertenecen 100% al local donde estás reservando. HaceClick.ai solo provee la tecnología; nunca leemos, compartimos ni vendemos tu información.</p></div></div>
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                                <button onClick={() => setShowSecurityModal(false)} className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors">Entendido</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-brand-bg p-4 md:p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="bg-white p-6 rounded-brand shadow-sm border border-brand-border flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {brandingConfig.logoBase64 ? <img src={brandingConfig.logoBase64} className="h-14 w-auto object-contain" /> : <div className="w-12 h-12 bg-[var(--color-primary)] text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-sm">S</div>}
                        <div><h2 className="text-xl font-bold text-brand-text">Hola, {currentUser?.name || "Cliente"} 👋</h2></div>
                    </div>
                    <button onClick={() => { setIsLoggedIn(false); setPhone(''); }} className="text-brand-text-light hover:text-red-500" title="Cerrar Sesión"><Icon name="log-out" /></button>
                </div>

                <div className="bg-white p-6 rounded-brand shadow-sm border border-brand-border">
                    <div className="flex justify-between items-center mb-4 border-b border-brand-border pb-3">
                        <h3 className="font-bold text-lg text-brand-text">Mis Turnos</h3>
                        <button 
                            onClick={() => {
                                if (refreshData) {
                                    notify("Actualizando...", "info");
                                    refreshData();
                                }
                            }} 
                            className="text-brand-text-light hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 text-xs font-bold bg-brand-bg px-3 py-1.5 rounded-full border border-brand-border hover:shadow-sm"
                            title="Recargar agenda"
                        >
                            <Icon name="refresh-cw" size={14} /> Actualizar
                        </button>
                    </div>
                    
                    {(myAppointments || []).length === 0 ? (
                        <div className="text-center py-6 text-brand-text-light bg-brand-bg/50 rounded-brand border border-dashed border-brand-border"><p>No tienes turnos.</p></div>
                    ) : (
                        <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                            {myAppointments.map(a => {
                                const t = (treatments || []).find(x => x.id === a.treatmentId);
                                const apptDate = a?.date ? new Date(a.date) : new Date();
                                const canReschedule = a.status === 'confirmed' && ((apptDate - new Date()) / 3600000) > 48;
                                return (
                                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-brand border bg-white border-brand-border">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-brand-text">{t?.name || 'Servicio'}</span>
                                            <span className="text-xs text-brand-text-light">{apptDate.toLocaleString('es-ES', { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })} hs</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                            {getStatusBadge(a.status)}
                                            {canReschedule && <button onClick={() => handleInitReschedule(a)} className="text-xs font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-3 py-1 rounded hover:bg-gray-50 transition-colors">Reprogramar</button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div id="booking-form" className="bg-white p-6 md:p-8 rounded-brand shadow-card border border-brand-border">
                    <h3 className="font-bold text-lg mb-6">{reschedulingId ? 'Reprogramar Turno' : 'Solicitar Nuevo Turno'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-brand-text-light uppercase">1. Categoría </label>
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" value={category} onChange={e => {setCategory(e.target.value); setTreatmentId(''); setTime(''); setProfId('any');}}>
                                <option value="">Todas las categorías...</option>
                                {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            
                            <label className="block text-xs font-bold text-brand-text-light uppercase">2. Servicio</label>
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" value={treatmentId} onChange={e => {
                                setTreatmentId(e.target.value); 
                                setTime(''); 
                                setProfId('any');
                                const selectedT = (treatments || []).find(t => t.id === e.target.value);
                                if (selectedT && !category) setCategory(selectedT.category);
                            }}>
                                <option value="">Elige servicio...</option>
                                {filteredTreatments.map(t => <option key={t.id} value={t.id}>{t.name} (${t.price})</option>)}
                            </select>

                            <label className="block text-xs font-bold text-brand-text-light uppercase">3. Profesional</label>
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" disabled={!treatmentId} value={profId} onChange={e => {setProfId(e.target.value); setTime('');}}>
                                <option value="any">Cualquiera (Sin preferencia)</option>
                                {filteredProfs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-brand-text-light uppercase">4. Día</label>
                            <input type="date" min={new Date().toISOString().split('T')[0]} className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)] transition-colors" disabled={!treatmentId} value={date} onChange={e => setDate(e.target.value)} />
                            
                            <label className="block text-xs font-bold text-brand-text-light uppercase">5. Horario</label>
                            <div className="grid grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-1 custom-scrollbar">
                                {availableSlots.length === 0 && date ? (
                                    <p className="col-span-3 text-xs text-center text-red-400 py-2 bg-red-50 rounded-lg">Sin horarios este día</p>
                                ) : (
                                    availableSlots.map(slot => (
                                        <button key={slot} onClick={() => setTime(slot)} className={`py-2 rounded font-bold text-xs border transition-all ${time === slot ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)] shadow-md scale-105' : 'bg-white text-gray-600 hover:border-[var(--color-primary)]'}`}>{slot}</button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex flex-col items-center justify-center">
                        {/* ✅ EL BOTÓN AHORA LLAMA A handleBookClick EN LUGAR DE handleBook DIRECTAMENTE */}
                        <button 
                            disabled={!time || isBooking} 
                            onClick={handleBookClick} 
                            className={`w-full md:w-auto px-12 py-3 rounded-brand font-bold text-[var(--color-primary-text)] shadow-lg transition-all ${(!time || isBooking) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[var(--color-primary)] hover:opacity-90 hover:scale-105'}`}
                        >
                            {isBooking ? (
                                <span className="flex items-center gap-2">
                                    <Icon name="loader" size={18} className="animate-spin" /> Procesando...
                                </span>
                            ) : (reschedulingId ? 'Confirmar Cambio' : 'Solicitar Turno')}
                        </button>

                        {/* SELLO DE CONFIANZA */}
                        <button type="button" onClick={() => setShowSecurityModal(true)} className="text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1.5 hover:text-[var(--color-primary)] transition-colors w-full">
                            <Icon name="shield-check" size={14} /> 
                            <span className="underline decoration-dashed underline-offset-2">Transacción segura protegida por HaceClick.ai</span>
                        </button>
                    </div>
                </div>

                {/* 🚀 ESTRATEGIA DE GROWTH MARKETING: "Powered By" CON LOGO OFICIAL */}
                <div className="mt-10 mb-6 flex flex-col items-center justify-center transition-opacity duration-300 opacity-60 hover:opacity-100">
                    <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold tracking-[0.2em] text-gray-400 mt-1">POWERED BY |</p>
                        <a 
                            href="https://haceclick-ai.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Obtén este sistema para tu negocio"
                            className="transform hover:scale-105 transition-transform"
                        >
                            <img 
                                src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" 
                                alt="HaceClick.ai" 
                                className="h-6 md:h-7 object-contain grayscale hover:grayscale-0 transition-all duration-300" 
                            />
                        </a>
                    </div>
                </div>

                {/* ✅ NUEVO: MODAL DE TÉRMINOS Y CONDICIONES ANTES DE RESERVAR */}
                {showTermsModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col animate-scale-in border-t-4 border-[var(--color-primary)]">
                            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <Icon name="file-text" className="text-[var(--color-primary)]"/> Políticas del Local
                                </h3>
                                <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 p-2 rounded-full shadow-sm">
                                    <Icon name="x" size={18}/>
                                </button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar text-left">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {agentConfig.policyText}
                                </p>
                            </div>
                            
                            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
                                <button 
                                    onClick={() => setShowTermsModal(false)} 
                                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => { setShowTermsModal(false); confirmBooking(); }} 
                                    className="flex-1 bg-[var(--color-primary)] text-[var(--color-primary-text)] py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/30"
                                >
                                    Acepto y Solicito
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DE SEGURIDAD INTERNO */}
                {showSecurityModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col animate-scale-in border-t-4 border-[var(--color-primary)]">
                            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <Icon name="shield-check" className="text-[var(--color-primary)]"/> Tu Privacidad
                                </h3>
                                <button onClick={() => setShowSecurityModal(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 p-2 rounded-full shadow-sm">
                                    <Icon name="x" size={18}/>
                                </button>
                            </div>
                            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar text-left">
                                <p className="text-sm text-gray-600 mb-2">Nos tomamos muy en serio la seguridad de tu información. Así es como <strong>HaceClick.ai</strong> protege tus datos en este local:</p>
                                <div className="flex gap-3"><div className="mt-1 text-[var(--color-primary)]"><Icon name="server" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Infraestructura Enterprise</h4><p className="text-xs text-gray-500 mt-1">Este sistema corre sobre servidores nativos de Google Cloud, utilizando los mismos protocolos de encriptación (AES-256) que Gmail y Drive.</p></div></div>
                                <div className="flex gap-3"><div className="mt-1 text-[var(--color-primary)]"><Icon name="database" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Bases de Datos Aisladas</h4><p className="text-xs text-gray-500 mt-1">A diferencia de otras apps, tus datos no se mezclan con los de otros comercios. Este local tiene una base de datos privada e impenetrable para terceros.</p></div></div>
                                <div className="flex gap-3"><div className="mt-1 text-[var(--color-primary)]"><Icon name="lock" size={18}/></div><div><h4 className="font-bold text-sm text-gray-800">Privacidad Absoluta</h4><p className="text-xs text-gray-500 mt-1">Tus datos le pertenecen 100% al local donde estás reservando. HaceClick.ai solo provee la tecnología; nunca leemos, compartimos ni vendemos tu información.</p></div></div>
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                                <button onClick={() => setShowSecurityModal(false)} className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors">Entendido, volver a mi reserva</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
