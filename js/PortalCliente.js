
// --- COMPONENTE PORTAL DE CLIENTES (INTELIGENTE Y FLEXIBLE) ---
const ClientPortal = ({ clients = [], appointments = [], treatments = [], categories = [], professionals = [], settings = [], notifications = [], saveAppointments, saveClients, saveNotifications, notify, refreshData }) => {
    // --- ESTADOS DE LOGIN Y ALTA ---
    const [phone, setPhone] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [clientForm, setClientForm] = useState({ name: '', email: '', birthday: '' });
    const [currentUser, setCurrentUser] = useState(null);
    const [isBooking, setIsBooking] = useState(false);
    
    // --- ESTADOS DEL FORMULARIO DE RESERVA ---
    const [category, setCategory] = useState('');
    const [treatmentId, setTreatmentId] = useState('');
    const [profId, setProfId] = useState('any');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [reschedulingId, setReschedulingId] = useState(null);

    // --- LECTURA DE CONFIGURACIÓN ---
    const agentConfig = (settings || []).find(s => s.id === 'agent_config') || {};
    const brandingConfig = (settings || []).find(s => s.id === 'branding') || {};

    // 1. LISTA DE CATEGORÍAS BLINDADA (Con auto-recuperación)
    const categoryList = useMemo(() => {
        let list = [];
        if (categories && categories.length > 0) {
            list = categories.map(c => typeof c === 'object' ? (c.name || c.id) : c).filter(Boolean);
        }
        // Respaldo vital: Si no hay categorías oficiales, las extrae de los servicios que sí existen
        if (list.length === 0 && treatments && treatments.length > 0) {
            list = [...new Set((treatments || []).map(t => t?.category).filter(Boolean))];
        }
        return list;
    }, [categories, treatments]);

    // 2. FILTRO DE SERVICIOS SEGURO (Ignora espacios en blanco y mayúsculas)
    const filteredTreatments = useMemo(() => {
        if (!category) return treatments || []; // Si no hay categoría elegida, muestra TODOS los servicios
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
        
        // 1. Calculamos el tiempo REAL que ocupará el profesional
        const baseDuration = t?.duration ? parseInt(String(t.duration).replace(/\D/g, '')) || 30 : 30;
        const marginDuration = t?.hasMargin ? (parseInt(t?.margin) || 0) : 0;
        const totalDurationToBlock = baseDuration + marginDuration; // Este es el tamaño de la caja que buscamos

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
            
            // 2. Extraer los bloques ocupados SUMÁNDOLES SU PROPIO MARGEN
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
                // Si el turno que ya está agendado tiene margen, la agenda debe proteger ese margen
                const aBaseDur = apptTr?.duration ? parseInt(String(apptTr.duration).replace(/\D/g, '')) || 30 : 30;
                const aMargin = apptTr?.hasMargin ? parseInt(apptTr.margin) || 0 : 0;
                const aTotalDur = aBaseDur + aMargin;
                
                return { start: aStart.getTime(), end: aStart.getTime() + (aTotalDur * 60000) };
            });

            let potentialStarts = [workStart.getTime()];
            occupied.forEach(o => potentialStarts.push(o.end)); // El siguiente turno puede arrancar cuando termina el margen del anterior
            
            for(let time = workStart.getTime(); time < workEnd.getTime(); time += 30 * 60000) {
                potentialStarts.push(time);
            }

            // 3. Validar si el nuevo "bloque total" (Duración + Margen) entra en el hueco
            potentialStarts.sort().forEach(startTime => {
                const endTime = startTime + (totalDurationToBlock * 60000); // Aquí usamos el totalDurationToBlock
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

        const client = (clients || []).find(c => String(c?.phone || "").replace(/\D/g, '') === cleanPhone);
        
        if (client) {
            setCurrentUser(client);
            setIsLoggedIn(true);
            notify(`¡Hola de nuevo, ${client.name}!`, "success");
        } else {
            setIsRegistering(true);
            notify("Parece que eres nuevo. Por favor, completa tus datos.", "info");
        }
    };

    const handleRegister = (e) => {
        e.preventDefault();
        const newClient = {
            id: 'CLI-' + Date.now(),
            phone: phone,
            name: clientForm.name,
            email: clientForm.email,
            birthday: clientForm.birthday,
            origin: 'web'
        };
        
        if(saveClients) saveClients([...(clients || []), newClient]);
        setCurrentUser(newClient);
        
        const newNotif = {
            id: Date.now().toString(),
            type: 'new_client',
            title: '🌟 Nuevo Cliente Web',
            message: `${clientForm.name} se registró en el portal.`,
            clientPhone: phone,
            clientName: clientForm.name
        };
        if(saveNotifications) saveNotifications([...(notifications || []), newNotif]);
        
        setIsRegistering(false);
        setIsLoggedIn(true);
        notify("¡Perfil creado!", "success");
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

    const handleBook = () => {
        if (!treatmentId || !date || !time) return notify("Completa todos los campos", "error");
        
        setIsBooking(true); // Bloqueamos el botón inmediatamente

        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const isoDate = new Date(year, month - 1, day, hours, minutes).toISOString();

        const newAppt = {
            id: reschedulingId || Date.now().toString(),
            clientId: currentUser?.id,
            treatmentId: treatmentId,
            professionalId: profId || 'any',
            date: isoDate,
            status: agentConfig?.requireDeposit ? 'reserved' : 'pending_payment', 
            origin: 'web'
        };

        // Obtenemos el email/tenant desde la URL, o forzamos el mail del manager por defecto
        const urlParams = new URLSearchParams(window.location.search);
        const targetEmail = urlParams.get('tenant') || "monica@gmail.com";

        // LLAMADA AL BACKEND CON ESCUDO ANTI-DUPLICADOS
        google.script.run
            .withSuccessHandler((res) => {
                setIsBooking(false); // Liberamos el botón
                
                if (res.success) {
                    notify("Solicitud enviada, la confirmación te llegará via Whatsapp", "success");
                    cancelReschedule();
                    if(refreshData) refreshData(); // Sincroniza la vista
                } else if (res.message === "overlap") {
                    // EL ESCUDO DETECTÓ QUE EL TURNO SE OCUPÓ HACE MILISEGUNDOS
                    notify("¡Ups! Alguien acaba de reservar ese horario hace un instante. Por favor elige otro.", "error");
                    if(refreshData) refreshData(); // Actualiza para mostrar los huecos reales
                    setTime(''); // Limpia la selección de hora
                } else {
                    notify("Error al reservar: " + res.message, "error");
                }
            })
            .withFailureHandler((err) => {
                setIsBooking(false);
                notify("Error de conexión con el servidor", "error");
            })
            .safeBookAppointment(targetEmail, JSON.stringify(newAppt));
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
            <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg p-4">
                <div className="bg-white p-8 rounded-brand shadow-2xl w-full max-w-sm border border-brand-border text-center">
                    <div className="flex justify-center mb-6">
                        {brandingConfig.logoBase64 ? <img src={brandingConfig.logoBase64} className="h-24 w-auto object-contain" /> : <div className="w-16 h-16 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center font-bold text-2xl">S</div>}
                    </div>
                    {!isRegistering ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <h2 className="text-2xl font-bold text-brand-text mb-2">Portal de Clientes</h2>
                            <p className="text-brand-text-light text-sm mb-8">Ingresa con tu WhatsApp.</p>
                            <input type="tel" required placeholder="Ej: 1155554444" className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg text-center text-lg outline-none" value={phone} onChange={e => setPhone(e.target.value)} />
                            <button type="submit" className="w-full bg-[var(--color-primary)] text-white font-bold py-3 rounded-brand shadow-lg">Ingresar</button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4 text-left">
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
                                <button type="submit" className="w-2/3 bg-[var(--color-primary)] text-white font-bold py-3 rounded-brand shadow-lg hover:opacity-90 transition-opacity">Crear Perfil</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-brand-bg p-4 md:p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="bg-white p-6 rounded-brand shadow-sm border border-brand-border flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {brandingConfig.logoBase64 ? <img src={brandingConfig.logoBase64} className="h-10 w-10 object-contain" /> : <div className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-xl flex items-center justify-center font-bold">S</div>}
                        <div><h2 className="text-xl font-bold text-brand-text">Hola, {currentUser?.name || "Cliente"} 👋</h2></div>
                    </div>
                    <button onClick={() => { setIsLoggedIn(false); setPhone(''); }} className="text-brand-text-light hover:text-red-500" title="Cerrar Sesión"><Icon name="log-out" /></button>
                </div>

                <div className="bg-white p-6 rounded-brand shadow-sm border border-brand-border">
                    {/* --- AQUÍ AGREGAMOS EL BOTÓN DE ACTUALIZAR --- */}
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
                        /* AQUI ESTA LA MAGIA DEL SCROLL: max-h-[250px] overflow-y-auto custom-scrollbar pr-2 */
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
                                            {canReschedule && <button onClick={() => handleInitReschedule(a)} className="text-xs font-bold text-[var(--color-primary)] border border-[var(--color-primary)] px-3 py-1 rounded">Reprogramar</button>}
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
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)]" value={category} onChange={e => {setCategory(e.target.value); setTreatmentId(''); setTime(''); setProfId('any');}}>
                                <option value="">Todas las categorías...</option>
                                {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            
                            <label className="block text-xs font-bold text-brand-text-light uppercase">2. Servicio</label>
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)]" value={treatmentId} onChange={e => {
                                setTreatmentId(e.target.value); 
                                setTime(''); 
                                setProfId('any');
                                // Auto-selecciona la categoría si no estaba seleccionada
                                const selectedT = (treatments || []).find(t => t.id === e.target.value);
                                if (selectedT && !category) setCategory(selectedT.category);
                            }}>
                                <option value="">Elige servicio...</option>
                                {filteredTreatments.map(t => <option key={t.id} value={t.id}>{t.name} (${t.price})</option>)}
                            </select>

                            <label className="block text-xs font-bold text-brand-text-light uppercase">3. Profesional</label>
                            <select className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)]" disabled={!treatmentId} value={profId} onChange={e => {setProfId(e.target.value); setTime('');}}>
                                <option value="any">Cualquiera (Sin preferencia)</option>
                                {filteredProfs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-brand-text-light uppercase">4. Día</label>
                            <input type="date" min={new Date().toISOString().split('T')[0]} className="w-full border border-brand-border p-3 rounded-brand bg-brand-bg outline-none focus:border-[var(--color-primary)]" disabled={!treatmentId} value={date} onChange={e => setDate(e.target.value)} />
                            
                            <label className="block text-xs font-bold text-brand-text-light uppercase">5. Horario</label>
                            <div className="grid grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-1 custom-scrollbar">
                                {availableSlots.length === 0 && date ? (
                                    <p className="col-span-3 text-xs text-center text-red-400 py-2">Sin horarios este día</p>
                                ) : (
                                    availableSlots.map(slot => (
                                        <button key={slot} onClick={() => setTime(slot)} className={`py-2 rounded font-bold text-xs border transition-colors ${time === slot ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md' : 'bg-white text-gray-600 hover:border-[var(--color-primary)]'}`}>{slot}</button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                        <button 
                            disabled={!time || isBooking} 
                            onClick={handleBook} 
                            className={`px-8 py-3 rounded-brand font-bold text-white shadow-lg transition-all ${(!time || isBooking) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[var(--color-primary)] hover:scale-105'}`}
                        >
                            {isBooking ? (
                                <span className="flex items-center gap-2">
                                    <Icon name="loader" size={18} className="animate-spin" /> Procesando...
                                </span>
                            ) : (reschedulingId ? 'Confirmar Cambio' : 'Solicitar Turno')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
