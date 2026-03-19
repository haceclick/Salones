// --- COMPONENTE FACTURACIÓN (DISEÑO BLANCO PURO + WHATSAPP NATIVO) ---
const Billing = ({ appointments = [], clients = [], treatments = [], professionals = [], settings = [], notify, user }) => {
    const [dateRange, setDateRange] = useState('month'); 
    const [profFilter, setProfFilter] = useState('ALL');
    const [paymentFilter, setPaymentFilter] = useState('ALL'); 
    const [searchClient, setSearchClient] = useState(''); 
    const [isGenerating, setIsGenerating] = useState(false);

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
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [appointments, dateRange, profFilter, paymentFilter, searchClient, clients]);

    let totalFacturado = 0;
    let totalComisiones = 0;

    const tableData = filteredAppointments.map(appt => {
        const client = clients.find(c => c.id === appt.clientId);
        const treatment = treatments.find(t => t.id === appt.treatmentId);
        const professional = professionals.find(p => p.id === appt.professionalId);
        const price = Number(treatment?.price || 0);
        const collectedAmount = Number(appt.finalAmount || price); 
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
        const commissionAmount = hasComm ? (price * (rate / 100)) : 0;
        totalFacturado += price;
        totalComisiones += commissionAmount;

        return { 
            id: appt.id, date: appt.date,
            clientName: client?.name || (appt.clientId?.startsWith('CHAT') ? appt.clientNameTemp : 'Consumidor Final'),
            treatmentName: treatment?.name || 'Servicio',
            profName: professional?.name || 'Sin Asignar',
            paymentMethod: appt.paymentMethod || 'cash',
            price, collectedAmount, rate, commissionAmount 
        };
    });

    const handleSendReceipt = () => {
        if (!user || !user.email) return notify("Error: Usuario no identificado", "error");
        setIsGenerating(true);

        google.script.run
            .withSuccessHandler((base64Logo) => {
                const logoImg = document.querySelector('#report-area img');
                if (logoImg && base64Logo) logoImg.src = base64Logo;

                setTimeout(() => {
                    const element = document.getElementById('report-area');
                    const opt = {
                        margin: 10,
                        filename: 'temp.pdf',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    window.html2pdf().set(opt).from(element).output('datauristring').then((pdfData) => {
                        if (!pdfData) { setIsGenerating(false); return notify("Error al generar PDF", "error"); }
                        
                        const prof = professionals.find(p => p.id === profFilter);
                        const profNameClean = prof ? prof.name.toUpperCase().replace(/\s+/g, '_') : 'GENERAL';
                        const timeStamp = new Date().toISOString().split('T')[0];
                        const customFileName = `LIQUIDACION_${profNameClean}_${timeStamp}.pdf`;

                        google.script.run
                            .withSuccessHandler((res) => {
                                setIsGenerating(false);
                                if (res.success) {
                                    notify("¡Liquidación enviada!", "success");
                                    const cleanPhone = String(prof?.phone || "").replace(/\D/g, '');
                                    const message = `Hola *${prof?.name || 'Profesional'}*! 🌟\n\nTe adjunto el detalle de tu liquidación generada hoy.\n\n📄 *Ver PDF:* ${res.url}\n\nMuchas gracias!`;
                                    window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
                                } else { notify(res.message, "error"); }
                            })
                            .uploadReceiptToDrive(user.email, pdfData, customFileName);
                    });
                }, 500);
            })
            .getLogoAsBase64(user.email);
    };

    return (
        <div className="p-4 md:p-8 bg-white min-h-full overflow-y-auto">
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Facturación</h2>
                <div className="flex gap-2">
                    {/* Botón Secundario (Fantasma) */}
                    <button onClick={handleSendReceipt} disabled={isGenerating} className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm bg-white border border-gray-200 text-gray-700 hover:border-gray-400 transition-all">
                        <Icon name={isGenerating ? "loader" : "file-text"} className={isGenerating ? "animate-spin" : ""}/>
                        {isGenerating ? "Procesando..." : "Enviar Liquidación"}
                    </button>
                    {/* Botón Primario con Contraste Inteligente */}
                    <button onClick={() => window.print()} className="bg-[var(--color-primary)] text-[var(--color-primary-text)] p-3 rounded-xl shadow-md hover:opacity-90 transition-opacity">
                        <Icon name="printer" size={18}/>
                    </button>
                </div>
            </header>

            {/* FILTROS */}
            <div className="bg-white p-6 border-b border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Período</label>
                    <select className="w-full border border-gray-200 p-3 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={dateRange} onChange={e => setDateRange(e.target.value)}><option value="today">Hoy</option><option value="week">Semana</option><option value="month">Mes</option><option value="all">Todo</option></select>
                </div>
                <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Profesional</label>
                    <select className="w-full border border-gray-200 p-3 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={profFilter} onChange={e => setProfFilter(e.target.value)}><option value="ALL">Todos</option>{professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
                <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Medio de Pago</label>
                    <select className="w-full border border-gray-200 p-3 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="ALL">Todos</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select>
                </div>
                <div><label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Cliente</label>
                    <input type="text" placeholder="Buscar..." className="w-full border border-gray-200 p-3 rounded-xl font-bold text-gray-900 outline-none focus:border-[var(--color-primary)]" value={searchClient} onChange={e => setSearchClient(e.target.value)}/>
                </div>
            </div>

            {/* ÁREA DE REPORTE */}
            <div id="report-area" className="w-full bg-white p-8 md:p-12 rounded-[2.5rem] border-2 border-[var(--color-primary)] shadow-sm print:p-0 print:border-0 transition-all">
                
                {/* CABECERA */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-10 mb-10">
                    <div className="flex items-center gap-6">
                        {localLogo ? <img src={localLogo} className="h-20 w-auto object-contain" /> : <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400 text-2xl uppercase">{branding.businessName?.charAt(0) || 'S'}</div>}
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
                                {profFilter === 'ALL' ? 'Libro de Caja' : 'Liquidación Profesional'}
                            </h1>
                            <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-[0.2em]">
                                {profFilter === 'ALL' ? 'Administración General' : professionals.find(p=>p.id===profFilter)?.name}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Generado</p>
                        <p className="font-bold text-gray-900 text-sm">{new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'})}</p>
                    </div>
                </div>

                {/* TARJETAS SUTILES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {profFilter === 'ALL' && (
                        <div className="p-6 bg-white rounded-2xl border border-gray-100">
                            <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Ingresos Brutos</p>
                            <p className="text-3xl font-black text-gray-900">${totalFacturado.toLocaleString()}</p>
                        </div>
                    )}
                    <div className="p-6 bg-white rounded-2xl border-2 border-green-500/20 shadow-sm">
                        <p className="text-[9px] font-bold text-green-600 uppercase mb-2">
                            {profFilter === 'ALL' ? 'Total Comisiones' : 'Total a Cobrar'}
                        </p>
                        <p className="text-3xl font-black text-green-700">${totalComisiones.toLocaleString()}</p>
                    </div>
                    {profFilter === 'ALL' && (
                        <div className="p-6 bg-white rounded-2xl border border-gray-100">
                            <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Utilidad local</p>
                            <p className="text-3xl font-black text-gray-900">${(totalFacturado - totalComisiones).toLocaleString()}</p>
                        </div>
                    )}
                </div>

                {/* TABLA */}
                {/* TABLA: TAMAÑO DE LETRA AUMENTADO */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 border-l-4 border-[var(--color-primary)] pl-4 mb-6">
                        <h3 className="text-base font-black text-gray-900 uppercase tracking-widest">Detalle de Cobranzas y Comisiones</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left bg-white">
                            <thead>
                                <tr className="text-[11px] uppercase text-gray-500 font-bold border-b border-gray-300">
                                    <th className="pb-4 px-2">Fecha / Hora</th>
                                    <th className="pb-4 px-2">Cliente / Servicio</th>
                                    <th className="pb-4 px-2">Medio</th>
                                    <th className="pb-4 px-2 text-right">Cobrado</th>
                                    <th className="pb-4 px-2 text-right text-black">Com. %</th>
                                    <th className="pb-4 px-2 text-right text-black">Com. $</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {tableData.length === 0 ? (
                                    <tr><td colSpan="6" className="py-10 text-center text-gray-400 italic text-sm">Sin registros para el período seleccionado.</td></tr>
                                ) : (
                                    tableData.map(row => (
                                        <tr key={row.id} className="text-sm border-b border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
                                            <td className="py-5 px-2 text-gray-900 font-medium whitespace-nowrap leading-tight">
                                                {new Date(row.date).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'})}<br/>
                                                <span className="text-xs text-gray-500 font-normal">{new Date(row.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})} hs</span>
                                            </td>
                                            <td className="py-5 px-2">
                                                <p className="font-bold text-gray-900 text-base">{row.clientName}</p>
                                                <p className="text-xs text-gray-600">{row.treatmentName}</p>
                                            </td>
                                            <td className="py-5 px-2">
                                                <span className="text-[10px] font-bold uppercase text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                                    {row.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                                </span>
                                            </td>
                                            <td className="py-5 px-2 text-right font-bold text-gray-900 text-base">${row.collectedAmount.toLocaleString()}</td>
                                            <td className="py-5 px-2 text-right text-gray-900 font-medium">{row.rate}%</td>
                                            <td className="py-5 px-2 text-right font-black text-gray-900 text-base">${row.commissionAmount.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-white border-t-2 border-black">
                                <tr>
                                    <td colSpan="5" className="py-8 px-4 text-right text-xs font-bold uppercase text-gray-500">Total a Liquidar:</td>
                                    <td className="py-8 px-4 text-right text-2xl font-black text-black">${totalComisiones.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* PIE DE PÁGINA */}
                <div className="text-center pt-16 mt-16 border-t border-dashed border-gray-200 bg-white">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.5em]">Documento Oficial de Liquidación - {branding.businessName || 'Software HaceClick AI'}</p>
                </div>
            </div>
        </div>
    );
};
