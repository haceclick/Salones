
// --- COMPONENTE DASHBOARD (INTEGRADO CON MENSAJES PERSONALIZADOS Y NOTIFICACIONES DESCARTABLES) ---
const Dashboard = ({ clients, appointments, professionals, treatments, settings, notifications = [], adminMessages = [], saveAppointments, saveNotifications, notify, goToAgenda, refreshData }) => {
    const today = new Date();
    
    // ESTADO PARA EL BOTÓN DE ACTUALIZAR
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ESTADOS PARA MODALES
    const [selectedPendingAppt, setSelectedPendingAppt] = useState(null);
    const [approvalProfId, setApprovalProfId] = useState(''); 
    
    // ESTADOS PARA CENTRAL DE AVISOS Y CRM
    const [reminderModal, setReminderModal] = useState(false);
    const [remDate, setRemDate] = useState(today.toISOString().split('T')[0]);
    const [remTreatment, setRemTreatment] = useState('ALL');
    const [customPrepText, setCustomPrepText] = useState('');
    const [historyClient, setHistoryClient] = useState(null); 
    const [readNotifs, setReadNotifs] = useState([]); // <-- NUEVO ESTADO PARA MENSAJES DE ADMIN
    
    // --- NUEVO: FUNCIÓN PARA BORRAR AVISOS DEFINITIVAMENTE DE LA BASE DE DATOS ---
    const handleDismissNotif = (notifId) => {
        // 1. Lo ocultamos visualmente al instante para que no moleste
        setHiddenNotifs(prev => [...prev, String(notifId)]);
        
        // 2. Filtramos la lista para quitarlo
        const updatedNotifs = notifications.filter(notif => String(notif.id) !== String(notifId));
        
        // 3. Actualizamos la memoria principal de la App
        if(saveNotifications) saveNotifications(updatedNotifs);
        
        // 4. 🔥 MAGIA: Forzamos a que vaya al Excel a borrarlo para que no vuelva a aparecer al recargar
        const targetEmail = settings?.find(s => s.id === 'branding')?.adminEmail;
        if (targetEmail) {
            google.script.run.saveData(targetEmail, 'notifications', JSON.stringify(updatedNotifs));
        }
    };    

    // --- NUEVO: ESTADO PARA EL LANZADOR DE WHATSAPP ---
    const [waModal, setWaModal] = useState({ open: false, phone: '', text: '', loading: false });
    const todaysApps = appointments.filter(a => { 
        const d = new Date(a.date); 
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && a.status !== 'cancelled' && a.status !== 'blocked' && a.status !== 'holiday'; 
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    const groupedTodaysApps = todaysApps.reduce((acc, appt) => {
        const prof = professionals.find(p => p.id === appt.professionalId);
        const profName = prof ? prof.name : 'Sin Asignar';
        if (!acc[profName]) acc[profName] = [];
        acc[profName].push(appt);
        return acc;
    }, {});

    const pendingApps = appointments.filter(a => {
        return (a.status === 'reserved' || a.status === 'pending_payment' || a.status === 'awaiting_deposit') && new Date(a.date) >= new Date(today.setHours(0,0,0,0));
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    // --- NUEVO: DETECTOR DE SERVICIOS SIN CERRAR (PASADOS) ---
    const unclosedAppts = useMemo(() => {
        const now = new Date();
        const bufferTime = new Date(now.getTime() - (2 * 60 * 60 * 1000)); 
        
        return appointments.filter(a => {
            // Ignoramos completamente los que ya están en estados finales o son bloqueos
            if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'holiday' || a.status === 'blocked') {
                return false;
            }
            
            // Si llegó hasta acá (está confirmado o esperando seña) verificamos si ya es viejo
            const apptDate = new Date(a.date);
            return apptDate < bufferTime;
        }).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [appointments]);
    // ---------------------------------------------------------

    const nextAppt = todaysApps.find(a => new Date(a.date) > new Date());

    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const birthdayClients = clients.filter(c => {
        if (!c.birthday) return false;
        const parts = c.birthday.split('-');
        if (parts.length !== 3) return false;
        return parseInt(parts[1], 10) === currentMonth && parseInt(parts[2], 10) === currentDay;
    });

    // LECTURA DE CONFIGURACIONES GLOBALES
    const agentConfig = settings && Array.isArray(settings) ? settings.find(s => s.id === 'agent_config') : null;
    const msgConfig = settings && Array.isArray(settings) ? settings.find(s => s.id === 'messages_config') || {} : {};
    const businessName = agentConfig?.businessName || 'nuestro equipo';

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        if (refreshData) refreshData();
        setTimeout(() => setIsRefreshing(false), 1500);
    };

    const getClientLink = () => {
        // 1. Si el dueño configuró un link específico en Settings, usamos ese
        if (agentConfig?.schedulerUrl) return agentConfig.schedulerUrl;
        
        // 2. Si no, armamos el link limpio con tu dominio oficial
        const baseDomain = "https://salones.haceclick-ai.com/";
        const alias = agentConfig?.tenantAlias;
        
        if (alias) {
            return `${baseDomain}?local=${alias}`;
        }
        return baseDomain;
    };

    const openWhatsAppApp = (phone, text) => {
        const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_top';
        document.body.appendChild(a);
        a.click(); 
        document.body.removeChild(a); 
    };

    const generateGCalLink = (appt, treatment) => {
        const startDate = new Date(appt.date);
        const durationMin = treatment?.duration ? parseInt(String(treatment.duration).replace(/\D/g, '')) || 30 : 30;
        const endDate = new Date(startDate.getTime() + durationMin * 60000);

        const formatForGCal = (date) => {
            const pad = (n) => n < 10 ? '0' + n : n;
            return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
        };

        const start = formatForGCal(startDate);
        const end = formatForGCal(endDate);
        const title = encodeURIComponent(`Turno: ${treatment ? treatment.name : 'Servicio'}`);
        const details = encodeURIComponent(`Turno agendado en ${businessName}.`);
        const location = encodeURIComponent(agentConfig?.mapsUrl || businessName);

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    };

    const handleConfirm = (apptId, forcedProfId = null) => {
        const appt = appointments.find(a => a.id === apptId);
        const finalProfId = forcedProfId || appt.professionalId;
        const client = clients.find(c => c.id === appt.clientId);
        const tr = treatments ? treatments.find(t => t.id === appt.treatmentId) : null;
        
        const requiresDeposit = agentConfig?.requireDeposit;
        const newStatus = requiresDeposit ? 'awaiting_deposit' : 'confirmed';
        
        // 1. Actualizamos el estado primero
        const updated = appointments.map(a => a.id === apptId ? { ...a, status: newStatus, professionalId: finalProfId } : a);
        saveAppointments(updated);
        
        // 2. Cerramos el modal de detalles
        setSelectedPendingAppt(null); 
        
        // 3. Avisamos y abrimos WhatsApp (pasándole el parámetro de seña)
        notify(requiresDeposit ? "Aprobado. Esperando pago de seña..." : "Confirmado y asignado.", "success");
        sendWhatsAppMsg({...appt, professionalId: finalProfId}, client, tr, requiresDeposit);
    };

    // --- NUEVA FUNCIÓN: EL CLIENTE YA PAGÓ LA SEÑA (ENVÍA LINKS) ---
    const handleConfirmDeposit = (e, appt) => {
        e.stopPropagation();
        const updated = appointments.map(a => a.id === appt.id ? { ...a, status: 'confirmed_paid' } : a);
        saveAppointments(updated);
        notify("Seña registrada. Turno confirmado al 100%.", "success");
        
        const client = clients.find(c => c.id === appt.clientId);
        const tr = treatments ? treatments.find(t => t.id === appt.treatmentId) : null;

        if (client && client.phone) {
            const phone = String(client.phone).replace(/\D/g, ''); 
            const mapsUrl = agentConfig?.mapsUrl || ''; 
            const mapsText = mapsUrl ? `\n📍 Ubicación: \n${mapsUrl}` : '';
            const gcalLink = generateGCalLink(appt, tr);

            setWaModal({ open: true, loading: true, phone: phone, text: '' });

            google.script.run
                .withSuccessHandler((shortLink) => {
                    const calendarText = `\n\n📅 *Agendalo en tu Calendario haciendo clic acá:*\n${shortLink}`;
                    const text = `¡Hola *${client.name}*! 👋\n\n¡Seña recibida correctamente! ✅ Tu turno ya quedó 100% confirmado.\n¡Nos vemos pronto!\n${mapsText}${calendarText}`;
                    setWaModal({ open: true, loading: false, phone: phone, text: text });
                })
                .withFailureHandler(() => {
                    const calendarText = `\n\n📅 *Agendalo en tu Calendario haciendo clic acá:*\n${gcalLink}`;
                    const text = `¡Hola *${client.name}*! 👋\n\n¡Seña recibida correctamente! ✅ Tu turno ya quedó 100% confirmado.\n¡Nos vemos pronto!\n${mapsText}${calendarText}`;
                    setWaModal({ open: true, loading: false, phone: phone, text: text });
                })
                .getShortUrl(gcalLink);
        }
    };

    const handleQuickConfirm = (e, appt) => {
        e.stopPropagation();
        if (appt.professionalId === 'any' || appt.professionalId === 'ALL' || !appt.professionalId) {
            notify("⚠️ Debes asignar un profesional antes de confirmar.", "warning");
            openPendingModal(appt);
            return;
        }
        handleConfirm(appt.id);
    };

    const openPendingModal = (appt) => {
        setSelectedPendingAppt(appt);
        setApprovalProfId((appt.professionalId === 'any' || appt.professionalId === 'ALL') ? '' : appt.professionalId);
    };

    // --- RECHAZO CONECTADO A SETTINGS ---
    const handleReject = (apptId) => {
        const appt = appointments.find(a => a.id === apptId);
        const client = clients.find(c => c.id === appt?.clientId);
        
        saveAppointments(appointments.filter(a => a.id !== apptId));
        notify("Solicitud rechazada. Abriendo WhatsApp para reprogramar...", "info");
        setSelectedPendingAppt(null);

        if (client && client.phone) {
            const phone = String(client.phone).replace(/\D/g, ''); 
            // Leemos el mensaje personalizado de rechazo o usamos el por defecto
            const rejectMsg = msgConfig.reject || 'Te pedimos mil disculpas, pero tuvimos que rechazar tu solicitud porque el espacio se ocupó o el profesional no está disponible.\n\n¿Te gustaría que te ofrezcamos otro horario? Quedamos a tu disposición. 🙏';
            
            const text = `¡Hola *${client.name}*! 👋\nTe escribimos de *${businessName}*.\n\n${rejectMsg}`;
            
            openWhatsAppApp(phone, text);
        }
    }; 

    // --- MENSAJE CONECTADO A SETTINGS (SEÑA INTELIGENTE: LINK O TRANSFERENCIA) ---
    const sendWhatsAppMsg = (appt, client, treatment, isAwaitingDeposit = false) => {
        if (!client || !client.phone) return;
        const phone = String(client.phone).replace(/\D/g, ''); 
        const d = new Date(appt.date);
        const dateStr = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const serviceName = treatment ? treatment.name : 'tu servicio';

        // LÓGICA A: SOLO PIDE SEÑA (Sin Mapas ni Calendario)
        if (isAwaitingDeposit) {
            let depositText = '';
            
            // VERIFICAMOS QUÉ TIPO DE SEÑA ESTÁ ACTIVA EN SETTINGS
            if (!agentConfig.depositType || agentConfig.depositType === 'link') {
                depositText = `\n\n⚠️ *Para asegurar tu lugar, te pedimos que abones una seña de $${agentConfig?.depositAmount}.*\n💳 *Link de pago:* ${agentConfig?.paymentUrl}\n_(Una vez que pagues, envianos el comprobante por acá para registrarlo)_`;
            } else {
                depositText = `\n\n⚠️ *Para asegurar tu lugar, te pedimos que abones una seña de $${agentConfig?.depositAmount}.*\n\n🏦 *Datos para transferencia:*\nAlias/CBU: *${agentConfig?.transferAlias}*\nTitular: *${agentConfig?.transferName || '-'}*\nCUIT: *${agentConfig?.transferCuit || '-'}*\n\n_(Una vez que transfieras, envianos el comprobante por acá para registrarlo)_`;
            }

            const text = `¡Hola *${client.name}*! 👋\nRecibimos tu solicitud de turno para: *${serviceName}* el *${dateStr}* a las *${timeStr} hs*.${depositText}`;
            
            setWaModal({ open: true, loading: false, phone: phone, text: text });
            return; 
        }
        
        // LÓGICA B: CONFIRMACIÓN DIRECTA (Sin seña, incluye Mapas y Calendario)
        const confirmMsg = msgConfig.confirm || '¡Te esperamos!';
        const mapsUrl = agentConfig?.mapsUrl || ''; 
        const mapsText = mapsUrl ? `\n📍 Ubicación: ${mapsUrl}` : '';
        const gcalLink = generateGCalLink(appt, treatment);
        
        setWaModal({ open: true, loading: true, phone: phone, text: '' });

        google.script.run
            .withSuccessHandler((shortLink) => {
                const calendarText = `\n\n📅 *Agendá el turno en tu Calendario haciendo clic acá:*\n${shortLink}`;
                const text = `¡Hola *${client.name}*! 👋\nTe confirmamos tu turno para: *${serviceName}* el *${dateStr}* a las *${timeStr} hs*.\n\n${confirmMsg}${mapsText}${calendarText}`;
                setWaModal({ open: true, loading: false, phone: phone, text: text });
            })
            .withFailureHandler(() => {
                const calendarText = `\n\n📅 *Agendá el turno en tu Calendario haciendo clic acá:*\n${gcalLink}`;
                const text = `¡Hola *${client.name}*! 👋\nTe confirmamos tu turno para: *${serviceName}* el *${dateStr}* a las *${timeStr} hs*.\n\n${confirmMsg}${mapsText}${calendarText}`;
                setWaModal({ open: true, loading: false, phone: phone, text: text });
            })
            .getShortUrl(gcalLink);
    };

    const sendReminderWA = (appt, client, tr) => {
        if(!client?.phone) return;
        const phone = String(client.phone).replace(/\D/g, '');
        const timeStr = new Date(appt.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const dateStr = new Date(appt.date).toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'});
        
        let text = `¡Hola *${client.name}*! 👋\nTe escribimos desde *${businessName}* para recordarte tu turno de ${tr?.name || 'servicio'} para el día *${dateStr} a las ${timeStr} hs*.\n`;
        
        if (remTreatment !== 'ALL') {
            if (customPrepText.trim() !== '') {
                text += `\n⚠️ *Aviso importante para tu sesión:* ${customPrepText.trim()}\n`;
            } else {
                text += `\n⚠️ *Aviso importante:* Recordá seguir las indicaciones previas si tu tratamiento lo requiere para poder realizar la sesión sin problemas.\n`;
            }
        }
        
        text += `\nPor favor, confirmá tu asistencia respondiendo este mensaje. ¡Te esperamos!`;
        
        openWhatsAppApp(phone, text);

        const updatedAppts = appointments.map(a => a.id === appt.id ? {...a, reminderSent: true} : a);
        saveAppointments(updatedAppts);
        notify("Recordatorio marcado como enviado", "success");
    };

    const sendBirthdayGreeting = (client) => {
        if (!client || !client.phone) return;
        const phone = String(client.phone).replace(/\D/g, '');
        const promoText = msgConfig.birthday || 'Para festejar con vos te damos un regalo especial.';

        const text = `¡Hola *${client.name}*! 🎂🎈\n\nEn este día especial, todo el equipo de *${businessName}* te desea un ¡MUY FELIZ CUMPLEAÑOS! 🥳✨\n\n${promoText}\n\nQue pases un día hermoso.`;
        
        openWhatsAppApp(phone, text);
        notify("Abriendo WhatsApp para saludar...", "success");
    };

    // --- ESTADO PARA OCULTAR AVISOS AL INSTANTE ---
    const [hiddenNotifs, setHiddenNotifs] = useState([]);

    // 1. AVISOS DEL SISTEMA (Solo Súper Admin)
    const allNotifs = useMemo(() => {
        const formattedAdminMessages = (adminMessages || []).map(msg => {
            const cleanTitle = typeof msg.title === 'object' ? (msg.title.title || "Aviso") : (msg.title || "Aviso");
            const cleanMsg = typeof msg.message === 'object' ? (msg.message.message || "") : (msg.message || "");
            
            return {
                ...msg,
                title: cleanTitle,
                message: cleanMsg,
                type: 'admin_manual',
                id: msg.id || Date.now() + Math.random()
            };
        });
        // Ya no mezclamos las notificaciones locales, solo dejamos las del Admin
        return formattedAdminMessages.filter(n => !hiddenNotifs.includes(String(n.id)));
    }, [adminMessages, hiddenNotifs]);

    // 2. NUEVOS CLIENTES (Van a ir a Solicitudes Web)
    const newClientNotifs = useMemo(() => {
        return (notifications || []).filter(n => n.type === 'new_client' && !hiddenNotifs.includes(String(n.id)));
    }, [notifications, hiddenNotifs]);
    
    // Calculamos el total para la alerta de Solicitudes Web
    const totalPendingRequests = pendingApps.length + newClientNotifs.length;

    const reminderAppts = useMemo(() => {
        if(!remDate) return [];
        return appointments.filter(a => {
            if(a.status === 'cancelled' || a.status === 'holiday' || a.status === 'blocked') return false;
            if(!a?.date?.startsWith(remDate)) return false;
            if(remTreatment !== 'ALL' && a.treatmentId !== remTreatment) return false;
            return true;
        }).sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [appointments, remDate, remTreatment]);


    const DashCard = ({ icon, color, label, value }) => (
        <div className="bg-brand-card p-6 rounded-brand shadow-card border border-brand-border flex items-center gap-5 hover:shadow-soft transition-shadow">
            <div className={`p-4 rounded-brand ${color}`}>{icon}</div>
            <div>
                <p className="text-brand-text-light text-sm font-medium mb-1">{label}</p>
                <p className="text-3xl font-bold text-brand-text">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 pb-12 space-y-8 bg-brand-bg relative">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* ... Tus botones del header se quedan exactamente igual aquí ... */}
                <div>
                    <h2 className="text-3xl font-bold text-brand-text">Panel General</h2>
                    <p className="text-brand-text-light mt-1">Bienvenido a tu centro de control.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="bg-white border border-brand-border text-brand-text-light px-4 py-2.5 rounded-brand font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                        title="Forzar actualización de datos"
                    >
                        <Icon name="refresh-cw" size={18} className={isRefreshing ? "animate-spin text-primary" : ""}/> 
                        <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>

                    <button 
                        onClick={() => window.open(getClientLink(), '_blank')} 
                        className="bg-white border border-brand-border text-brand-text-light px-4 py-2.5 rounded-brand font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Icon name="external-link" size={18}/> Portal Clientes
                    </button>
                    <button onClick={() => setReminderModal(true)} className="bg-primary text-brand-text px-5 py-2.5 rounded-brand font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-md">
                        <Icon name="message-square" size={18}/> Enviar Avisos
                    </button>
                </div>
            </header>

            {/* --- NUEVO: BANNER DE ALERTA DE SERVICIOS SIN CERRAR --- */}
            {unclosedAppts.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 md:p-6 rounded-brand shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0 mt-1 md:mt-0">
                            <Icon name="alert-triangle" size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-red-800 text-lg leading-tight">¡Tienes {unclosedAppts.length} {unclosedAppts.length === 1 ? 'servicio sin cerrar' : 'servicios sin cerrar'}!</h4>
                            <p className="text-sm text-red-600 mt-1">Quedaron turnos pasados como "Confirmados". Ciérralos para mantener tu caja al día:</p>
                            
                            {/* AQUÍ MOSTRAMOS A LOS CULPABLES */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {unclosedAppts.slice(0, 4).map(a => {
                                    const client = clients.find(c => c.id === a.clientId);
                                    const cName = client ? client.name : (a.clientId?.startsWith('CHAT') ? a.clientNameTemp : 'Desconocido');
                                    const d = new Date(a.date);
                                    return (
                                        <span key={a.id} className="bg-white text-red-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-red-200 flex items-center gap-1">
                                            <Icon name="user" size={10}/> {cName} ({d.getDate()}/{d.getMonth() + 1})
                                        </span>
                                    );
                                })}
                                {unclosedAppts.length > 4 && <span className="text-xs text-red-500 font-bold ml-1">+ {unclosedAppts.length - 4} más...</span>}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => goToAgenda()} 
                        className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors shadow-md flex items-center justify-center gap-2 shrink-0 whitespace-nowrap w-full md:w-auto mt-2 md:mt-0"
                    >
                        <Icon name="calendar" size={18}/> Ir a la Agenda
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                <DashCard icon={<Icon name="calendar" size={20} className="text-brand-text" />} color="bg-primary/30" label="Turnos Hoy" value={todaysApps.length} />
                <DashCard icon={<Icon name="bell" size={20} className="text-brand-text" />} color="bg-yellow-100" label="Reservas Web" value={pendingApps.length} />
                <DashCard icon={<Icon name="users" size={20} className="text-brand-text" />} color="bg-secondary" label="Clientes" value={clients.length} />
                <DashCard icon={<Icon name="clock" size={20} className="text-brand-text" />} color="bg-brand-border" label="Próximo" value={nextAppt ? new Date(nextAppt.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* SOLICITUDES WEB Y NUEVOS CLIENTES */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-brand-text flex items-center gap-2"><Icon name="globe" className="text-yellow-600"/> Solicitudes Web</h3>
                            {totalPendingRequests > 0 && <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse uppercase">{totalPendingRequests} Pendientes</span>}
                        </div>
                        {totalPendingRequests === 0 ? 
                            (<div key="empty-pending" className="text-center py-8 text-brand-text-light flex flex-col items-center">
                                <Icon name="check-circle" size={40} className="mb-2 opacity-30"/>
                                <p>Sin solicitudes pendientes.</p>
                            </div>) : 
                            (<div key="list-pending" className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                
                                {/* A. RENDERIZAMOS LOS CLIENTES NUEVOS PRIMERO */}
                                {newClientNotifs.map(n => (
                                    <div key={n.id} className="p-4 rounded-brand border bg-green-50 border-green-200 hover:shadow-md transition-all hover:-translate-y-0.5 group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="font-bold text-lg text-gray-800">{n.clientName}</p>
                                                <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1"><Icon name="phone" size={12}/> {n.clientPhone}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded text-green-800 bg-green-200 animate-pulse">
                                                    Nuevo Registro
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-3 border-t border-green-200">
                                            <button onClick={() => {
                                                const welcomeText = msgConfig.welcome || '¡Qué alegría sumarte a nuestro local! En breve revisaremos la solicitud de tu turno.';
                                                const text = `¡Hola *${n.clientName}*! 👋\n\n${welcomeText}`;
                                                openWhatsAppApp(n.clientPhone.replace(/\D/g, ''), text);
                                                handleDismissNotif(n.id);
                                            }} className="flex-1 bg-green-500 text-white py-2 rounded-brand text-xs font-bold hover:bg-green-600 flex justify-center items-center gap-1 shadow-sm transition-colors">
                                                <Icon name="message-circle" size={14}/> <span>Saludar</span>
                                            </button>
                                            <button onClick={() => {
                                                handleDismissNotif(n.id);
                                                notify("Cliente marcado como saludado", "success");
                                            }} className="flex-1 bg-white border border-green-300 text-green-700 py-2 rounded-brand text-xs font-bold hover:bg-green-50 transition-colors">
                                                <Icon name="check" size={14}/> <span>Ya Saludado</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* B. RENDERIZAMOS LOS TURNOS PENDIENTES DESPUÉS */}
                                {pendingApps.map(a => { 
                                    const clientName = a.clientId?.startsWith('CHAT') ? a.clientNameTemp : clients.find(c=>c.id===a.clientId)?.name;
                                    const tr = treatments.find(t => t.id === a.treatmentId);
                                    const needsProf = a.professionalId === 'any' || a.professionalId === 'ALL' || !a.professionalId;
                                    const isAwaiting = a.status === 'awaiting_deposit';

                                    return (
                                        <div key={a.id} 
                                             onClick={() => !isAwaiting ? openPendingModal(a) : null} 
                                             className={`p-4 rounded-brand border cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group ${isAwaiting ? 'bg-orange-50 border-orange-200 cursor-default' : 'bg-yellow-50 border-yellow-200'}`}>
                                            
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className={`font-bold text-lg transition-colors ${isAwaiting ? 'text-orange-800' : 'text-gray-800 group-hover:text-primary'}`}>{clientName}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{new Date(a.date).toLocaleDateString('es-ES', {weekday:'short', day:'numeric'})} - {new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</p>
                                                    {tr && <p className="text-[10px] text-gray-400 mt-0.5">{tr.name}</p>}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${isAwaiting ? 'text-orange-800 bg-orange-200 animate-pulse' : 'text-yellow-800 bg-yellow-200'}`}>
                                                        {isAwaiting ? 'Esperando Seña' : 'Reserva Turno'}
                                                    </span>
                                                    {!isAwaiting && needsProf && <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 rounded animate-pulse">Falta Asignar</span>}
                                                </div>
                                            </div>
                                            
                                            <div className={`flex gap-2 pt-3 border-t ${isAwaiting ? 'border-orange-200' : 'border-yellow-200'}`}>
                                                {isAwaiting ? (
                                                    <>
                                                        <button onClick={(e) => handleConfirmDeposit(e, a)} className="flex-1 bg-green-500 text-white py-2 rounded-brand text-xs font-bold hover:bg-green-600 flex justify-center items-center gap-1 shadow-sm transition-colors">
                                                            <Icon name="check-circle" size={14}/> <span>Seña Recibida</span>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleReject(a.id); }} className="flex-1 bg-white border border-orange-300 text-orange-600 py-2 rounded-brand text-xs font-bold hover:text-red-600 hover:bg-orange-100 transition-colors">
                                                            <span>Cancelar Turno</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={(e) => handleQuickConfirm(e, a)} className={`flex-1 text-white py-2 rounded-brand text-xs font-bold flex justify-center items-center gap-1 transition-colors ${needsProf ? 'bg-green-400' : 'bg-green-500 hover:bg-green-600 shadow-sm'}`}>
                                                            <Icon name={needsProf ? 'user-plus' : 'message-circle'} size={14}/> <span>{needsProf ? 'Asignar Prof.' : 'Confirmar'}</span>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleReject(a.id); }} className="flex-1 bg-white border border-gray-300 text-gray-500 py-2 rounded-brand text-xs font-bold hover:text-red-500 hover:bg-gray-50 transition-colors">
                                                            <span>Eliminar</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) 
                                })}
                            </div>)
                        }
                    </div>

                    {/* TURNOS HOY */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-brand-text flex items-center gap-2"><Icon name="calendar"/> Agenda de Hoy</h3>
                        </div>
                        {todaysApps.length === 0 ? 
                            (<div key="empty-today" className="text-center py-12 text-brand-text-light flex flex-col items-center">
                                <Icon name="coffee" size={48} className="mb-2 opacity-30"/>
                                <p>No hay turnos para hoy.</p>
                            </div>) : 
                            (<div key="list-today" className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {Object.keys(groupedTodaysApps).map(profName => (
                                    <div key={profName}>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                                            <Icon name="user" size={14}/> {profName}
                                        </h4>
                                        <div className="space-y-3">
                                            {groupedTodaysApps[profName].map(a => { 
                                                const clientName = a.clientId?.startsWith('CHAT') ? a.clientNameTemp : clients.find(c=>c.id===a.clientId)?.name;
                                                const tr = treatments.find(t => t.id === a.treatmentId);
                                                const isCompleted = a.status === 'completed';
                                                return (
                                                    <div key={a.id} onClick={() => goToAgenda(a.id)} className={`flex items-center p-3 rounded-brand border-l-4 transition-all hover:shadow-soft cursor-pointer hover:scale-[1.01] ${isCompleted ? 'bg-blue-50 border-blue-500 opacity-80' : 'bg-green-50 border-green-500'}`}>
                                                        <span className={`font-bold text-lg w-16 text-center shrink-0 ${isCompleted ? 'text-blue-700' : 'text-green-700'}`}>{new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                                                        <div className="flex-1 border-l border-brand-border pl-4 ml-2 overflow-hidden">
                                                            <p className="font-bold text-gray-800 truncate">{clientName || 'Bloqueo'}</p>
                                                            {tr && <p className="text-[10px] text-gray-500 truncate">{tr.name}</p>}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${isCompleted ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'}`}>{isCompleted ? 'FINALIZADO' : 'CONFIRMADO'}</span>
                                                        </div>
                                                    </div>
                                                ) 
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>)
                        }
                    </div>
                </div>
                
                <div className="space-y-8">
                    {/* AVISOS DEL SISTEMA */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-brand-text flex items-center gap-2"><Icon name="bell"/> Avisos del Sistema</h3>
                        </div>
                        {allNotifs.length === 0 ? 
                            (<div key="empty-notif" className="p-6 bg-brand-bg rounded-brand border border-brand-border text-center text-sm text-brand-text-light italic">No hay mensajes del administrador.</div>) : 
                            (<div key="list-notif" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {allNotifs.map((n) => {
                                    const isRead = readNotifs.includes(String(n.id));
                                    
                                    return (
                                        <div key={n.id} className={`p-4 rounded-brand border-l-4 relative transition-all ${isRead ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-blue-50 border-blue-400'}`}>
                                            
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <p className={`font-bold text-sm flex items-center gap-1 ${isRead ? 'text-gray-500' : 'text-brand-text'}`}>
                                                        <Icon name="info" size={14} className={isRead ? "text-gray-400" : "text-blue-500"}/> 
                                                        {String(n.title || "")}
                                                    </p>
                                                    
                                                    {/* Usamos el formateador de negritas que creamos recién */}
                                                    <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap ${isRead ? 'text-gray-400' : 'text-brand-text-light'}`}>
                                                        {n.message.split(/(\*.*?\*)/g).map((part, i) => 
                                                            part.startsWith('*') && part.endsWith('*') 
                                                                ? <strong key={i} className="font-bold text-gray-900">{part.slice(1, -1)}</strong> 
                                                                : part
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Botón de LEÍDO */}
                                                {!isRead && (
                                                    <button 
                                                        onClick={() => setReadNotifs(prev => [...prev, String(n.id)])}
                                                        className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-50 transition-colors shadow-sm shrink-0 flex items-center gap-1"
                                                    >
                                                        <Icon name="check" size={12}/> Marcar Leído
                                                    </button>
                                                )}
                                                {isRead && (
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 shrink-0 bg-gray-100 px-2 py-1 rounded">
                                                        <Icon name="check-check" size={12}/> Leído
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>)
                        }
                    </div>
                    {/* CUMPLEAÑOS DE HOY */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-brand-text flex items-center gap-2"><Icon name="gift" className="text-pink-500"/> Cumpleaños de Hoy</h3>
                            {birthdayClients.length > 0 && <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase animate-bounce">¡Hay festejos!</span>}
                        </div>
                        {birthdayClients.length === 0 ? 
                            (<div key="empty-birthdays" className="p-6 bg-brand-bg rounded-brand border border-brand-border text-center text-sm text-brand-text-light italic">No hay cumpleaños registrados para hoy.</div>) : 
                            (<div key="list-birthdays" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {birthdayClients.map((c) => (
                                    <div key={c.id} className="p-4 rounded-brand border-l-4 bg-pink-50 border-pink-400 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-soft transition-all">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                                            <p className="text-gray-500 text-xs mt-1 flex items-center gap-1"><Icon name="phone" size={10}/> {c.phone}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setHistoryClient(c)} className="bg-white border border-pink-300 text-pink-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-pink-100 transition-colors flex items-center gap-1 shadow-sm">
                                                <Icon name="history" size={14}/> Historial
                                            </button>
                                            <button onClick={() => sendBirthdayGreeting(c)} className="bg-pink-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-pink-600 transition-colors flex items-center gap-1 shadow-sm transform hover:scale-105">
                                                <Icon name="send" size={14}/> Saludar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>)
                        }
                    </div>
                </div>
            </div>

            {/* MODAL: HISTORIAL DEL CLIENTE */}
            {historyClient && (() => {
                const clientAppts = appointments
                    .filter(a => a.clientId === historyClient.id && a.status === 'completed')
                    .sort((a,b) => new Date(b.date) - new Date(a.date));

                return (
                    <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 md:p-8 rounded-brand w-full max-w-lg relative shadow-2xl animate-scale-in border border-brand-border flex flex-col max-h-[80vh]">
                            <button onClick={()=>setHistoryClient(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                            
                            <div className="mb-6 border-b border-gray-100 pb-4">
                                <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                                    <Icon name="history" className="text-pink-500"/> Historial de Servicios
                                </h3>
                                <p className="font-bold text-brand-text mt-2">{historyClient.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Mira lo que suele realizarse para ofrecerle un descuento perfecto.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {clientAppts.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <Icon name="info" size={32} className="mx-auto mb-2 opacity-50"/>
                                        <p className="text-sm">Este cliente aún no tiene servicios completados.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {clientAppts.map(a => {
                                            const tr = treatments.find(t => t.id === a.treatmentId);
                                            const prof = professionals.find(p => p.id === a.professionalId);
                                            return (
                                                <div key={a.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{tr ? tr.name : 'Servicio Eliminado'}</p>
                                                        <p className="text-[10px] text-gray-500 mt-0.5 font-bold uppercase">{new Date(a.date).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric'})} • {prof ? prof.name : 'Sin prof.'}</p>
                                                    </div>
                                                    {tr && <span className="font-bold text-[var(--color-primary)] text-sm">${tr.price}</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* MODAL: SOLICITUDES WEB */}
            {selectedPendingAppt && (() => {
                const tr = treatments.find(t => t.id === selectedPendingAppt.treatmentId);
                const client = clients.find(c => c.id === selectedPendingAppt.clientId);
                const clientName = selectedPendingAppt.clientId?.startsWith('CHAT') ? selectedPendingAppt.clientNameTemp : client?.name;
                const apptDate = new Date(selectedPendingAppt.date);
                
                const capableProfs = professionals.filter(p => !p.specialties || p.specialties.length === 0 || p.specialties.includes(tr?.category));
                const needsProf = !approvalProfId;

                return (
                    <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-8 rounded-brand w-full max-w-sm relative shadow-2xl animate-scale-in border border-brand-border">
                            <button onClick={()=>setSelectedPendingAppt(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                            
                            <div className="mb-6 text-center border-b border-gray-100 pb-4">
                                <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3"><Icon name="globe" size={24}/></div>
                                <h3 className="font-bold text-xl text-gray-800">{clientName}</h3>
                                {client?.phone && <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><Icon name="phone" size={12}/> {client.phone}</p>}
                            </div>
                            
                            <div className="space-y-4 mb-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div><p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">Fecha y Hora</p><p className="font-bold text-gray-800 flex items-center gap-2"><Icon name="calendar" size={14}/> {apptDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short'})} a las {apptDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} hs</p></div>
                                <div><p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">Servicio</p><p className="font-bold text-gray-800 flex items-center gap-2"><Icon name="tag" size={14}/> {tr ? `${tr.category} - ${tr.name}` : 'No especificado'}</p></div>
                                
                                <div className="pt-2 border-t border-gray-200">
                                    <p className={`text-[10px] font-bold uppercase mb-1.5 ${needsProf ? 'text-red-500' : 'text-gray-400'}`}>Profesional Asignado *</p>
                                    <select 
                                        value={approvalProfId} 
                                        onChange={(e) => setApprovalProfId(e.target.value)}
                                        className={`w-full border p-2.5 rounded-lg bg-white text-gray-800 font-bold outline-none transition-colors ${needsProf ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200 focus:border-primary'}`}
                                    >
                                        <option value="">-- Debes seleccionar uno --</option>
                                        {capableProfs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-2">
                                <button disabled={needsProf} onClick={() => handleConfirm(selectedPendingAppt.id, approvalProfId)} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${needsProf ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:scale-105'}`}>
                                    <Icon name="check" size={16}/> <span>{needsProf ? 'Elegí Prof.' : 'Aprobar'}</span>
                                </button>
                                <button onClick={() => handleReject(selectedPendingAppt.id)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-100 flex justify-center items-center gap-2 transition-colors">
                                    <Icon name="message-square" size={16}/> <span>Rechazar y Avisar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

{/* MODAL: CENTRAL DE AVISOS Y RECORDATORIOS */}
            {reminderModal && (
                <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 md:p-8 rounded-brand w-full max-w-2xl relative shadow-2xl animate-scale-in border border-brand-border flex flex-col max-h-[90vh]">
                        <button onClick={()=>setReminderModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                        
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 bg-primary/20 text-primary-dark rounded-full flex items-center justify-center"><Icon name="message-square" size={20}/></div>
                            <div>
                                <h3 className="font-bold text-xl text-gray-800">Central de Avisos</h3>
                                <p className="text-xs text-gray-500">Filtrá turnos y mandá recordatorios por WhatsApp.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 shrink-0">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Buscar Fecha</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-primary font-medium text-gray-700"/>
                                        <button onClick={() => {
                                            const tomorrow = new Date();
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            setRemDate(tomorrow.toISOString().split('T')[0]);
                                        }} className="bg-[var(--color-primary)] text-white px-3 rounded-lg text-xs font-bold hover:opacity-80 transition-opacity whitespace-nowrap shadow-sm">Mañana</button>
                                    </div>
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Filtrar por Servicio</label>
                                    <select value={remTreatment} onChange={e => {setRemTreatment(e.target.value); setCustomPrepText('');}} className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-primary font-medium text-gray-700 bg-white">
                                        <option value="ALL">Todos los servicios (Solo recordatorio simple)</option>
                                        {treatments.map(t => <option key={t.id} value={t.id}>{t.category} - {t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            {remTreatment !== 'ALL' && (
                                <div className="pt-3 border-t border-gray-200 animate-fade-in">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Instrucciones de preparación (Se enviarán por WhatsApp)</label>
                                    <textarea value={customPrepText} onChange={e => setCustomPrepText(e.target.value)} placeholder="Ej: Venir rasurada, no usar cremas hidratantes, etc..." className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-primary resize-none" rows="2"></textarea>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {reminderAppts.length === 0 ? (
                                <div key="empty-reminders" className="text-center py-10 text-gray-400 flex flex-col items-center">
                                    <Icon name="calendar-x" size={40} className="mb-2 opacity-30"/>
                                    <p>No hay turnos que coincidan con esta búsqueda.</p>
                                </div>
                            ) : (
                                <div key="list-reminders" className="space-y-3">
                                    {reminderAppts.map(a => {
                                        const client = clients.find(c => c.id === a.clientId);
                                        const tr = treatments.find(t => t.id === a.treatmentId);
                                        const clientName = client ? client.name : (a.clientId?.startsWith('CHAT') ? a.clientNameTemp : 'Desconocido');
                                        const isSent = a.reminderSent; 

                                        return (
                                            <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${isSent ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-gray-200 hover:border-primary'}`}>
                                                <div className="mb-3 sm:mb-0">
                                                    <p className="font-bold text-gray-800 flex items-center gap-2">
                                                        {clientName} {isSent && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><Icon name="check-check" size={10}/> Avisado</span>}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Icon name="clock" size={12}/> {new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})} hs <span className="mx-1">•</span> <span className="text-primary-dark font-medium">{tr ? tr.name : 'Servicio'}</span></p>
                                                </div>
                                                <button onClick={() => sendReminderWA(a, client, tr)} disabled={!client?.phone} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-transform hover:scale-105 ${!client?.phone ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : (isSent ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' : 'bg-green-500 text-white hover:bg-green-600 shadow-md')}`}>
                                                    <Icon name={isSent ? "refresh-cw" : "send"} size={14}/> {!client?.phone ? 'Sin Teléfono' : (isSent ? 'Reenviar' : 'Recordar por WA')}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: LANZADOR DE WHATSAPP (Solución Anti-Bloqueo y Anti-Crash) */}
            {waModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
                    <div className="bg-white p-8 rounded-brand w-full max-w-sm text-center shadow-2xl animate-scale-in border-t-4 border-[#25D366]">
                        {waModal.loading ? (
                            <div key="loading-state" className="flex flex-col items-center py-6">
                                <Icon name="loader" size={40} className="animate-spin text-[#25D366] mb-4" />
                                <h3 className="font-bold text-lg text-gray-800"><span>Generando mensaje...</span></h3>
                                <p className="text-sm text-gray-500 mt-2"><span>Preparando el mensaje de confirmación.</span></p>
                            </div>
                        ) : (
                            <div key="ready-state" className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-green-100 text-[#25D366] rounded-full flex items-center justify-center mb-4">
                                    <Icon name="message-circle" size={32} />
                                </div>
                                <h3 className="font-bold text-lg text-gray-800 mb-2"><span>¡Mensaje Listo!</span></h3>
                                
                                <button 
                                    onClick={() => {
                                        openWhatsAppApp(waModal.phone, waModal.text);
                                        setWaModal({ open: false, phone: '', text: '', loading: false }); // Cerramos el modal
                                    }} 
                                    className="w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105"
                                >
                                    <Icon name="send" size={20} /> <span>Abrir WhatsApp</span>
                                </button>
                                
                                <button 
                                    onClick={() => setWaModal({ open: false, phone: '', text: '', loading: false })}
                                    className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600"
                                >
                                    <span>Cancelar</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
