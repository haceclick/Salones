// Obtenemos Recharts de forma segura (si no existe, devuelve un objeto vacío para que no explote)
const Recharts = window.Recharts || {};
const { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } = Recharts;

const Billing = ({ appointments = [], clients = [], treatments = [], professionals = [], settings = [], notify, user }) => {
    
    // 1. Extraemos los componentes de forma segura AQUÍ ADENTRO
    const Lib = window.Recharts || {};
    const { 
        LineChart, Line, BarChart, Bar, XAxis, YAxis, 
        CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
    } = Lib;

    // 2. Verificación de seguridad rápida
    const hasCharts = !!window.Recharts;
    const [dateRange, setDateRange] = useState('month'); 
    const [profFilter, setProfFilter] = useState('ALL');
    const [paymentFilter, setPaymentFilter] = useState('ALL'); 
    const [searchClient, setSearchClient] = useState(''); 
    const [isGenerating, setIsGenerating] = useState(false);

    // Estados para ocultar/mostrar secciones
    const [openSections, setOpenSections] = useState({
        filtros: true,
        metricas: true,
        graficas: true,
        reporte: true
    });

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const branding = settings?.find(s => s.id === 'branding') || {};
    const localLogo = branding.logoBase64 || "";

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

        if (profFilter !== 'ALL') filtered = filtered.filter(a => a.professionalId === profFilter);
        if (paymentFilter !== 'ALL') filtered = filtered.filter(a => (a.paymentMethod || 'cash') === paymentFilter);
        if (searchClient.trim() !== '') {
            filtered = filtered.filter(a => {
                const client = clients.find(c => c.id === a.clientId);
                const name = client?.name || a.clientNameTemp || '';
                return name.toLowerCase().includes(searchClient.toLowerCase());
            });
        }
        return filtered.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort ascendente para gráficas
    }, [appointments, dateRange, profFilter, paymentFilter, searchClient, clients]);

    // Procesamiento de datos para métricas y gráficas
    const statsData = useMemo(() => {
        let totalBruto = 0;
        let totalComisiones = 0;
        const dailyMap = {};
        const profMap = {};

        filteredAppointments.forEach(appt => {
            const treatment = treatments.find(t => t.id === appt.treatmentId);
            const professional = professionals.find(p => p.id === appt.professionalId);
            const price = Number(appt.finalAmount || treatment?.price || 0);
            
            // Lógica de Comisión
            const hasComm = professional?.hasCommission === true || professional?.hasCommission === "SÍ";
            const treatmentCategory = treatment?.category || '';
            let rate = 0;
            if (hasComm) {
                if (professional?.commissionRates && professional.commissionRates[treatmentCategory] !== undefined) {
                    rate = Number(professional.commissionRates[treatmentCategory]);
                } else if (professional?.commissionRate) {
                    rate = Number(professional.commissionRate);
                }
            }
            const comm = price * (rate / 100);
            const gananciaLocal = price - comm;

            totalBruto += price;
            totalComisiones += comm;

            // Datos para gráfica de evolución (por día)
            const dateKey = new Date(appt.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            if (!dailyMap[dateKey]) dailyMap[dateKey] = { day: dateKey, bruto: 0, neto: 0 };
            dailyMap[dateKey].bruto += price;
            dailyMap[dateKey].neto += gananciaLocal;

            // Datos para gráfica por profesional
            const pName = professional?.name || 'Sin Asignar';
            if (!profMap[pName]) profMap[pName] = { name: pName, valor: 0 };
            profMap[pName].valor += gananciaLocal;
        });

        return {
            totalBruto,
            totalComisiones,
            netoLocal: totalBruto - totalComisiones,
            chartTimeline: Object.values(dailyMap),
            chartProfs: Object.values(profMap)
        };
    }, [filteredAppointments, treatments, professionals]);

    const handleSendReceipt = () => {
        if (!user || !user.email) return notify("Error: Usuario no identificado", "error");
        setIsGenerating(true);
        google.script.run.withSuccessHandler((base64Logo) => {
            const logoImg = document.querySelector('#report-area img');
            if (logoImg && base64Logo) logoImg.src = base64Logo;
            setTimeout(() => {
                const element = document.getElementById('report-area');
                window.html2pdf().from(element).save();
                setIsGenerating(false);
            }, 500);
        }).getLogoAsBase64(user.email);
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-full overflow-y-auto custom-scrollbar">
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Caja y Liquidaciones</h2>
                    <p className="text-gray-500 text-sm">Control de ingresos, comisiones y rentabilidad.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSendReceipt} disabled={isGenerating} className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all">
                        <Icon name={isGenerating ? "loader" : "file-text"} className={isGenerating ? "animate-spin" : ""}/>
                        {isGenerating ? "Generando..." : "Descargar PDF"}
                    </button>
                    <button onClick={() => window.print()} className="bg-[var(--color-primary)] text-[var(--color-primary-text)] p-3 rounded-xl shadow-md"><Icon name="printer" size={18}/></button>
                </div>
            </header>

            {/* 1. SECCIÓN FILTROS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden transition-all">
                <button onClick={() => toggleSection('filtros')} className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <span className="font-bold text-gray-700 flex items-center gap-2"><Icon name="filter" size={18} className="text-[var(--color-primary)]"/> Filtros de Búsqueda</span>
                    <Icon name={openSections.filtros ? "chevron-up" : "chevron-down"} size={18} className="text-gray-400"/>
                </button>
                {openSections.filtros && (
                    <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                        <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Período</label>
                            <select className="w-full border border-gray-200 p-2.5 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={dateRange} onChange={e => setDateRange(e.target.value)}><option value="today">Hoy</option><option value="week">Semana</option><option value="month">Mes</option><option value="all">Todo</option></select>
                        </div>
                        <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Profesional</label>
                            <select className="w-full border border-gray-200 p-2.5 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={profFilter} onChange={e => setProfFilter(e.target.value)}><option value="ALL">Todos</option>{professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                        </div>
                        <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Medio de Pago</label>
                            <select className="w-full border border-gray-200 p-2.5 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="ALL">Todos</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select>
                        </div>
                        <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Buscar Cliente</label>
                            <input type="text" placeholder="Nombre..." className="w-full border border-gray-200 p-2.5 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={searchClient} onChange={e => setSearchClient(e.target.value)}/>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. TARJETAS DE MÉTRICAS */}
            <div className="mb-6 overflow-hidden transition-all">
                <button onClick={() => toggleSection('metricas')} className="w-full p-2 mb-2 flex justify-between items-center text-gray-500 hover:text-gray-800 transition-colors">
                    <span className="text-xs font-bold uppercase tracking-widest">Resumen Financiero</span>
                    <Icon name={openSections.metricas ? "eye-off" : "eye"} size={16}/>
                </button>
                {openSections.metricas && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ingreso Bruto</p>
                            <p className="text-2xl font-black text-gray-900">${statsData.totalBruto.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Comisiones a Pagar</p>
                            <p className="text-2xl font-black text-red-500">-${statsData.totalComisiones.toLocaleString()}</p>
                        </div>
                        <div className="bg-green-50 p-6 rounded-2xl border-2 border-green-200 shadow-md transform hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Ganancia Neta Local</p>
                            <p className="text-3xl font-black text-green-700">${statsData.netoLocal.toLocaleString()}</p>
                            <div className="mt-2 h-1 w-full bg-green-200 rounded-full overflow-hidden">
                                <div className="h-full bg-green-600" style={{ width: `${(statsData.netoLocal / statsData.totalBruto * 100) || 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. GRÁFICAS DE EVOLUCIÓN (REVISADO Y BLINDADO) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden transition-all">
                <button onClick={() => toggleSection('graficas')} className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <span className="font-bold text-gray-700 flex items-center gap-2">
                        <Icon name="bar-chart-2" size={18} className="text-blue-500"/> 
                        Análisis de Evolución
                    </span>
                    <Icon name={openSections.graficas ? "chevron-up" : "chevron-down"} size={18} className="text-gray-400"/>
                </button>
                
                {openSections.graficas && (
                    <div className="p-6 animate-fade-in">
                        {/* ✅ Usamos hasCharts que es la constante definida arriba */}
                        {!hasCharts ? (
                            <div className="p-10 text-center bg-gray-50 rounded-xl border border-dashed flex flex-col items-center">
                                <Icon name="loader" size={32} className="animate-spin text-gray-300 mb-2"/>
                                <p className="text-gray-500 text-sm">Preparando motor de estadísticas...</p>
                                <p className="text-[10px] text-gray-400 mt-1 italic">Si esto demora, verifica tu conexión a internet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Gráfica 1: Evolución Temporal */}
                                <div className="h-64 w-full">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 text-center tracking-widest">
                                        Evolución de Ganancias (Bruto vs Neto)
                                    </p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={statsData.chartTimeline}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                                                itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                                            <Line type="monotone" dataKey="bruto" name="Ingreso Bruto" stroke="var(--color-primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--color-primary)'}} activeDot={{r: 6}} />
                                            <Line type="monotone" dataKey="neto" name="Ganancia Local" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
            
                                {/* Gráfica 2: Rendimiento por Profesional */}
                                <div className="h-64 w-full">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 text-center tracking-widest">
                                        Rendimiento Neto por Profesional
                                    </p>
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

            {/* 4. REPORTE DETALLADO */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all">
                <button onClick={() => toggleSection('reporte')} className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <span className="font-bold text-gray-700 flex items-center gap-2"><Icon name="list" size={18} className="text-orange-500"/> Detalle de Operaciones</span>
                    <Icon name={openSections.reporte ? "chevron-up" : "chevron-down"} size={18} className="text-gray-400"/>
                </button>
                {openSections.reporte && (
                    <div id="report-area" className="p-8 md:p-12 animate-fade-in bg-white">
                        <div className="flex justify-between items-start border-b border-gray-100 pb-10 mb-10">
                             <div className="flex items-center gap-6">
                                {localLogo ? <img src={localLogo} className="h-16 w-auto object-contain" /> : <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400">S</div>}
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                                        {profFilter === 'ALL' ? 'Reporte General de Caja' : 'Liquidación Profesional'}
                                    </h1>
                                    <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-[0.2em]">
                                        {profFilter === 'ALL' ? 'Administración Local' : professionals.find(p=>p.id===profFilter)?.name}
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
                                        <th className="pb-4 px-2">Medio</th>
                                        <th className="pb-4 px-2 text-right">Cobrado</th>
                                        
                                        {/* COLUMNAS CONDICIONALES */}
                                        {profFilter === 'ALL' ? (
                                            <>
                                                <th className="pb-4 px-2 text-right text-red-400">Comisión</th>
                                                <th className="pb-4 px-2 text-right text-green-600">Neto Local</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="pb-4 px-2 text-right text-gray-800">Com. %</th>
                                                <th className="pb-4 px-2 text-right text-gray-800">Com. $</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.length === 0 ? (
                                        <tr><td colSpan="6" className="py-10 text-center text-gray-300 italic text-sm">No hay registros para mostrar.</td></tr>
                                    ) : (
                                        filteredAppointments.map(appt => {
                                            const treatment = treatments.find(t => t.id === appt.treatmentId);
                                            const client = clients.find(c => c.id === appt.clientId);
                                            const price = Number(appt.finalAmount || treatment?.price || 0);
                                            const professional = professionals.find(p => p.id === appt.professionalId);
                                            
                                            // Cálculo de comisión
                                            const hasComm = professional?.hasCommission === true || professional?.hasCommission === "SÍ";
                                            const treatmentCategory = treatment?.category || '';
                                            let rate = 0;
                                            if (hasComm) {
                                                if (professional?.commissionRates && professional.commissionRates[treatmentCategory] !== undefined) rate = Number(professional.commissionRates[treatmentCategory]);
                                                else if (professional?.commissionRate) rate = Number(professional.commissionRate);
                                            }
                                            const comm = price * (rate / 100);

                                            return (
                                                <tr key={appt.id} className="text-sm border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-4 px-2 text-gray-600 tabular-nums">
                                                        {new Date(appt.date).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'})}<br/>
                                                        <span className="text-[10px] text-gray-400">{new Date(appt.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})} hs</span>
                                                    </td>
                                                    <td className="py-4 px-2">
                                                        <p className="font-bold text-gray-900">{client?.name || appt.clientNameTemp || 'Consumidor'}</p>
                                                        <p className="text-[10px] text-gray-500">
                                                            {treatment?.name || 'Servicio'} 
                                                            {/* Si estamos en "Todos", mostramos quién hizo el servicio */}
                                                            {profFilter === 'ALL' && <span className="font-medium text-blue-500 ml-1">({professional?.name || 'Sin asignar'})</span>}
                                                        </p>
                                                    </td>
                                                    <td className="py-4 px-2">
                                                        <span className="text-[9px] font-bold uppercase text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                            {appt.paymentMethod === 'transfer' ? 'Transf.' : 'Efectivo'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-2 text-right font-medium text-gray-900">${price.toLocaleString()}</td>
                                                    
                                                    {/* CELDAS CONDICIONALES */}
                                                    {profFilter === 'ALL' ? (
                                                        <>
                                                            <td className="py-4 px-2 text-right text-red-400">-${comm.toLocaleString()}</td>
                                                            <td className="py-4 px-2 text-right font-black text-green-700">${(price - comm).toLocaleString()}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="py-4 px-2 text-right text-gray-600 font-medium">{rate}%</td>
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
                                            {profFilter === 'ALL' ? 'Utilidad Final del Período:' : 'Total a Liquidar (Comisiones):'}
                                        </td>
                                        
                                        {/* PIE DE TABLA CONDICIONAL */}
                                        {profFilter === 'ALL' ? (
                                            <>
                                                <td className="py-6 text-right text-sm font-bold text-red-400">-${statsData.totalComisiones.toLocaleString()}</td>
                                                <td className="py-6 text-right text-2xl font-black text-green-700">${statsData.netoLocal.toLocaleString()}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-6"></td>
                                                <td className="py-6 text-right text-2xl font-black text-gray-900">${statsData.totalComisiones.toLocaleString()}</td>
                                            </>
                                        )}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
