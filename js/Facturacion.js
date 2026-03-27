// --- COMPONENTE FACTURACIÓN ---
const Billing = ({ appointments = [], clients = [], treatments = [], professionals = [], settings = [], notify, user }) => {
    
    // 1. Extraemos los componentes de Recharts de forma segura
    const Lib = window.Recharts || {};
    const { 
        LineChart, Line, BarChart, Bar, XAxis, YAxis, 
        CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
    } = Lib;
    const hasCharts = !!window.Recharts;

    // 🔥 VERIFICACIÓN DE ROL 🔥
    const isProfessional = user?.role === 'professional';

    // --- NUEVOS ESTADOS DE NAVEGACIÓN (Forzados si es profesional) ---
    const [reportMode, setReportMode] = useState(isProfessional ? 'prof' : 'local'); 
    const [selectedProf, setSelectedProf] = useState(isProfessional ? user?.profId : ''); 

    const [dateRange, setDateRange] = useState('month'); 
    const [paymentFilter, setPaymentFilter] = useState('ALL'); 
    const [searchClient, setSearchClient] = useState(''); 
    const [isGenerating, setIsGenerating] = useState(false);

    // Estados para ocultar/mostrar secciones
    const [openSections, setOpenSections] = useState({ metricas: true, graficas: true, reporte: true });
    const toggleSection = (section) => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

    const branding = settings?.find(s => s.id === 'branding') || {};
    const agentConfig = settings?.find(s => s.id === 'agent_config') || {};
    const localLogo = branding.logoBase64 || "";
    const localName = agentConfig.businessName || "Local";

    // ✅ MINI-HERRAMIENTA INTERNA ANTIFALLOS PARA LIMPIAR TELÉFONOS
    const getCleanPhone = (phoneNum) => {
        if (!phoneNum) return '';
        let cleaned = String(phoneNum).replace(/\D/g, ''); 
        if (!cleaned.startsWith('54')) {
            cleaned = '549' + cleaned;
        } else if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
            cleaned = '549' + cleaned.substring(2);
        }
        return cleaned;
    };

    // Filtro dinámico basado en el modo actual
    const activeProfFilter = reportMode === 'local' ? 'ALL' : selectedProf;

    const filteredAppointments = useMemo(() => {
        let filtered = appointments.filter(a => a.status === 'completed');
        const now = new Date();
        
        if (dateRange === 'today') filtered = filtered.filter(a => new Date(a.date).toDateString() === now.toDateString());
        else if (dateRange === 'week') {
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
            startOfWeek.setHours(0,0,0,0);
            filtered = filtered.filter(a => new Date(a.date) >= startOfWeek);
        } else if (dateRange === 'month') {
            filtered = filtered.filter(a => new Date(a.date).getMonth() === new Date().getMonth() && new Date(a.date).getFullYear() === new Date().getFullYear());
        }

        if (activeProfFilter !== 'ALL') filtered = filtered.filter(a => a.professionalId === activeProfFilter);
        if (paymentFilter !== 'ALL') filtered = filtered.filter(a => (a.paymentMethod || 'cash') === paymentFilter);
        if (searchClient.trim() !== '') {
            filtered = filtered.filter(a => {
                const client = clients.find(c => c.id === a.clientId);
                const name = client?.name || a.clientNameTemp || '';
                return name.toLowerCase().includes(searchClient.toLowerCase());
            });
        }
        return filtered.sort((a, b) => new Date(a.date) - new Date(b.date)); 
    }, [appointments, dateRange, activeProfFilter, paymentFilter, searchClient, clients]);

    // Procesamiento de datos para métricas y gráficas
    const statsData = useMemo(() => {
        let totalBruto = 0;
        let totalComisiones = 0;
        let totalDescuentos = 0;
        const dailyMap = {};
        const profMap = {};

        filteredAppointments.forEach(appt => {
            const treatment = treatments.find(t => t.id === appt.treatmentId);
            const professional = professionals.find(p => p.id === appt.professionalId);
            
            const originalPrice = Number(treatment?.price || 0);
            const discount = Number(appt.discountAmount || 0);
            const priceAfterDiscount = originalPrice - discount; 
            
            const hasComm = professional?.hasCommission === true || professional?.hasCommission === "SÍ";
            const treatmentCategory = treatment?.category || '';
            
            let rate = 0;
            let comm = 0;

            if (hasComm) {
                if (professional.commissionType === 'fixed_service') {
                    comm = Number(professional.commissionValue || 0);
                } else {
                    if (professional?.commissionRates && professional.commissionRates[treatmentCategory] !== undefined) {
                        rate = Number(professional.commissionRates[treatmentCategory]);
                    } else if (professional?.commissionRate) {
                        rate = Number(professional.commissionRate);
                    }
                    comm = priceAfterDiscount * (rate / 100);
                }
            }
            
            const asisComm = Number(appt.assistantCommission || 0);
            const totalEgresosTurno = comm + asisComm;
            const gananciaLocal = priceAfterDiscount - totalEgresosTurno;

            totalBruto += priceAfterDiscount;
            totalComisiones += totalEgresosTurno; 
            totalDescuentos += discount;

            const dateKey = new Date(appt.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            if (!dailyMap[dateKey]) dailyMap[dateKey] = { day: dateKey, bruto: 0, neto: 0 };
            dailyMap[dateKey].bruto += priceAfterDiscount;
            dailyMap[dateKey].neto += gananciaLocal;

            const pName = professional?.name || 'Sin Asignar';
            if (!profMap[pName]) profMap[pName] = { name: pName, valor: 0 };
            profMap[pName].valor += gananciaLocal;
        });

        return {
            totalBruto,
            totalComisiones,
            totalDescuentos,
            netoLocal: totalBruto - totalComisiones,
            chartTimeline: Object.values(dailyMap),
            chartProfs: Object.values(profMap)
        };
    }, [filteredAppointments, treatments, professionals]);

    // GENERADOR DE PDF BLINDADO PARA DESCARGA
    const handleDownloadPDF = () => {
        if (reportMode === 'prof' && !selectedProf) {
            return notify("Selecciona un profesional primero", "warning");
        }

        const tryGenerate = () => {
            const element = document.getElementById('report-area');
            if (!element) {
                setOpenSections(prev => ({ ...prev, reporte: true }));
                setTimeout(tryGenerate, 300);
                return;
            }

            setIsGenerating(true);
            notify("Generando documento PDF...", "info");
            
            const fileName = reportMode === 'local' 
                ? `Caja_Local_${new Date().toLocaleDateString('es-ES').replace(/\//g,'-')}.pdf`
                : `Liquidacion_${professionals.find(p=>p.id===selectedProf)?.name.replace(/\s+/g,'_')}.pdf`;

            const opt = {
                margin:       10,
                filename:     fileName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false }, 
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            window.html2pdf().set(opt).from(element).save().then(() => {
                setIsGenerating(false);
                notify("PDF descargado correctamente", "success");
            }).catch(err => {
                console.error(err);
                setIsGenerating(false);
                notify("Error al generar el PDF. Intenta de nuevo.", "error");
            });
        };
        
        tryGenerate();
    };

    // ENVÍO POR WHATSAPP (CORRECCIÓN DE PAYLOAD Y ADMIN EMAIL)
    const handleSendWhatsApp = () => {
        if (!selectedProf) return notify("Selecciona un profesional", "warning");
        
        const prof = professionals.find(p => p.id === selectedProf);
        if (!prof?.phone) return notify("No tienes un teléfono guardado para este profesional.", "error");
        
        // Buscamos el correo maestro del local
        const adminEmailToUse = user?.adminEmail || user?.email || localStorage.getItem('adminEmail') || '';
        
        if (!adminEmailToUse) return notify("Error: No se encontró el identificador del local.", "error");

        const tryUpload = () => {
            const element = document.getElementById('report-area');
            if (!element) {
                setOpenSections(prev => ({ ...prev, reporte: true }));
                setTimeout(tryUpload, 300);
                return;
            }

            setIsGenerating(true);
            notify("Generando y subiendo PDF a la nube...", "info");
            
            const profNameClean = prof.name.toUpperCase().replace(/\s+/g, '_');
            const timeStamp = new Date().toISOString().split('T')[0];
            const customFileName = `LIQUIDACION_${profNameClean}_${timeStamp}.pdf`;

            // ✅ REDUCIMOS SCALE A 1 PARA EVITAR ERRORES DE PESO EN APPS SCRIPT
            const opt = {
                margin:       10,
                filename:     customFileName,
                image:        { type: 'jpeg', quality: 0.95 },
                html2canvas:  { scale: 1, useCORS: true, logging: false }, 
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            window.html2pdf().set(opt).from(element).output('datauristring').then((pdfData) => {
                if (!pdfData) {
                    setIsGenerating(false);
                    return notify("Error al convertir PDF", "error");
                }

                google.script.run
                    .withSuccessHandler((res) => {
                        setIsGenerating(false);
                        if (res && res.success) {
                            notify("¡PDF subido y listo para enviar!", "success");
                            
                            const cleanPhone = getCleanPhone(prof.phone);
                            const total = statsData.totalComisiones || 0;
                            const message = "¡Hola *" + prof.name + "*! 👋 \n\nTe envío el detalle de tu liquidación generada hoy.\n\n💰 *Total a cobrar: $" + total.toLocaleString() + "*\n\n📄 *Ver o Descargar PDF:* " + res.url;
                            
                            // Abrimos WhatsApp de forma directa (nativo)
                            window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
                        } else { 
                            notify("Error del servidor: " + (res?.message || "Desconocido"), "error"); 
                        }
                    })
                    .withFailureHandler((err) => {
                        console.error(err);
                        setIsGenerating(false);
                        notify("Error de conexión al subir el archivo. El reporte puede ser muy pesado.", "error");
                    })
                    .uploadReceiptToDrive(adminEmailToUse, pdfData, customFileName);

            }).catch(err => {
                console.error(err);
                setIsGenerating(false);
                notify("Error al procesar el PDF", "error");
            });
        };
        
        tryUpload();
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-full overflow-y-auto custom-scrollbar">
            
            <header className="mb-6 print:hidden">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    {isProfessional ? 'Mi Facturación' : 'Caja y Liquidaciones'}
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                    {isProfessional ? 'Revisa tus servicios realizados y comisiones.' : 'Control de ingresos, comisiones y rentabilidad.'}
                </p>

                {!isProfessional && (
                    <div className="flex bg-gray-200 p-1 rounded-xl w-full max-w-md">
                        <button 
                            onClick={() => { setReportMode('local'); setSelectedProf(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${reportMode === 'local' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Icon name="store" size={16}/> Caja del Local
                        </button>
                        <button 
                            onClick={() => { setReportMode('prof'); if(professionals.length > 0) setSelectedProf(professionals[0].id); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${reportMode === 'prof' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Icon name="users" size={16}/> Liquidar Profesionales
                        </button>
                    </div>
                )}
            </header>

            {/* 1. SECCIÓN DE CONTROLES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 p-6 animate-fade-in print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Período</label>
                        <CustomSelect 
                            value={dateRange} 
                            onChange={e => setDateRange(e.target.value)}
                            options={[
                                { value: 'today', label: 'Hoy' },
                                { value: 'week', label: 'Esta Semana' },
                                { value: 'month', label: 'Este Mes' },
                                { value: 'all', label: 'Histórico Total' }
                            ]}
                        />
                    </div>

                    {reportMode === 'local' ? (
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Buscar Cliente</label>
                            <input type="text" placeholder="Nombre..." className="w-full border border-gray-300 p-2.5 rounded-lg text-sm flex justify-between items-center outline-none focus:border-[var(--color-primary)]" value={searchClient} onChange={e => setSearchClient(e.target.value)}/>
                        </div>
                    ) : (
                        <div className="md:col-span-2 border border-blue-200 bg-blue-50/50 p-2 -mt-2 rounded-xl">
                            <label className="text-[10px] font-bold uppercase text-blue-600 mb-1 block px-1">
                                {isProfessional ? 'Profesional' : 'Seleccionar Profesional a Liquidar'}
                            </label>
                            {isProfessional ? (
                                <div className="w-full p-2 font-bold text-blue-900 bg-blue-50 rounded-lg">
                                    <Icon name="user" size={14} className="inline mr-2" />
                                    {professionals.find(p=>p.id === user?.profId)?.name || 'Mi Perfil'}
                                </div>
                            ) : (
                                <CustomSelect 
                                    value={selectedProf} 
                                    onChange={e => setSelectedProf(e.target.value)}
                                    options={professionals.length === 0 ? [{ value: '', label: 'Sin profesionales...' }] : professionals.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="Seleccione profesional..."
                                />
                            )}
                        </div>
                    )}

                    <div className={reportMode === 'prof' ? 'hidden md:block' : ''}>
                        <label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Medio de Pago</label>
                        <CustomSelect 
                            value={paymentFilter} 
                            onChange={e => setPaymentFilter(e.target.value)}
                            options={[
                                { value: 'ALL', label: 'Todos' },
                                { value: 'cash', label: 'Efectivo' },
                                { value: 'transfer', label: 'Transferencia' }
                            ]}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-100 justify-end">
                    {reportMode === 'prof' && selectedProf && !isProfessional && (
                        <button onClick={handleSendWhatsApp} className="px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-500/20 bg-[#25D366] text-white hover:bg-green-600 hover:-translate-y-0.5 transition-all text-sm">
                            <Icon name="message-circle" size={18}/> Enviar Liquidación por WhatsApp
                        </button>
                    )}
                    
                    <button onClick={handleDownloadPDF} disabled={isGenerating} className="px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-sm">
                        <Icon name={isGenerating ? "loader" : "file-text"} className={isGenerating ? "animate-spin" : "text-red-500"} size={18}/>
                        {isGenerating ? "Generando..." : "Descargar PDF"}
                    </button>
                </div>
            </div>

            {/* 2. TARJETAS DE MÉTRICAS CON HEADER OCULTABLE */}
            <div className="mb-6 animate-fade-in print:hidden">
                <button onClick={() => toggleSection('metricas')} className="flex items-center gap-2 mb-3 text-gray-600 hover:text-gray-900 transition-colors w-full text-left outline-none group">
                    <h3 className="font-bold text-base flex-1">Resumen Financiero</h3>
                    <Icon name={openSections.metricas ? 'chevron-up' : 'chevron-down'} size={18} className="text-gray-400 group-hover:text-gray-600"/>
                </button>
                
                {openSections.metricas && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {reportMode === 'local' ? (
                            <>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ingreso Bruto Total</p>
                                    <p className="text-xl font-black text-gray-900">${statsData.totalBruto.toLocaleString()}</p>
                                    {statsData.totalDescuentos > 0 && <span className="absolute top-6 right-6 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">-{statsData.totalDescuentos} en Promos</span>}
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
                                    <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Comisiones Totales (Egresos)</p>
                                    <p className="text-xl font-black text-red-500">-${statsData.totalComisiones.toLocaleString()}</p>
                                </div>
                                <div className="bg-green-50 p-6 rounded-2xl border-2 border-green-200 shadow-md">
                                    <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Ganancia Neta Local</p>
                                    <p className="text-2xl font-black text-green-700">${statsData.netoLocal.toLocaleString()}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Producción Bruta</p>
                                    <p className="text-xl font-black text-gray-900">${statsData.totalBruto.toLocaleString()}</p>
                                </div>
                                <div className="bg-blue-50 md:col-span-2 p-6 rounded-2xl border-2 border-blue-200 shadow-md">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">
                                        {isProfessional ? 'Tus Ganancias' : 'Total a Pagar (Comisión Neta)'}
                                    </p>
                                    <p className="text-2xl font-black text-blue-700">${statsData.totalComisiones.toLocaleString()}</p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* 3. GRÁFICAS DE EVOLUCIÓN (Ocultables) */}
            {reportMode === 'local' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden transition-all print:hidden">
                    <button onClick={() => toggleSection('graficas')} className="w-full p-4 border-b border-gray-50 flex justify-between items-center hover:bg-gray-50 transition-colors outline-none">
                        <span className="font-bold text-base text-gray-700 flex items-center gap-2">
                            <Icon name="bar-chart-2" size={18} className="text-blue-500"/> Análisis de Evolución
                        </span>
                        <Icon name={openSections.graficas ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>
                    
                    {openSections.graficas && (
                        <div className="p-6 animate-fade-in">
                            {!hasCharts ? (
                                <div className="p-10 text-center bg-gray-50 rounded-xl border border-dashed flex flex-col items-center">
                                    <Icon name="loader" size={32} className="animate-spin text-gray-300 mb-2"/>
                                    <p className="text-gray-500 text-sm">Preparando estadísticas...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="h-64 w-full">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 text-center tracking-widest">Evolución de Ganancias</p>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={statsData.chartTimeline}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} itemStyle={{fontSize: '12px', fontWeight: 'bold'}}/>
                                                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                                                <Line type="monotone" dataKey="bruto" name="Ingreso Bruto" stroke="var(--color-primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--color-primary)'}} activeDot={{r: 6}} />
                                                <Line type="monotone" dataKey="neto" name="Ganancia Local" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="h-64 w-full">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 text-center tracking-widest">Rendimiento por Profesional</p>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={statsData.chartProfs}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                                <Bar dataKey="valor" name="Ganancia Neta" radius={[10, 10, 0, 0]}>
                                                    {statsData.chartProfs.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-primary)' : '#3b82f6'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 4. REPORTE DETALLADO PARA PDF (Ocultable) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all">
                <button onClick={() => toggleSection('reporte')} className="w-full p-4 flex justify-between items-center border-b border-gray-50 print:hidden hover:bg-gray-50 transition-colors outline-none">
                    <span className="font-bold text-base text-gray-700 flex items-center gap-2"><Icon name="list" size={18} className={reportMode === 'local' ? 'text-[var(--color-primary)]' : 'text-blue-500'}/> Detalle de Operaciones</span>
                    <Icon name={openSections.reporte ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                </button>
                
                {openSections.reporte && (
                    <div id="report-area" className="p-8 md:p-12 bg-white animate-fade-in">
                        <div className="flex justify-between items-start border-b border-gray-100 pb-10 mb-10">
                            <div className="flex items-center gap-6">
                                <div className="hidden print-logo w-14 h-14 bg-gray-800 text-white rounded-xl items-center justify-center font-black text-2xl" data-html2canvas-ignore="false" style={{ display: 'none' }}>
                                    {localName.charAt(0)}
                                </div>
                                {localLogo && (
                                    <img src={localLogo} className="h-16 w-auto object-contain screen-logo" data-html2canvas-ignore="true" alt="Logo" />
                                )}
                                {!localLogo && (
                                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 text-2xl">{localName.charAt(0)}</div>
                                )}

                                <div>
                                    <h1 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                                        {reportMode === 'local' ? 'Reporte General de Caja' : 'Liquidación Profesional'}
                                    </h1>
                                    <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-[0.2em]">
                                        {reportMode === 'local' ? localName : professionals.find(p=>p.id===selectedProf)?.name}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Generado</p>
                                <p className="font-bold text-gray-900 text-xs">{new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'})}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[11px] uppercase text-gray-400 font-bold border-b border-gray-200">
                                        <th className="pb-4 px-2">Fecha / Hora</th>
                                        <th className="pb-4 px-2">Cliente / Servicio</th>
                                        <th className="pb-4 px-2 text-center">Promo</th>
                                        <th className="pb-4 px-2 text-right">Monto Bruto</th>
                                        
                                        {reportMode === 'local' ? (
                                            <>
                                                <th className="pb-4 px-2 text-right text-red-400">Total Egresos</th>
                                                <th className="pb-4 px-2 text-right text-green-600">Neto Local</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="pb-4 px-2 text-right text-gray-800">Detalle</th>
                                                <th className="pb-4 px-2 text-right text-gray-800">Ganancia</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.length === 0 ? (
                                        <tr><td colSpan="7" className="py-10 text-center text-gray-300 italic text-sm">No hay operaciones en este período.</td></tr>
                                    ) : (
                                        filteredAppointments.map(appt => {
                                            const treatment = treatments.find(t => t.id === appt.treatmentId);
                                            const client = clients.find(c => c.id === appt.clientId);
                                            const professional = professionals.find(p => p.id === appt.professionalId);
                                            
                                            const originalPrice = Number(treatment?.price || 0);
                                            const discount = Number(appt.discountAmount || 0);
                                            const finalPrice = originalPrice - discount;

                                            const hasComm = professional?.hasCommission === true || professional?.hasCommission === "SÍ";
                                            const treatmentCategory = treatment?.category || '';
                                            let rate = 0;
                                            let comm = 0;
                                            if (hasComm) {
                                                if (professional.commissionType === 'fixed_service') {
                                                    comm = Number(professional.commissionValue || 0);
                                                } else {
                                                    if (professional?.commissionRates && professional.commissionRates[treatmentCategory] !== undefined) rate = Number(professional.commissionRates[treatmentCategory]);
                                                    else if (professional?.commissionRate) rate = Number(professional.commissionRate);
                                                    comm = finalPrice * (rate / 100);
                                                }
                                            }
                                            
                                            const asisComm = Number(appt.assistantCommission || 0);
                                            const totalEgresosTurno = comm + asisComm;

                                            return (
                                                <tr key={appt.id} className="text-sm border-b border-gray-50">
                                                    <td className="py-4 px-2 text-gray-600 tabular-nums">
                                                        {new Date(appt.date).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'})}<br/>
                                                        <span className="text-[10px] text-gray-400">{new Date(appt.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})} hs</span>
                                                    </td>
                                                    <td className="py-4 px-2">
                                                        <p className="font-bold text-gray-900">{client?.name || appt.clientNameTemp || 'Consumidor'}</p>
                                                        <p className="text-[10px] text-gray-500">
                                                            {treatment?.name || 'Servicio'} 
                                                            {reportMode === 'local' && <span className="font-medium text-blue-500 ml-1">({professional?.name || 'Sin asignar'})</span>}
                                                            {reportMode === 'local' && appt.assistantId && <span className="text-gray-400 italic ml-1"> + Asistente</span>}
                                                        </p>
                                                        <span className="text-[9px] font-bold uppercase text-gray-400 mt-1 inline-block">
                                                            {appt.paymentMethod === 'transfer' ? 'Transf.' : 'Efectivo'}
                                                        </span>
                                                    </td>

                                                    <td className="py-4 px-2 text-center">
                                                        {discount > 0 ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <span className="text-[10px] font-bold uppercase text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">-${discount}</span>
                                                                {appt.discountReason && <span className="text-[8px] text-purple-400 max-w-[80px] truncate" title={appt.discountReason}>{appt.discountReason}</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>

                                                    <td className="py-4 px-2 text-right">
                                                        {discount > 0 && <span className="text-xs text-gray-400 line-through block">${originalPrice}</span>}
                                                        <span className="font-bold text-gray-900">${finalPrice.toLocaleString()}</span>
                                                    </td>
                                                    
                                                    {reportMode === 'local' ? (
                                                        <>
                                                            <td className="py-4 px-2 text-right text-red-400">-${totalEgresosTurno.toLocaleString()}</td>
                                                            <td className="py-4 px-2 text-right font-black text-green-700">${(finalPrice - totalEgresosTurno).toLocaleString()}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="py-4 px-2 text-right text-gray-600 font-medium text-xs">
                                                                {professional.commissionType === 'fixed_service' ? 'Monto Fijo' : `${rate}%`}
                                                            </td>
                                                            <td className="py-4 px-2 text-right font-black text-gray-900">${comm.toLocaleString()}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-900">
                                        <td colSpan="4" className="py-6 text-right font-bold uppercase text-gray-500 text-[10px]">
                                            {reportMode === 'local' ? 'Utilidad Final del Período:' : (isProfessional ? 'Tus Ganancias Totales:' : 'Total a Liquidar (Comisiones):')}
                                        </td>
                                        {reportMode === 'local' ? (
                                            <>
                                                <td className="py-6 text-right text-sm font-bold text-red-400">-${statsData.totalComisiones.toLocaleString()}</td>
                                                <td className="py-6 text-right text-xl font-black text-green-700">${statsData.netoLocal.toLocaleString()}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-6"></td>
                                                <td className="py-6 text-right text-xl font-black text-blue-700">${statsData.totalComisiones.toLocaleString()}</td>
                                            </>
                                        )}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @media print { .screen-logo { display: none !important; } .print-logo { display: flex !important; } }
            `}} />
        </div>
    );
};
