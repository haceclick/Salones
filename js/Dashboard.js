// --- COMPONENTE DASHBOARD (LIMPIO Y BLINDADO) ---
const Dashboard = ({ clients, appointments, professionals, treatments, settings, notifications = [], adminMessages = [], saveAppointments, saveNotifications, notify, goToAgenda, refreshData, user }) => {
    const today = new Date();
    
    // 🔥 VERIFICACIÓN ESTRICTA DE ROL 🔥
    const isProfessional = user?.role === 'professional';

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPendingAppt, setSelectedPendingAppt] = useState(null);
    const [approvalProfId, setApprovalProfId] = useState(''); 
    const [reminderModal, setReminderModal] = useState(false);
    const [remDate, setRemDate] = useState(today.toISOString().split('T')[0]);
    const [remTreatment, setRemTreatment] = useState('ALL');
    const [customPrepText, setCustomPrepText] = useState('');
    const [historyClient, setHistoryClient] = useState(null); 
    const [readNotifs, setReadNotifs] = useState([]); 
    
    const handleDismissNotif = (notifId) => {
        setHiddenNotifs(prev => [...prev, String(notifId)]);
        const updatedNotifs = notifications.filter(notif => String(notif.id) !== String(notifId));
        if(saveNotifications) saveNotifications(updatedNotifs);
        
        const targetEmail = settings?.find(s => s.id === 'branding')?.adminEmail;
        if (targetEmail) {
            google.script.run.saveData(targetEmail, 'notifications', JSON.stringify(updatedNotifs));
        }
    };    

    const [waModal, setWaModal] = useState({ open: false, phone: '', text: '', loading: false });
    
    const todaysApps = appointments.filter(a => { 
        const d = new Date(a.date); 
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && a.status !== 'cancelled' && a.status !== 'blocked' && a.status !== 'holiday'; 
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    // Si es profesional, en "Agenda de Hoy" solo ve SUS turnos
    const myTodaysApps = isProfessional ? todaysApps.filter(a => a.professionalId === user?.profId) : todaysApps;

    const groupedTodaysApps = myTodaysApps.reduce((acc, appt) => {
        const prof = professionals.find(p => p.id === appt.professionalId);
        const profName = prof ? prof.name : 'Sin Asignar';
        if (!acc[profName]) acc[profName] = [];
        acc[profName].push(appt);
        return acc;
    }, {});

    const pendingApps = appointments.filter(a => {
        return (a.status === 'reserved' || a.status === 'pending_payment' || a.status === 'awaiting_deposit') && new Date(a.date) >= new Date(today.setHours(0,0,0,0));
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    const unclosedAppts = useMemo(() => {
        const now = new Date();
        const bufferTime = new Date(now.getTime() - (2 * 60 * 60 * 1000)); 
        
        let unclosed = appointments.filter(a => {
            if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'holiday' || a.status === 'blocked') {
                return false;
            }
            const apptDate = new Date(a.date);
            return apptDate < bufferTime;
        }).sort((a,b) => new Date(a.date) - new Date(b.date));
        
        if (isProfessional) unclosed = unclosed.filter(a => a.professionalId === user?.profId);
        return unclosed;
    }, [appointments, isProfessional, user]);

    const nextAppt = myTodaysApps.find(a => new Date(a.date) > new Date());

    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    const birthdayClients = clients.filter(c => {
        if (!c.birthday) return false;
        const parts = c.birthday.split('-');
        if (parts.length !== 3) return false;
        return parseInt(parts[1], 10) === currentMonth && parseInt(parts[2], 10) === currentDay;
    }).map(c => ({ ...c, isProf: false }));

    const birthdayProfs = professionals.filter(p => {
        if (!p.birthday) return false;
        const parts = p.birthday.split('-');
        if (parts.length !== 3) return false;
        return parseInt(parts[1], 10) === currentMonth && parseInt(parts[2], 10) === currentDay;
    }).map(p => ({ ...p, isProf: true }));

    const birthdayPeople = [...birthdayProfs, ...birthdayClients];

    const agentConfig = settings && Array.isArray(settings) ? settings.find(s => s.id === 'agent_config') : null;
    const msgConfig = settings && Array.isArray(settings) ? settings.find(s => s.id === 'messages_config') || {} : {};
    const businessName = agentConfig?.businessName || 'nuestro equipo';

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        if (refreshData) refreshData();
        setTimeout(() => setIsRefreshing(false), 1500);
    };

    const getClientLink = () => {
        if (agentConfig?.schedulerUrl) return agentConfig.schedulerUrl;
        const baseDomain = "https://salones.haceclick-ai.com/";
        const alias = agentConfig?.tenantAlias;
        if (alias) return `${baseDomain}?local=${alias}`;
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
        if (isProfessional) return; // BLOQUEO
        const appt = appointments.find(a => a.id === apptId);
        const finalProfId = forcedProfId || appt.professionalId;
        const client = clients.find(c => c.id === appt.clientId);
        const tr = treatments ? treatments.find(t => t.id === appt.treatmentId) : null;
        
        const requiresDeposit = agentConfig?.requireDeposit;
        const newStatus = requiresDeposit ? 'awaiting_deposit' : 'confirmed';
        
        const updated = appointments.map(a => a.id === apptId ? { ...a, status: newStatus, professionalId: finalProfId } : a);
        saveAppointments(updated);
        
        setSelectedPendingAppt(null); 
        
        notify(requiresDeposit ? "Aprobado. Esperando pago de seña..." : "Confirmado y asignado.", "success");
        sendWhatsAppMsg({...appt, professionalId: finalProfId}, client, tr, requiresDeposit);
    };

    const handleConfirmDeposit = (e, appt) => {
        if (isProfessional) return; // BLOQUEO
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
        if (isProfessional) return; // BLOQUEO
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

    const handleReject = (apptId) => {
        if (isProfessional) return; // BLOQUEO
        const appt = appointments.find(a => a.id === apptId);
        const client = clients.find(c => c.id === appt?.clientId);
        
        saveAppointments(appointments.filter(a => a.id !== apptId));
        notify("Solicitud rechazada. Abriendo WhatsApp para reprogramar...", "info");
        setSelectedPendingAppt(null);

        if (client && client.phone) {
            const phone = String(client.phone).replace(/\D/g, ''); 
            const rejectMsg = msgConfig.reject || 'Te pedimos mil disculpas, pero tuvimos que rechazar tu solicitud porque el espacio se ocupó o el profesional no está disponible.\n\n¿Te gustaría que te ofrezcamos otro horario? Quedamos a tu disposición. 🙏';
            const text = `¡Hola *${client.name}*! 👋\nTe escribimos de *${businessName}*.\n\n${rejectMsg}`;
            openWhatsAppApp(phone, text);
        }
    }; 

    const sendWhatsAppMsg = (appt, client, treatment, isAwaitingDeposit = false) => {
        if (isProfessional) return; // BLOQUEO
        if (!client || !client.phone) return;
        const phone = String(client.phone).replace(/\D/g, ''); 
        const d = new Date(appt.date);
        const dateStr = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const serviceName = treatment ? treatment.name : 'tu servicio';

        if (isAwaitingDeposit) {
            let depositText = '';
            if (!agentConfig.depositType || agentConfig.depositType === 'link') {
                depositText = `\n\n⚠️ *Para asegurar tu lugar, te pedimos que abones una seña de $${agentConfig?.depositAmount}.*\n💳 *Link de pago:* ${agentConfig?.paymentUrl}\n_(Una vez que pagues, envianos el comprobante por acá para registrarlo)_`;
            } else {
                depositText = `\n\n⚠️ *Para asegurar tu lugar, te pedimos que abones una seña de $${agentConfig?.depositAmount}.*\n\n🏦 *Datos para transferencia:*\nAlias/CBU: *${agentConfig?.transferAlias}*\nTitular: *${agentConfig?.transferName || '-'}*\nCUIT: *${agentConfig?.transferCuit || '-'}*\n\n_(Una vez que transfieras, envianos el comprobante por acá para registrarlo)_`;
            }
            const text = `¡Hola *${client.name}*! 👋\nRecibimos tu solicitud de turno para: *${serviceName}* el *${dateStr}* a las *${timeStr} hs*.${depositText}`;
            setWaModal({ open: true, loading: false, phone: phone, text: text });
            return; 
        }
        
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
        if (isProfessional) return; // BLOQUEO
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

    const sendBirthdayGreeting = (person) => {
        if (isProfessional) return; // BLOQUEO: Los profesionales no envían saludos
        if (!person || !person.phone) return;
        const phone = String(person.phone).replace(/\D/g, '');
        
        let text = '';
        if (person.isProf) {
            text = `¡Feliz cumpleaños *${person.name}*! 🎂🎈\n\nDe parte de todo el equipo de *${businessName}* te deseamos un día espectacular. ¡Gracias por ser parte de nuestro equipo! 🥳✨`;
        } else {
            const promoText = msgConfig.birthday || 'Para festejar con vos te damos un regalo especial.';
            text = `¡Hola *${person.name}*! 🎂🎈\n\nEn este día especial, todo el equipo de *${businessName}* te desea un ¡MUY FELIZ CUMPLEAÑOS! 🥳✨\n\n${promoText}\n\nQue pases un día hermoso.`;
        }
        
        openWhatsAppApp(phone, text);
        notify("Abriendo WhatsApp para saludar...", "success");
    };

    const [hiddenNotifs, setHiddenNotifs] = useState([]);

    const allNotifs = useMemo(() => {
        const formattedAdminMessages = (adminMessages || []).map(msg => {
            const cleanTitle = typeof msg.title === 'object' ? (msg.title.title || "Aviso") : (msg.title || "Aviso");
            const cleanMsg = typeof msg.message === 'object' ? (msg.message.message || "") : (msg.message || "");
            
            return {
                ...msg, title: cleanTitle, message: cleanMsg, type: 'admin_manual', id: msg.id || Date.now() + Math.random()
            };
        });
        return formattedAdminMessages.filter(n => !hiddenNotifs.includes(String(n.id)));
    }, [adminMessages, hiddenNotifs]);

    const newClientNotifs = useMemo(() => {
        return (notifications || []).filter(n => n.type === 'new_client' && !hiddenNotifs.includes(String(n.id)));
    }, [notifications, hiddenNotifs]);
    
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
                <p className="text-2xl font-bold text-brand-text">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 pb-12 space-y-8 bg-brand-bg relative">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-brand-text">Panel General</h2>
                    <p className="text-brand-text-light mt-1">Bienvenido a tu centro de control.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="bg-white border border-brand-border text-brand-text-light px-4 py-2.5 rounded-brand font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                        title="Forzar actualización de datos"
                    >
                        <Icon name="refresh-cw" size={18} className={isRefreshing ? "animate-spin text-[var(--color-primary)]" : ""}/> 
                        <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>

                    <button 
                        onClick={() => window.open(getClientLink(), '_blank')} 
                        className="bg-white border border-brand-border text-brand-text-light px-4 py-2.5 rounded-brand font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Icon name="external-link" size={18}/> Portal Clientes
                    </button>
                    
                    {/* Solo Dueño o Admin pueden enviar recordatorios masivos */}
                    {!isProfessional && (
                        <button onClick={() => setReminderModal(true)} className="bg-[var(--color-primary)] text-[var(--color-primary-text)] px-5 py-2.5 rounded-brand font-bold flex items-center gap-2 transition-all shadow-md hover:opacity-90">
                            <Icon name="message-square" size={18}/> Enviar Avisos
                        </button>
                    )}
                </div>
            </header>

            {/* --- ALERTA DE SERVICIOS SIN CERRAR --- */}
            {unclosedAppts.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 md:p-6 rounded-brand shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center shrink-0 mt-1 md:mt-0">
                            <Icon name="alert-triangle" size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-red-700 text-base leading-tight">¡Tienes {unclosedAppts.length} {unclosedAppts.length === 1 ? 'servicio sin cerrar' : 'servicios sin cerrar'}!</h4>
                            <p className="text-sm text-red-600/80 mt-1">Quedaron turnos pasados como "Confirmados". {isProfessional ? 'Avísale a tu administrador para que los cierre.' : 'Ciérralos para mantener tu caja al día:'}</p>
                            
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {unclosedAppts.slice(0, 4).map(a => {
                                    const client = clients.find(c => c.id === a.clientId);
                                    const cName = client ? client.name : (a.clientId?.startsWith('CHAT') ? a.clientNameTemp : 'Desconocido');
                                    const d = new Date(a.date);
                                    return (
                                        <span key={a.id} className="bg-white text-red-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-red-200 flex items-center gap-1">
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
                        className="bg-white border border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 whitespace-nowrap w-full md:w-auto mt-2 md:mt-0"
                    >
                        <Icon name="calendar" size={18}/> Ir a la Agenda
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                <DashCard icon={<Icon name="calendar" size={20} className="text-brand-text" />} color="bg-blue-50" label="Turnos Hoy" value={myTodaysApps.length} />
                <DashCard icon={<Icon name="bell" size={20} className="text-brand-text" />} color="bg-yellow-50" label="Reservas Web" value={isProfessional ? '-' : pendingApps.length} />
                <DashCard icon={<Icon name="users" size={20} className="text-brand-text" />} color="bg-green-50" label="Clientes" value={isProfessional ? '-' : clients.length} />
                <DashCard 
                    icon={<Icon name="clock" size={20} className="text-brand-text" />} 
                    color="bg-gray-100" 
                    label="Próximo" 
                    value={nextAppt ? new Date(nextAppt.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Libre'} 
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    
                    {/* SOLICITUDES WEB Y NUEVOS CLIENTES */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-base text-brand-text flex items-center gap-2"><Icon name="globe" className="text-yellow-600"/> Solicitudes Web</h3>
                            {totalPendingRequests > 0 && <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase">{totalPendingRequests} Pendientes</span>}
                        </div>
                        
                        {totalPendingRequests === 0 || isProfessional ? 
                            (<div key="empty-pending" className="text-center py-8 text-brand-text-light flex flex-col items-center">
                                <Icon name="check-circle" size={40} className="mb-2 opacity-30"/>
                                <p>{isProfessional ? 'Solo el administrador puede ver las solicitudes web.' : 'Sin solicitudes pendientes.'}</p>
                            </div>) : 
                            (<div key="list-pending" className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                
                                {/* A. RENDERIZAMOS LOS CLIENTES NUEVOS PRIMERO */}
                                {newClientNotifs.map(n => (
                                    <div key={n.id} className="p-4 rounded-brand border bg-green-50 border-green-200 hover:shadow-sm transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="font-bold text-base text-gray-800">{n.clientName}</p>
                                                <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1"><Icon name="phone" size={12}/> {n.clientPhone}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded text-green-700 bg-green-100 border border-green-200">
                                                    Nuevo Registro
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-3 border-t border-green-200/60">
                                            <button onClick={() => {
                                                const welcomeText = msgConfig.welcome || '¡Qué alegría sumarte a nuestro local! En breve revisaremos la solicitud de tu turno.';
                                                const text = `¡Hola *${n.clientName}*! 👋\n\n${welcomeText}`;
                                                openWhatsAppApp(n.clientPhone.replace(/\D/g, ''), text);
                                                handleDismissNotif(n.id);
                                            }} className="flex-1 bg-green-100 text-green-700 border border-green-200 py-2 rounded-brand text-xs font-bold hover:bg-green-200 flex justify-center items-center gap-1 shadow-sm transition-colors">
                                                <Icon name="message-circle" size={14}/> <span>Saludar</span>
                                            </button>
                                            <button onClick={() => {
                                                handleDismissNotif(n.id);
                                                notify("Cliente marcado como saludado", "success");
                                            }} className="flex-1 bg-white border border-green-200 text-green-600 py-2 rounded-brand text-xs font-bold hover:bg-green-50 transition-colors">
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
                                             className={`p-4 rounded-brand border ${!isAwaiting ? 'cursor-pointer hover:shadow-sm hover:-translate-y-0.5' : ''} transition-all group ${isAwaiting ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                            
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className={`font-bold text-base transition-colors ${isAwaiting ? 'text-orange-700' : 'text-gray-800'}`}>{clientName}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{new Date(a.date).toLocaleDateString('es-ES', {weekday:'short', day:'numeric'})} - {new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</p>
                                                    {tr && <p className="text-[10px] text-gray-400 mt-0.5">{tr.name}</p>}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${isAwaiting ? 'text-orange-700 bg-orange-100 border-orange-200' : 'text-yellow-700 bg-yellow-100 border-yellow-200'}`}>
                                                        {isAwaiting ? 'Esperando Seña' : 'Reserva Turno'}
                                                    </span>
                                                    {!isAwaiting && needsProf && <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 rounded">Falta Asignar</span>}
                                                </div>
                                            </div>
                                            
                                            <div className={`flex gap-2 pt-3 border-t ${isAwaiting ? 'border-orange-200/60' : 'border-yellow-200/60'}`}>
                                                {isAwaiting ? (
                                                    <>
                                                        <button onClick={(e) => handleConfirmDeposit(e, a)} className="flex-1 bg-green-50 border border-green-200 text-green-700 py-2 rounded-brand text-xs font-bold hover:bg-green-100 flex justify-center items-center gap-1 shadow-sm transition-colors">
                                                            <Icon name="check-circle" size={14}/> <span>Seña Recibida</span>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleReject(a.id); }} className="flex-1 bg-white border border-orange-200 text-orange-600 py-2 rounded-brand text-xs font-bold hover:bg-orange-50 transition-colors">
                                                            <span>Cancelar Turno</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={(e) => handleQuickConfirm(e, a)} className={`flex-1 py-2 rounded-brand text-xs font-bold flex justify-center items-center gap-1 transition-colors border ${needsProf ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm'}`}>
                                                            <Icon name={needsProf ? 'user-plus' : 'message-circle'} size={14}/> <span>{needsProf ? 'Asignar Prof.' : 'Confirmar'}</span>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleReject(a.id); }} className="flex-1 bg-white border border-gray-200 text-gray-500 py-2 rounded-brand text-xs font-bold hover:text-red-500 hover:bg-red-50 transition-colors">
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

                    {/* TURNOS HOY - CON ESTADOS REALES Y COLORES PASTEL */}
                    <div className="bg-brand-card rounded-brand shadow-card border border-brand-border p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-base text-brand-text flex items-center gap-2"><Icon name="calendar"/> Agenda de Hoy</h3>
                        </div>
                        {myTodaysApps.length === 0 ? 
                            (<div key="empty-today" className="text-center py-12 text-brand-text-light flex flex-col items-center">
                                <Icon name="coffee" size={48} className="mb-2 opacity-30"/>
                                <p>{isProfessional ? 'No tienes turnos programados para hoy.' : 'No hay turnos para hoy.'}</p>
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
                                                
                                                let statusBadge = { text: 'PENDIENTE', style: 'bg-gray-100 text-gray-500 border border-gray-200' };
                                                let rowBg = 'bg-white border-gray-200 hover:border-[var(--color-primary)]';

                                                if (isCompleted) {
                                                    statusBadge = { text: 'FINALIZADO', style: 'bg-gray-100 text-gray-500 border border-gray-200' };
                                                    rowBg = 'bg-gray-50 border-gray-200 opacity-70';
                                                } else if (a.status === 'confirmed' || a.status === 'confirmed_paid') {
                                                    statusBadge = { text: 'CONFIRMADO', style: 'bg-blue-50 text-blue-600 border border-blue-200' };
                                                    rowBg = 'bg-blue-50/30 border-blue-200 hover:shadow-sm';
                                                } else if (a.status === 'awaiting_deposit') {
                                                    statusBadge = { text: 'FALTA SEÑA', style: 'bg-orange-50 text-orange-600 border border-orange-200 animate-pulse' };
                                                    rowBg = 'bg-orange-50/30 border-orange-200 hover:shadow-sm';
                                                } else if (a.status === 'reserved' || a.status === 'pending_payment') {
                                                    statusBadge = { text: 'A REVISAR', style: 'bg-yellow-50 text-yellow-600 border border-yellow-200' };
                                                    rowBg = 'bg-yellow-50/30 border-yellow-200 hover:shadow-sm';
                                                }

                                                return (
                                                    <div key={a.id} onClick={() => goToAgenda(a.id)} className={`flex items-center p-3 rounded-brand border transition-all cursor-pointer ${rowBg}`}>
                                                        <span className={`font-bold text-base w-16 text-center shrink-0 ${isCompleted ? 'text-gray-400' : 'text-gray-700'}`}>{new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                                                        <div className="flex-1 border-l border-gray-200 pl-4 ml-2 overflow-hidden">
                                                            <p className="font-bold text-gray-800 truncate">{clientName || 'Bloqueo'}</p>
                                                            {tr && <p className="text-[10px] text-gray-500 truncate">{tr.name}</p>}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-wider ${statusBadge.style}`}>{statusBadge.text}</span>
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
                            <h3 className="font-bold text-base text-brand-text flex items-center gap-2"><Icon name="bell"/> Avisos del Sistema</h3>
                        </div>
                        {allNotifs.length === 0 ? 
                            (<div key="empty-notif" className="p-6 bg-brand-bg rounded-brand border border-brand-border text-center text-sm text-brand-text-light italic">No hay mensajes del administrador.</div>) : 
                            (<div key="list-notif" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {allNotifs.map((n) => {
                                    const isRead = readNotifs.includes(String(n.id));
                                    
                                    return (
                                        <div key={n.id} className={`p-4 rounded-brand border relative transition-all ${isRead ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-blue-50 border-blue-200'}`}>
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <p className={`font-bold text-sm flex items-center gap-1 ${isRead ? 'text-gray-500' : 'text-blue-800'}`}>
                                                        <Icon name="info" size={14} className={isRead ? "text-gray-400" : "text-blue-500"}/> 
                                                        {String(n.title || "")}
                                                    </p>
                                                    <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap ${isRead ? 'text-gray-400' : 'text-blue-900/70'}`}>
                                                        {n.message.split(/(\*.*?\*)/g).map((part, i) => 
                                                            part.startsWith('*') && part.endsWith('*') 
                                                                ? <strong key={i} className="font-bold text-gray-900">{part.slice(1, -1)}</strong> 
                                                                : part
                                                        )}
                                                    </p>
                                                </div>

                                                {/* 🔥 OCULTAMOS LOS BOTONES DE LECTURA SI ES PROFESIONAL 🔥 */}
                                                {!isRead && !isProfessional && (
                                                    <button 
                                                        onClick={() => setReadNotifs(prev => [...prev, String(n.id)])}
                                                        className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors shadow-sm shrink-0 flex items-center gap-1"
                                                    >
                                                        <Icon name="check" size={12}/> Marcar Leído
                                                    </button>
                                                )}
                                                {isRead && !isProfessional && (
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 shrink-0 bg-gray-100 px-2 py-1 rounded border border-gray-200">
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
                            <h3 className="font-bold text-base text-brand-text flex items-center gap-2"><Icon name="gift" className="text-pink-500"/> Cumpleaños de Hoy</h3>
                            {birthdayPeople.length > 0 && <span className="bg-pink-50 border border-pink-200 text-pink-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase animate-pulse">¡Hay festejos!</span>}
                        </div>
                        {birthdayPeople.length === 0 ? 
                            (<div key="empty-birthdays" className="p-6 bg-brand-bg rounded-brand border border-brand-border text-center text-sm text-brand-text-light italic">No hay cumpleaños registrados para hoy.</div>) : 
                            (<div key="list-birthdays" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {birthdayPeople.map((person) => (
                                    <div key={person.id} className="p-4 rounded-xl border bg-pink-50 border-pink-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-sm transition-all">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                                {person.name} {person.isProf && <span className="bg-purple-100 border border-purple-200 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Equipo</span>}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1 flex items-center gap-1"><Icon name="phone" size={10}/> {person.phone || 'Sin número'}</p>
                                        </div>
                                        
                                        {/* 🔥 OCULTAMOS BOTONES DE SALUDO Y HISTORIAL SI ES PROFESIONAL */}
                                        {!isProfessional && (
                                            <div className="flex gap-2">
                                                {!person.isProf && (
                                                    <button onClick={() => setHistoryClient(person)} className="bg-white border border-pink-200 text-pink-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-pink-100 transition-colors flex items-center gap-1 shadow-sm">
                                                        <Icon name="history" size={14}/> Historial
                                                    </button>
                                                )}
                                                <button onClick={() => sendBirthdayGreeting(person)} className="bg-pink-100 border border-pink-300 text-pink-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-pink-200 transition-colors flex items-center gap-1 shadow-sm">
                                                    <Icon name="send" size={14}/> Saludar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>)
                        }
                    </div>
                </div>
            </div>

            {/* MODALES */}
            {historyClient && (() => {
                const clientAppts = appointments
                    .filter(a => a.clientId === historyClient.id && a.status === 'completed')
                    .sort((a,b) => new Date(b.date) - new Date(a.date));

                return (
                    <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 md:p-8 rounded-brand w-full max-w-lg relative shadow-2xl animate-scale-in border border-brand-border flex flex-col max-h-[80vh]">
                            <button onClick={()=>setHistoryClient(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                            
                            <div className="mb-6 border-b border-gray-100 pb-4">
                                <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
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

            {selectedPendingAppt && (() => {
                if (isProfessional) {
                    return (
                        <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-8 rounded-brand w-full max-w-sm relative shadow-2xl animate-scale-in border border-brand-border text-center">
                                <button onClick={()=>setSelectedPendingAppt(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                                <div className="w-16 h-16 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="lock" size={32}/></div>
                                <h3 className="font-bold text-base text-gray-800 mb-2">Acceso Restringido</h3>
                                <p className="text-sm text-gray-500 mb-6">Solo los administradores del local pueden aprobar o modificar solicitudes de turnos web.</p>
                                <button onClick={()=>setSelectedPendingAppt(null)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Entendido</button>
                            </div>
                        </div>
                    );
                }

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
                                <div className="w-12 h-12 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full flex items-center justify-center mx-auto mb-3"><Icon name="globe" size={24}/></div>
                                <h3 className="font-bold text-base text-gray-800">{clientName}</h3>
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
                                        className={`w-full border p-2.5 rounded-lg bg-white text-gray-800 font-bold outline-none transition-colors ${needsProf ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 focus:border-[var(--color-primary)]'}`}
                                    >
                                        <option value="">-- Debes seleccionar uno --</option>
                                        {capableProfs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-2">
                                <button disabled={needsProf} onClick={() => handleConfirm(selectedPendingAppt.id, approvalProfId)} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all border ${needsProf ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm hover:scale-[1.02]'}`}>
                                    <Icon name="check" size={16}/> <span>{needsProf ? 'Elegí Prof.' : 'Aprobar'}</span>
                                </button>
                                <button onClick={() => handleReject(selectedPendingAppt.id)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-100 flex justify-center items-center gap-2 transition-colors shadow-sm hover:scale-[1.02]">
                                    <Icon name="message-square" size={16}/> <span>Rechazar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {reminderModal && !isProfessional && (
                <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 md:p-8 rounded-brand w-full max-w-2xl relative shadow-2xl animate-scale-in border border-brand-border flex flex-col max-h-[90vh]">
                        <button onClick={()=>setReminderModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><Icon name="x"/></button>
                        
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] rounded-full flex items-center justify-center border border-[var(--color-primary)]/20"><Icon name="message-square" size={20}/></div>
                            <div>
                                <h3 className="font-bold text-base text-gray-800">Central de Avisos</h3>
                                <p className="text-xs text-gray-500">Filtrá turnos y mandá recordatorios por WhatsApp.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 shrink-0">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Buscar Fecha</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-[var(--color-primary)] font-medium text-gray-700"/>
                                        <button onClick={() => {
                                            const tomorrow = new Date();
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            setRemDate(tomorrow.toISOString().split('T')[0]);
                                        }} className="bg-white border border-[var(--color-primary)] text-[var(--color-primary)] px-3 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors whitespace-nowrap shadow-sm">Mañana</button>
                                    </div>
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Filtrar por Servicio</label>
                                    <select value={remTreatment} onChange={e => {setRemTreatment(e.target.value); setCustomPrepText('');}} className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-[var(--color-primary)] font-medium text-gray-700 bg-white">
                                        <option value="ALL">Todos los servicios (Solo recordatorio simple)</option>
                                        {treatments.map(t => <option key={t.id} value={t.id}>{t.category} - {t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            {remTreatment !== 'ALL' && (
                                <div className="pt-3 border-t border-gray-200 animate-fade-in">
                                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Instrucciones de preparación (Se enviarán por WhatsApp)</label>
                                    <textarea value={customPrepText} onChange={e => setCustomPrepText(e.target.value)} placeholder="Ej: Venir rasurada, no usar cremas hidratantes, etc..." className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-[var(--color-primary)] resize-none" rows="2"></textarea>
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
                                            <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${isSent ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-200 hover:border-[var(--color-primary)]'}`}>
                                                <div className="mb-3 sm:mb-0">
                                                    <p className="font-bold text-gray-800 flex items-center gap-2">
                                                        {clientName} {isSent && <span className="bg-blue-100 border border-blue-200 text-blue-700 text-[9px] px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><Icon name="check-check" size={10}/> Avisado</span>}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Icon name="clock" size={12}/> {new Date(a.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})} hs <span className="mx-1">•</span> <span className="text-gray-600 font-medium">{tr ? tr.name : 'Servicio'}</span></p>
                                                </div>
                                                <button onClick={() => sendReminderWA(a, client, tr)} disabled={!client?.phone} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-transform border ${!client?.phone ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : (isSent ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-sm' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm hover:scale-105')}`}>
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

            {waModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
                    <div className="bg-white p-8 rounded-brand w-full max-w-sm text-center shadow-2xl animate-scale-in border-t-4 border-[#25D366]">
                        {waModal.loading ? (
                            <div key="loading-state" className="flex flex-col items-center py-6">
                                <Icon name="loader" size={40} className="animate-spin text-[#25D366] mb-4" />
                                <h3 className="font-bold text-base text-gray-800"><span>Generando mensaje...</span></h3>
                                <p className="text-sm text-gray-500 mt-2"><span>Preparando el mensaje de confirmación.</span></p>
                            </div>
                        ) : (
                            <div key="ready-state" className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-[#25D366]/10 text-[#0f763e] border border-[#25D366]/30 rounded-full flex items-center justify-center mb-4">
                                    <Icon name="message-circle" size={32} />
                                </div>
                                <h3 className="font-bold text-base text-gray-800 mb-2"><span>¡Mensaje Listo!</span></h3>
                                
                                <button 
                                    onClick={() => {
                                        openWhatsAppApp(waModal.phone, waModal.text);
                                        setWaModal({ open: false, phone: '', text: '', loading: false }); 
                                    }} 
                                    className="w-full bg-[#25D366]/10 border border-[#25D366]/30 text-[#0f763e] py-3.5 rounded-xl font-bold hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02]"
                                >
                                    <Icon name="send" size={20} /> <span>Abrir WhatsApp</span>
                                </button>
                                
                                <button 
                                    onClick={() => setWaModal({ open: false, phone: '', text: '', loading: false })}
                                    className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
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
