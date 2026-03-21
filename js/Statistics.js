const Statistics = ({ appointments, treatments, clients, professionals = [], loggedProfId }) => {
    // Si hay un profesional logueado, forzamos el filtro a su ID, si no, arranca en 'ALL'
    const [filterProf, setFilterProf] = useState(loggedProfId || 'ALL');

    const validAppts = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'holiday' && a.status !== 'blocked');

    const filteredAppts = validAppts.filter(a => {
        if (filterProf === 'ALL') return true;
        return a.professionalId === filterProf;
    });

    const treatmentStats = treatments.map(t => {
        const count = filteredAppts.filter(a => a.treatmentId === t.id).length;
        return { ...t, count };
    }).sort((a, b) => b.count - a.count).slice(0, 5); 

    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayStats = Array(7).fill(0);
    filteredAppts.forEach(a => {
        const d = new Date(a.date);
        dayStats[d.getDay()]++;
    });
    
    const workDays = daysOfWeek.slice(1, 7);
    const workDayStats = dayStats.slice(1, 7);
    const maxDayCount = Math.max(...workDayStats, 1);
    const minDayIndex = workDayStats.indexOf(Math.min(...workDayStats.filter(c => c > 0)));

    const hourStats = {};
    for(let i=8; i<=20; i++) hourStats[i] = 0;
    filteredAppts.forEach(a => {
        const h = new Date(a.date).getHours();
        if(hourStats[h] !== undefined) hourStats[h]++;
    });
    const maxHourCount = Math.max(...Object.values(hourStats), 1);

    const topTreatment = treatmentStats[0];
    const slowestDay = workDays[minDayIndex];

    const StatCard = ({ title, value, subtitle, icon, color }) => (
        <div className="bg-white p-6 rounded-brand shadow-card border border-brand-border flex items-center gap-5">
            <div className={`p-4 rounded-full ${color} text-white shadow-inner`}><Icon name={icon} size={24}/></div>
            <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
                {/* ACHICADO A text-2xl */}
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-8 bg-brand-bg overflow-y-auto h-full custom-scrollbar">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    {/* ACHICADO A text-2xl */}
                    <h2 className="text-2xl font-bold text-brand-text">Estadísticas y Rendimiento</h2>
                    <p className="text-sm text-brand-text-light mt-1">Analiza los datos de tu negocio para tomar mejores decisiones.</p>
                </div>
                
                {/* SI ES ADMIN VE EL SELECTOR, SI ES PROFESIONAL VE UN BADGE FIJO */}
                {!loggedProfId ? (
                    <div className="bg-white border border-brand-border p-2 rounded-xl shadow-sm flex items-center gap-3">
                        <div className="text-gray-400 pl-2"><Icon name="filter" size={18}/></div>
                        <select 
                            value={filterProf} 
                            onChange={e => setFilterProf(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-gray-700 pr-2 cursor-pointer text-sm"
                        >
                            <option value="ALL">Consolidado (Todos)</option>
                            {professionals.map(p => <option key={p.id} value={p.id}>Solo {p.name}</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-xl shadow-sm flex items-center gap-2 font-bold text-sm">
                        <Icon name="bar-chart-2" size={18}/> Mis Estadísticas
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                <StatCard title="Total Turnos" value={filteredAppts.length} subtitle="Completados/reservados" icon="calendar-check" color="bg-blue-500" />
                <StatCard title="Servicio Estrella" value={topTreatment && topTreatment.count > 0 ? topTreatment.name : '-'} subtitle={topTreatment && topTreatment.count > 0 ? `${topTreatment.count} turnos agendados` : 'Sin datos'} icon="star" color="bg-yellow-500" />
                <StatCard title={filterProf === 'ALL' ? "Clientes Totales" : "Clientes Atendidos"} value={new Set(filteredAppts.map(a => a.clientId)).size} subtitle="Únicos en este filtro" icon="users" color="bg-green-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 md:p-8 rounded-brand shadow-card border border-brand-border">
                    {/* ACHICADO A text-base */}
                    <h3 className="font-bold text-base text-gray-800 mb-6 flex items-center gap-2"><Icon name="bar-chart-2" className="text-[var(--color-primary)]"/> Tráfico por Día</h3>
                    <div className="flex items-end justify-between h-48 gap-2 mt-4 border-b border-gray-100 pb-2">
                        {workDays.map((day, i) => (
                            <div key={day} className="flex flex-col items-center flex-1 group h-full">
                                <div className="w-full bg-[var(--color-primary)]/10 rounded-t-lg relative flex items-end justify-center transition-all group-hover:bg-[var(--color-primary)]/20 h-full">
                                    <div 
                                        className="w-full bg-[var(--color-primary)] rounded-t-lg transition-all duration-1000 flex items-start justify-center pt-2 text-xs font-bold text-[var(--color-primary-text)] shadow-md" 
                                        style={{height: `${(workDayStats[i]/maxDayCount)*100}%`, minHeight: workDayStats[i] > 0 ? '24px' : '0'}}>
                                        {workDayStats[i] > 0 ? workDayStats[i] : ''}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500 mt-3 uppercase tracking-wider">{day.substring(0,3)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-brand shadow-card border border-brand-border">
                    {/* ACHICADO A text-base */}
                    <h3 className="font-bold text-base text-gray-800 mb-6 flex items-center gap-2"><Icon name="clock" className="text-blue-500"/> Horarios Pico</h3>
                    <div className="flex items-end justify-between h-48 gap-1 mt-4 border-b border-gray-100 pb-2">
                        {Object.keys(hourStats).map(hour => (
                            <div key={hour} className="flex flex-col items-center flex-1 group h-full">
                                <div className="w-full bg-blue-50 rounded-t-md relative flex items-end justify-center transition-all group-hover:bg-blue-100 h-full">
                                    <div 
                                        className="w-full bg-blue-500 rounded-t-md transition-all duration-1000 flex items-start justify-center pt-1 text-[10px] font-bold text-white shadow-sm" 
                                        style={{height: `${(hourStats[hour]/maxHourCount)*100}%`, minHeight: hourStats[hour] > 0 ? '20px' : '0'}}>
                                        {hourStats[hour] > 0 ? hourStats[hour] : ''}
                                    </div>
                                </div>
                                <span className="text-[9px] font-bold text-gray-400 mt-3">{hour}h</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                <div className="lg:col-span-1 bg-white p-6 rounded-brand shadow-card border border-brand-border">
                    {/* ACHICADO A text-base */}
                    <h3 className="font-bold text-base text-gray-800 mb-6">Top 5 Servicios</h3>
                    <div className="space-y-4">
                        {treatmentStats.every(t => t.count === 0) ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">No hay datos suficientes en este filtro.</p>
                        ) : (
                            treatmentStats.filter(t => t.count > 0).map((t, i) => (
                                <div key={t.id}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-bold text-gray-700">{i+1}. {t.name}</span>
                                        <span className="font-bold text-[var(--color-primary)]">{t.count}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="bg-[var(--color-primary)] h-2 rounded-full" style={{width: `${(t.count/treatmentStats[0].count)*100}%`}}></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-gradient-to-br from-gray-800 to-black p-6 md:p-8 rounded-brand shadow-card text-white">
                    {/* ACHICADO A text-lg */}
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-yellow-400"><Icon name="lightbulb"/> Tips de Negocio</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/10 p-5 rounded-xl border border-white/10 backdrop-blur-sm">
                            {/* ACHICADO A text-base */}
                            <h4 className="font-bold text-base mb-2">Potenciá los días lentos</h4>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                {slowestDay ? `Las estadísticas indican que los días ${slowestDay} tienen menor concurrencia. Creá una campaña de WhatsApp ofreciendo un beneficio exclusivo para reservas en este día.` : `Aún no hay suficientes datos para determinar un día de baja concurrencia.`}
                            </p>
                        </div>
                        <div className="bg-white/10 p-5 rounded-xl border border-white/10 backdrop-blur-sm">
                            {/* ACHICADO A text-base */}
                            <h4 className="font-bold text-base mb-2">Asegurá el éxito de tu top</h4>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                {topTreatment && topTreatment.count > 0 ? `Tu servicio más popular es ${topTreatment.name}. Creá paquetes o cuponeras para este servicio. Los clientes ya lo aman, convertilos en recurrentes.` : `Registrá más turnos para obtener esta recomendación.`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
