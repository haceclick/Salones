const Agenda = ({ appointments, clients, treatments, professionals, settings, setAppointments, saveAppointments, notify, targetApptId, clearTargetAppt, loggedProfId, userRole }) => {
    const isProfessional = userRole === 'professional';

    const [currentDate, setCurrentDate] = useState(new Date());
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState(null);
    const [errorModal, setErrorModal] = useState({ open: false, message: '' }); 
    const [editingApptId, setEditingApptId] = useState(null);
    
    const [form, setForm] = useState({ clientId: '', treatmentId: '', profId: loggedProfId || '', assistantId: '', date: '', time: '', status: 'confirmed' });
    
    const [filterProf, setFilterProf] = useState(loggedProfId || 'all');
    const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
    const [blockModal, setBlockModal] = useState({ open: false, type: 'day', date: '', time: '', profId: loggedProfId || '' });

    const [showCheckout, setShowCheckout] = useState(null); 
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [discountValue, setDiscountValue] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [discountType, setDiscountType] = useState('fixed'); 

    useEffect(() => {
        if (targetApptId && appointments.length > 0) {
            const appt = appointments.find(a => a.id === targetApptId);
            if (appt) {
                setCurrentDate(new Date(appt.date)); 
                setSelectedAppt(appt);               
            }
            if(clearTargetAppt) clearTargetAppt(); 
        }
    }, [targetApptId, appointments]);

    const weekDays = useMemo(() => { 
        const days = []; 
        const curr = new Date(currentDate); 
        const day = curr.getDay(); 
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(curr.setDate(diff));
        for(let i=0; i<7; i++) {
            const d = new Date(monday); 
            d.setDate(monday.getDate() + i); 
            days.push(d); 
        }
        return days;
    }, [currentDate]);

    const getDuration = (tId) => { 
        if(tId==='BLOCK') return 60; 
        const t = treatments.find(x=>x.id===tId); 
        return t ? parseInt(t.duration||30) : 30; 
    };

    const isWorkingHour = (profId, dayDate, hour) => {
        if (profId === 'all') {
            return professionals.some(prof => {
                if (!prof.workingDays) return true;
                const dayOfWeek = dayDate.getDay();
                const dayConfig = prof.workingDays[dayOfWeek];
                if (!dayConfig || !dayConfig.active) return false;
                const startHour = Math.floor(parseInt(dayConfig.start) / 100);
                const endHour = Math.floor(parseInt(dayConfig.end) / 100);
                return hour >= startHour && hour < endHour;
            });
        } 
        
        const prof = professionals.find(p => p.id === profId);
        if (!prof || !prof.workingDays) return true;
        const dayOfWeek = dayDate.getDay(); 
        const dayConfig = prof.workingDays[dayOfWeek];
        if (!dayConfig || !dayConfig.active) return false; 
        const startHour = Math.floor(parseInt(dayConfig.start) / 100);
        const endHour = Math.floor(parseInt(dayConfig.end) / 100);
        return hour >= startHour && hour < endHour;
    };

    const isWorkingDay = (profId, dayDate) => {
        if (profId === 'all') {
            return professionals.some(prof => {
                if (!prof.workingDays) return true;
                const dayOfWeek = dayDate.getDay();
                return prof.workingDays[dayOfWeek] && prof.workingDays[dayOfWeek].active;
            });
        }
        
        const prof = professionals.find(p => p.id === profId);
        if (!prof || !prof.workingDays) return true;
        const dayOfWeek = dayDate.getDay();
        return prof.workingDays[dayOfWeek] && prof.workingDays[dayOfWeek].active;
    };

    const visibleAppointments = useMemo(() => {
        return appointments.filter(a => {
            if (a.status === 'holiday') return true;
            if (filterProf === 'all') return true;
            return a.professionalId === filterProf || a.professionalId === 'any' || a.professionalId === 'ALL';
        });
    }, [appointments, filterProf]);

    const handleSave = (e) => {
        if (isProfessional) return; 
        e.preventDefault();
        try {
            const [year, month, day] = form.date.split('-').map(Number);
            const [hours, minutes] = form.time.split(':').map(Number);
            const localDate = new Date(year, month - 1, day, hours, minutes);
            const iso = localDate.toISOString();
            
            const finalProfId = loggedProfId ? loggedProfId : form.profId;

            if (!finalProfId) {
                setErrorModal({ open: true, message: "Debes seleccionar un profesional para asignar el turno." });
                return;
            }

            const isValidHour = isWorkingHour(finalProfId, localDate, hours);
            const isValidDay = isWorkingDay(finalProfId, localDate);
            
            if (!isValidDay || !isValidHour) {
                setErrorModal({ open: true, message: "El profesional seleccionado no trabaja en ese día u horario." });
                return; 
            }

            const apptData = { 
                id: editingApptId || Date.now().toString(), 
                clientId: form.clientId,
                treatmentId: form.treatmentId,
                professionalId: finalProfId,
                assistantId: form.assistantId || null, 
                date: iso,
                status: form.status,
                origin: editingApptId ? (appointments.find(a => a.id === editingApptId)?.origin || 'manual') : 'manual'
            };

            if (form.status === 'completed') {
                setIsCreateOpen(false);
                setShowCheckout(apptData);
                setDiscountValue(0);
                setDiscountReason('');
                setDiscountType('fixed');
                return;
            }

            saveAppointments(editingApptId ? appointments.map(a => a.id === editingApptId ? apptData : a) : [...appointments, apptData]);
            setIsCreateOpen(false); 
            setEditingApptId(null); 
            notify(editingApptId ? "Turno actualizado" : "Turno agendado", "success");
        } catch (error) { notify("Error al procesar la fecha.", "error"); }
    };

    const handleBlock = (e) => {
        if (isProfessional) return;
        e.preventDefault();
        const iso = blockModal.type === 'day' ? new Date(`${blockModal.date}T00:00:00`).toISOString() : new Date(`${blockModal.date}T${blockModal.time}`).toISOString();
        const blockProfId = loggedProfId ? loggedProfId : (blockModal.profId || 'ALL');
        saveAppointments([...appointments, { id: Date.now().toString(), clientId: 'BLOCK', treatmentId: 'BLOCK', professionalId: blockProfId, date: iso, status: blockModal.type === 'day' ? 'holiday' : 'blocked' }]);
        setBlockModal({ ...blockModal, open: false }); 
        notify("Bloqueo registrado", "success");
    };

    const handleStatusChange = (apptId, newStatus) => {
        if (isProfessional) return;
        if (newStatus === 'completed') {
            const appt = appointments.find(a => a.id === apptId);
            setSelectedAppt(null); 
            setDiscountValue(0);
            setDiscountReason('');
            setDiscountType('fixed');
            setShowCheckout(appt); 
            return;
        }
        saveAppointments(appointments.map(a => a.id === apptId ? {...a, status: newStatus} : a));
        setSelectedAppt(prev => prev ? {...prev, status: newStatus} : null);
    };

    const handleCompleteCheckout = () => {
        if (isProfessional) return;
        
        const appt = showCheckout;
        const tr = treatments.find(t => t.id === appt.treatmentId);
        const client = clients.find(c => c.id === appt.clientId);
        const agentStr = settings?.find(s => s.id === 'agent_config') || {};
        
        const total = parseFloat(tr?.price || 0);
        const hasDeposit = (appt.status === 'confirmed_paid' || appt.status === 'reserved');
        const depositAmount = hasDeposit ? parseFloat(agentStr.depositAmount || 0) : 0;
        
        let safeDiscount = 0;
        const inputVal = parseFloat(discountValue) || 0;
        
        if (discountType === 'percentage') {
            safeDiscount = total * (inputVal / 100);
        } else {
            safeDiscount = inputVal;
        }

        const remainingToPay = total - depositAmount;
        if (safeDiscount < 0) safeDiscount = 0;
        if (safeDiscount > remainingToPay) safeDiscount = remainingToPay;

        const finalAmount = total - depositAmount - safeDiscount;

        let assistantCommission = 0;
        if (appt.assistantId) {
            const assistant = professionals.find(p => p.id === appt.assistantId);
            if (assistant && assistant.hasCommission) {
                if (assistant.commissionType === 'percentage') {
                    const rateStr = assistant.commissionRates?.[tr?.category] || '0';
                    const rate = parseFloat(rateStr);
                    assistantCommission = total * (rate / 100);
                } else if (assistant.commissionType === 'fixed_service') {
                    assistantCommission = parseFloat(assistant.commissionValue || 0);
                }
            }
        }

        const updatedAppointments = appointments.map(a => 
            a.id === appt.id ? { 
                ...a, 
                status: 'completed', 
                paymentMethod: paymentMethod, 
                finalAmount: finalAmount,      
                discountAmount: safeDiscount, 
                discountReason: discountReason,
                assistantCommission: assistantCommission
            } : a
        );
        
        saveAppointments(updatedAppointments);

        const message = `¡Gracias por visitarnos, *${client.name}*! 😊✨\n\n` +
                        `Tu servicio de *${tr?.name}* ha sido finalizado.\n\n` +
                        `💰 *Detalle del pago:*\n` +
                        `- Valor Servicio: $${total.toLocaleString()}\n` +
                        (hasDeposit ? `- Seña abonada: -$${depositAmount.toLocaleString()}\n` : '') +
                        (safeDiscount > 0 ? `- Descuento aplicado: -$${safeDiscount.toLocaleString()} ${discountReason ? '('+discountReason+')' : ''}\n` : '') +
                        `--------------------------\n` +
                        `*Total abonado hoy: $${finalAmount.toLocaleString()}*\n` +
                        `_(Medio: ${paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'})_\n\n` +
                        `¡Esperamos verte pronto! 💖`;

        let phone = String(client.phone).replace(/\D/g, '');
        if (!phone.startsWith('54')) phone = '549' + phone;
        else if (phone.startsWith('54') && !phone.startsWith('549')) phone = '549' + phone.substring(2);

        window.location.href = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
        
        setShowCheckout(null);
        setEditingApptId(null);
        setDiscountValue(0);
        setDiscountReason('');
        setDiscountType('fixed');
        notify("Servicio finalizado y cobrado exitosamente", "success");
    }; 

    const openEditModal = (appt) => {
        if (isProfessional) return; 
        const d = new Date(appt.date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        let safeProfId = (appt.professionalId && appt.professionalId !== 'any' && appt.professionalId !== 'ALL') ? appt.professionalId : (appt.professionalId === 'any' ? 'any' : '');
        
        setForm({ 
            clientId: appt.clientId || '', 
            treatmentId: appt.treatmentId || '', 
            profId: safeProfId, 
            assistantId: appt.assistantId || '', 
            date: `${yyyy}-${mm}-${dd}`, 
            time: `${hh}:${min}`, 
            status: appt.status || 'confirmed' 
        });
        
        setEditingApptId(appt.id);
        setSelectedAppt(null); 
        setIsCreateOpen(true); 
    };

    const isSameDay = (date1, date2) => {
        const d1 = new Date(date1); const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    const hoursGrid = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

    const getStatusBadge = (status) => {
        switch(status) {
            case 'reserved': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Reserva</span>;
            case 'confirmed': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Confirmado</span>;
            case 'confirmed_paid': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Señado</span>;
            case 'completed': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Finalizado</span>;
            default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-[10px] font-bold uppercase">{status}</span>;
        }
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col bg-brand-bg overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Agenda</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {!loggedProfId ? (
                        <CustomSelect 
                            value={filterProf} 
                            onChange={(e) => setFilterProf(e.target.value)}
                            options={[
                                { value: 'all', label: '👥 Todos los Profesionales' },
                                ...professionals.map(p => ({ value: p.id, label: `👤 ${p.name}` }))
                            ]}
                            className="w-56"
                        />
                    ) : <div className="border border-[var(--color-primary)] bg-white text-[var(--color-primary)] px-3 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2"><Icon name="users" size={16}/> Mi Agenda</div>}
                    
                    {!isProfessional && (
                        <button onClick={() => setBlockModal({open:true, type:'day', date:'', time:'', profId: loggedProfId ? loggedProfId : (filterProf !== 'all' ? filterProf : '')})} className="bg-gray-800 text-white px-3 py-2 rounded-lg font-bold flex gap-2 hover:bg-black shadow-sm text-sm">
                            <Icon name="lock" size={16}/> Bloquear
                        </button>
                    )}
                    
                    {!isProfessional && (
                        <button 
                            onClick={() => { 
                                setEditingApptId(null); 
                                setForm({ clientId: '', treatmentId: '', profId: loggedProfId ? loggedProfId : (filterProf !== 'all' ? filterProf : ''), assistantId: '', date: '', time: '', status: 'confirmed' }); 
                                setIsCreateOpen(true); 
                            }} 
                            className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-4 py-2 rounded-lg font-bold flex gap-2 shadow-md text-sm"
                        >
                            <Icon name="plus" size={16}/> Nuevo
                        </button>
                    )}                
                </div>
            </header>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex justify-center items-center gap-6">
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><Icon name="chevron-left" /></button>
                <span className="font-bold text-gray-700 capitalize text-sm">Semana del {weekDays[0].toLocaleDateString('es-ES', {day: 'numeric', month: 'long'})}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><Icon name="chevron-right" /></button>
            </div>

            <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm relative">
                <div className="flex min-w-[800px]">
                    <div className="w-16 md:w-20 pt-16 border-r border-gray-200 bg-gray-50/50">
                        {hoursGrid.map(h => <div key={h} className="h-28 flex justify-center pt-2 text-xs font-bold border-b border-gray-200 text-gray-400">{h}:00</div>)}
                    </div>
                    <div className="flex-1 flex">
                        {weekDays.map((day, i) => {
                            const isHoliday = visibleAppointments.find(a => a.status === 'holiday' && isSameDay(a.date, day));
                            const dayIsWorking = isWorkingDay(filterProf, day);
                            return (
                                <div key={i} className={`flex-1 border-r border-gray-200 min-w-[120px] relative ${!dayIsWorking ? 'bg-gray-100/50' : ''}`}>
                                    <div className={`h-16 flex flex-col items-center justify-center border-b border-gray-200 sticky top-0 z-10 ${isSameDay(day, new Date()) ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-700'}`}>
                                        <span className={`text-[10px] font-bold uppercase ${isSameDay(day, new Date()) ? 'text-white/80' : 'text-gray-400'}`}>{day.toLocaleDateString('es-ES', {weekday: 'short'})}</span>
                                        <span className="font-bold text-xl leading-tight">{day.getDate()}</span>
                                    </div>
                                    {isHoliday ? (
                                        <div className="absolute inset-0 top-16 bg-gray-100/80 flex items-center justify-center z-20">
                                            <span className="font-bold text-2xl -rotate-90 text-gray-400/30 tracking-widest">FERIADO</span>
                                            
                                            {!isProfessional && (
                                                <button onClick={(e)=>{ e.stopPropagation(); setConfirmDelete({open:true, id:isHoliday.id}); }} className="absolute top-4 right-2 text-gray-400 hover:text-red-500 bg-white rounded-full p-1 shadow-sm">
                                                    <Icon name="trash-2" size={16}/>
                                                </button>
                                            )}
                                        </div>
                                    ) : !dayIsWorking ? (
                                        <div className="absolute inset-0 top-16 flex items-center justify-center pointer-events-none opacity-50 z-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 10px, #e5e7eb 10px, #e5e7eb 20px)' }}>
                                            <span className="font-bold text-xl -rotate-90 text-gray-500/40 tracking-widest">DESCANSO</span>
                                        </div>
                                    ) : null}
                                    <div className="relative h-full z-10">
                                        {hoursGrid.map(h => {
                                            const isWorking = isWorkingHour(filterProf, day, h) && dayIsWorking;
                                            
                                            const cursorClass = !isWorking ? 'bg-gray-100/60 cursor-not-allowed opacity-50' : (isProfessional ? 'cursor-default' : 'hover:bg-[var(--color-primary)]/5 cursor-pointer');

                                            return <div key={h} className={`h-28 border-b border-gray-100 ${cursorClass}`} 
                                                style={!isWorking ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)' } : {}}
                                                onClick={() => { 
                                                    if (isProfessional) return; 
                                                    if (!isWorking || isHoliday) return; 
                                                    setEditingApptId(null); 
                                                    const yyyy = day.getFullYear(); 
                                                    const mm = String(day.getMonth() + 1).padStart(2, '0'); 
                                                    const dd = String(day.getDate()).padStart(2, '0'); 
                                                    setForm({...form, date: `${yyyy}-${mm}-${dd}`, time: `${h.toString().padStart(2,'0')}:00`, status: 'confirmed', profId: loggedProfId ? loggedProfId : (filterProf !== 'all' ? filterProf : ''), assistantId: ''}); 
                                                    setIsCreateOpen(true); 
                                                }}></div>;
                                        })}
                                        {visibleAppointments.filter(a => isSameDay(a.date, day) && a.status !== 'holiday').map(appt => {
                                            const dur = getDuration(appt.treatmentId);
                                            const apptTime = new Date(appt.date);
                                            const top = ((apptTime.getHours() - 7) * 112) + (apptTime.getMinutes() * 112 / 60);
                                            const height = (dur / 60) * 112;
                                            const prof = professionals.find(p => p.id === appt.professionalId);
                                            const asis = professionals.find(p => p.id === appt.assistantId);
                                            
                                            let bgClass = "";
                                            let borderProfColor = "border-transparent";

                                            if (appt.status === 'reserved' || appt.status === 'pending_payment') bgClass = "bg-yellow-100 text-yellow-900 border-yellow-300";
                                            else if (appt.status === 'confirmed' || appt.status === 'confirmed_paid') bgClass = "bg-green-100 text-green-900 border-green-300";
                                            else if (appt.status === 'completed') bgClass = "bg-blue-100 text-blue-900 border-blue-300";
                                            else if (appt.status === 'blocked') bgClass = "bg-gray-700 text-white border-gray-800";
                                            else bgClass = "bg-gray-100 text-gray-800 border-gray-200";

                                            if (prof && prof.color) {
                                                const colorPart = prof.color.split(' ')[0].replace('bg-', '');
                                                borderProfColor = `border-l-[6px] border-l-${colorPart}`;
                                            }

                                            const clientName = appt.clientId?.startsWith('CHAT') ? appt.clientNameTemp : clients.find(c=>c.id===appt.clientId)?.name;
                                            const tr = treatments.find(t => t.id === appt.treatmentId);
                                            
                                            return <div key={appt.id} onClick={(e)=>{e.stopPropagation(); setSelectedAppt(appt)}} 
                                                className={`absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg p-2 cursor-pointer overflow-hidden flex flex-col leading-tight hover:scale-[1.02] border shadow-sm ${bgClass} ${borderProfColor}`} 
                                                style={{top:`${top}px`, height:`${height}px`, zIndex: 30}}>
                                                    
                                                    {!isProfessional && appt.status !== 'completed' && appt.status !== 'blocked' && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(appt.id, 'completed'); }}
                                                            className="absolute top-1 right-1 w-6 h-6 bg-white/50 hover:bg-white rounded-full flex items-center justify-center text-gray-800 shadow-sm"
                                                            title="Finalizar y Cobrar"
                                                        >
                                                            <Icon name="check" size={14}/>
                                                        </button>
                                                    )}

                                                    <span className="text-[11px] md:text-xs font-bold truncate pr-6">
                                                        {appt.status==='blocked' ? 'BLOQUEO' : clientName} 
                                                    </span>
                                                    {tr && dur >= 40 && <span className="text-[9px] md:text-[10px] truncate opacity-90 mt-0.5 font-medium">{tr.name}</span>}
                                                    {asis && dur >= 60 && <span className="text-[8px] truncate mt-1 opacity-70 bg-white/30 rounded px-1 w-max">Asis: {asis.name.split(' ')[0]}</span>}
                                                </div>;
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedAppt && (() => {
                const tr = treatments.find(t => t.id === selectedAppt.treatmentId);
                const prof = professionals.find(p => p.id === selectedAppt.professionalId);
                const asis = professionals.find(p => p.id === selectedAppt.assistantId);
                const clientName = selectedAppt.status==='blocked' ? 'BLOQUEO' : (selectedAppt.clientId?.startsWith('CHAT') ? selectedAppt.clientNameTemp : clients.find(c=>c.id===selectedAppt.clientId)?.name);
                const apptDate = new Date(selectedAppt.date);
                return (
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-10 rounded-[2rem] w-full max-w-md relative shadow-2xl animate-scale-in text-center">
                            <button onClick={()=>setSelectedAppt(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 p-2 rounded-full"><Icon name="x"/></button>
                            <h3 className="font-black text-2xl mb-6 text-gray-800 tracking-tight">{clientName}</h3>
                            <div className="space-y-4 mb-8 text-sm text-gray-600 font-medium text-left">
                                <p className="flex items-center justify-between">
                                    <span className="flex items-center gap-3"><Icon name="info" size={18} className="text-[var(--color-primary)]"/> Estado:</span>
                                    {getStatusBadge(selectedAppt.status)}
                                </p>
                                <p className="flex items-center gap-3 capitalize"><Icon name="calendar" size={18} className="text-[var(--color-primary)]"/> {apptDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {apptDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                {selectedAppt.status !== 'blocked' && (
                                    <>
                                        <p className="flex items-center gap-3"><Icon name="tag" size={18} className="text-[var(--color-primary)]"/> {tr ? `${tr.category} - ${tr.name}` : 'Servicio no asignado'}</p>
                                        <p className="flex items-center gap-3"><Icon name="user" size={18} className="text-[var(--color-primary)]"/> {prof ? prof.name : 'Cualquier Profesional'}</p>
                                        {asis && <p className="flex items-center gap-3 pl-8 text-xs text-gray-500 border-l-2 border-dashed ml-[9px]"><Icon name="users" size={14}/> Asiste: {asis.name}</p>}
                                    </>
                                )}
                            </div>

                            {!isProfessional && (
                                <>
                                    {selectedAppt.status !== 'completed' && selectedAppt.status !== 'blocked' && (
                                        <button 
                                            onClick={() => handleStatusChange(selectedAppt.id, 'completed')}
                                            className="w-full mb-6 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 flex items-center justify-center gap-2"
                                        >
                                            <Icon name="check-circle" size={20}/> Finalizar Servicio / Cobrar
                                        </button>
                                    )}

                                    <div className="flex gap-4">
                                        {selectedAppt.status !== 'blocked' && <button onClick={()=>openEditModal(selectedAppt)} className="flex-1 bg-white text-gray-700 border-2 border-gray-200 py-2.5 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 flex justify-center items-center gap-2 text-sm"><Icon name="pencil" size={16}/> Editar</button>}
                                        <button onClick={(e)=>{ e.stopPropagation(); setSelectedAppt(null); setConfirmDelete({open:true, id:selectedAppt.id}); }} className="flex-1 bg-red-50 text-red-600 border border-red-100 py-2.5 rounded-xl font-bold hover:bg-red-100 hover:border-red-200 flex justify-center items-center gap-2 text-sm"><Icon name="trash-2" size={16}/> Eliminar</button>
                                    </div>
                                </>
                            )}

                            {isProfessional && (
                                <button onClick={()=>setSelectedAppt(null)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm">
                                    Cerrar Detalles
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}
            
            {/* MODAL AGENDAR / EDITAR */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
                        <h3 className="font-bold text-lg mb-6 text-gray-800 flex items-center gap-2"><Icon name="calendar" className="text-[var(--color-primary)]"/> {editingApptId ? 'Editar Turno' : 'Agendar Turno'}</h3>
                        <form onSubmit={handleSave} className="space-y-4 text-left">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
                                <CustomSelect 
                                    value={form.clientId} 
                                    onChange={e=>setForm({...form, clientId:e.target.value})}
                                    options={clients.map(c => ({ value: c.id, label: c.name }))}
                                    placeholder="Seleccione cliente..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Servicio</label>
                                <CustomSelect 
                                    value={form.treatmentId} 
                                    onChange={e=>setForm({...form, treatmentId:e.target.value})}
                                    options={treatments.map(t => ({ value: t.id, label: `${t.category} - ${t.name}` }))}
                                    placeholder="Seleccione servicio..."
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Profesional Principal</label>
                                    <CustomSelect 
                                        value={form.profId} 
                                        onChange={e=>setForm({...form, profId:e.target.value})}
                                        disabled={!!loggedProfId}
                                        options={professionals.map(p => ({ value: p.id, label: p.name }))}
                                        placeholder="Seleccione profesional..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Asistente / Lavado (Opcional)</label>
                                    <CustomSelect 
                                        value={form.assistantId} 
                                        onChange={e=>setForm({...form, assistantId:e.target.value})}
                                        options={[
                                            { value: '', label: 'Nadie / No requiere' },
                                            ...professionals.filter(p => p.id !== form.profId).map(p => ({ value: p.id, label: p.name }))
                                        ]}
                                        placeholder="Seleccione asistente..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1"><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha</label><input type="date" required className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:border-[var(--color-primary)] text-sm" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
                                <div className="w-1/3"><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Hora</label><input type="time" step="300" required className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:border-[var(--color-primary)] text-sm" value={form.time} onChange={e=>setForm({...form, time:e.target.value})} /></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Estado</label>
                                <CustomSelect 
                                    value={form.status} 
                                    onChange={e=>setForm({...form, status:e.target.value})}
                                    options={[
                                        { value: 'reserved', label: '🟡 Reserva (Pendiente)' },
                                        { value: 'confirmed', label: '🟢 Confirmado' },
                                        { value: 'confirmed_paid', label: '🟢 Confirmado (Pagó seña)' },
                                        { value: 'completed', label: '🔵 Finalizar Servicio (Cobrar)' }
                                    ]}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                                <button type="button" onClick={()=>setIsCreateOpen(false)} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                                <button className="px-6 py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg font-bold hover:opacity-90 shadow-md flex items-center gap-2 text-sm"><Icon name="save" size={16}/> {editingApptId ? 'Actualizar' : 'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {blockModal.open && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
                        <h3 className="font-bold text-lg mb-5 text-gray-800 flex items-center gap-2"><Icon name="lock" className="text-gray-800"/> Bloquear Agenda</h3>
                        <form onSubmit={handleBlock} className="space-y-5 text-left">
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg"><button type="button" onClick={()=>setBlockModal({...blockModal, type:'day'})} className={`flex-1 py-2 rounded-md font-bold text-sm ${blockModal.type==='day'?'bg-white shadow-sm text-gray-800':'text-gray-500 hover:text-gray-700'}`}>Día Completo</button><button type="button" onClick={()=>setBlockModal({...blockModal, type:'slot'})} className={`flex-1 py-2 rounded-md font-bold text-sm ${blockModal.type==='slot'?'bg-white shadow-sm text-gray-800':'text-gray-500 hover:text-gray-700'}`}>Hora Específica</button></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha a bloquear</label><input type="date" required className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:border-gray-800 text-sm" value={blockModal.date} onChange={e=>setBlockModal({...blockModal, date:e.target.value})} /></div>
                            {blockModal.type === 'slot' && (<div className="animate-fade-in"><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Horario a bloquear</label><input type="time" required className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:border-gray-800 text-sm" value={blockModal.time} onChange={e=>setBlockModal({...blockModal, time:e.target.value})} /></div>)}
                            {!loggedProfId && (
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Aplicar a</label>
                                    <CustomSelect 
                                        value={blockModal.profId} 
                                        onChange={e=>setBlockModal({...blockModal, profId:e.target.value})}
                                        options={[
                                            { value: '', label: 'Todo el local (Todos los profesionales)' },
                                            ...professionals.map(p => ({ value: p.id, label: `Solo a ${p.name}` }))
                                        ]}
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-gray-100"><button type="button" onClick={()=>setBlockModal({...blockModal, open:false})} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg text-sm">Cancelar</button><button className="px-6 py-2.5 bg-gray-800 text-white rounded-lg font-bold hover:bg-black shadow-md text-sm">Confirmar Bloqueo</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {confirmDelete.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center border border-gray-200">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="alert-triangle" size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-gray-800">¿Eliminar Turno?</h3>
                        <p className="text-sm text-gray-500 mb-6">Esta acción liberará el horario y no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={()=>setConfirmDelete({open:false, id:null})} className="flex-1 py-2.5 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
                            <button onClick={()=>{saveAppointments(appointments.filter(a=>a.id!==confirmDelete.id)); setConfirmDelete({open:false, id:null}); setSelectedAppt(null); notify("Turno eliminado","success")}} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {errorModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center border border-gray-200">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="alert-circle" size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-gray-800">Horario Inválido</h3>
                        <p className="text-sm text-gray-600 mb-6">{errorModal.message}</p>
                        <button onClick={() => setErrorModal({open: false, message: ''})} className="w-full py-2.5 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900">Entendido</button>
                    </div>
                </div>
            )}

            {showCheckout && (() => {
                const tr = treatments.find(t => t.id === showCheckout.treatmentId);
                const agentStr = settings?.find(s => s.id === 'agent_config') || {};
                
                const total = parseFloat(tr?.price || 0);
                const hasDeposit = (showCheckout.status === 'confirmed_paid' || showCheckout.status === 'reserved');
                const deposit = hasDeposit ? parseFloat(agentStr.depositAmount || 0) : 0;
                const discountsEnabled = agentStr.enableDiscounts === true;

                let safeDiscount = parseFloat(discountValue) || 0;
                if (safeDiscount < 0) safeDiscount = 0;
                if (safeDiscount > total) safeDiscount = total;

                const finalAmount = total - deposit - safeDiscount;

                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                            <div className="bg-[var(--color-primary)] p-6 text-white text-center relative">
                                <button onClick={() => setShowCheckout(null)} className="absolute top-4 right-4 text-white/70 hover:text-white"><Icon name="x" size={24}/></button>
                                <Icon name="check-circle" size={48} className="mx-auto mb-2 opacity-80"/>
                                <h3 className="text-xl font-bold">Finalizar Servicio</h3>
                                <p className="opacity-90 text-sm">Registra el pago para cerrar el turno</p>
                            </div>
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left">
                                    <div className="flex justify-between mb-2"><span className="text-gray-500 text-sm">Servicio:</span><span className="font-bold text-gray-800 text-sm">{tr?.name}</span></div>
                                    <div className="flex justify-between mb-2"><span className="text-gray-500 text-sm">Valor Total:</span><span className="font-bold text-gray-800 text-sm">${total}</span></div>
                                    
                                    {hasDeposit && (<div className="flex justify-between mb-2 text-green-600 font-bold italic text-sm"><span>Seña descontada:</span><span>-${deposit}</span></div>)}
                                    
                                    {discountsEnabled && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-fade-in">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="text-[10px] font-bold text-purple-600 uppercase flex items-center gap-1">
                                                    <Icon name="tag" size={12}/> Aplicar Descuento
                                                </label>
                                                <div className="flex bg-white rounded-lg border border-purple-200 overflow-hidden shadow-sm">
                                                    <button type="button" onClick={() => { setDiscountType('fixed'); setDiscountValue(0); }} className={`px-3 py-1 text-[10px] font-bold ${discountType === 'fixed' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-purple-50'}`}>Monto ($)</button>
                                                    <button type="button" onClick={() => { setDiscountType('percentage'); setDiscountValue(0); }} className={`px-3 py-1 text-[10px] font-bold ${discountType === 'percentage' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-purple-50'}`}>Porcentaje (%)</button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mb-2">
                                                <div className="relative w-1/3 shrink-0">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{discountType === 'percentage' ? '%' : '$'}</span>
                                                    <input type="number" min="0" step={discountType === 'percentage' ? '1' : '100'} className="w-full border border-purple-200 p-2 pl-7 rounded-lg outline-none focus:ring-2 focus:ring-purple-100 font-bold text-gray-800 bg-white text-sm" placeholder="0" value={discountValue || ''} onChange={(e) => setDiscountValue(e.target.value)} />
                                                </div>
                                                <input type="text" className="flex-1 border border-purple-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-100 text-sm bg-white" placeholder="Motivo (Ej: Promo Amiga)" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} disabled={!discountValue || discountValue <= 0} />
                                            </div>
                                            {parseFloat(discountValue) > 0 && (
                                                <p className="text-[10px] text-purple-600 text-right font-bold italic animate-fade-in">
                                                    {discountType === 'percentage' ? `Ahorro calculado: -$${(total * (parseFloat(discountValue)/100)).toLocaleString()}` : `Se descontarán $${parseFloat(discountValue).toLocaleString()} del total.`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-3 border-t border-gray-200 mt-2"><span className="text-sm font-bold text-gray-800">Saldo a Cobrar:</span><span className="text-xl font-black text-[var(--color-primary)]">${finalAmount}</span></div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-3 text-left">Método de Pago</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${paymentMethod === 'cash' ? 'border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]' : 'border-gray-100 text-gray-400'}`}>
                                            <Icon name="banknote" /><span className="font-bold text-sm">Efectivo</span>
                                        </button>
                                        <button onClick={() => setPaymentMethod('transfer')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${paymentMethod === 'transfer' ? 'border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]' : 'border-gray-100 text-gray-400'}`}>
                                            <Icon name="credit-card" /><span className="font-bold text-sm">Transferencia</span>
                                        </button>
                                    </div>
                                </div>
                                <button onClick={handleCompleteCheckout} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-green-200 hover:bg-green-600 hover:scale-[1.02] flex items-center justify-center gap-2 text-sm">
                                    <Icon name="send" size={16}/> Finalizar y Saludar por WA
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
