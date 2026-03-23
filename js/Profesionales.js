// --- COMPONENTE PROFESIONALES (CON FECHA DE NACIMIENTO, PERMISOS Y COMISIONES) ---
const Professionals = ({ list = [], setList, notify, categories = [], user }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
    
    const [viewMode, setViewMode] = useState('table'); 
    
    const defaultDays = () => Array.from({ length: 7 }, () => ({ active: true, start: '0900', end: '1800' }));
    
    const defaultPermissions = {
        dashboard: true,
        agenda: true,
        billing: false,
        stats: false
    };

    const [form, setForm] = useState({ 
        id: '', name: '', phone: '', birthday: '', color: 'bg-red-100 text-red-800', specialties: [], 
        workingDays: defaultDays(),
        hasAccess: false, email: '', password: '',
        permissions: defaultPermissions, 
        hasCommission: false, 
        commissionType: 'percentage', 
        commissionValue: '', 
        commissionRates: {} 
    });

    const colors = ['bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800'];

    const handleSave = (e) => {
        e.preventDefault();
        const newProf = { ...form, id: form.id || 'PROF-' + Date.now() };
        
        let updatedList = form.id ? list.map(p => p.id === form.id ? newProf : p) : [...list, newProf];
        
        // 1. Guarda en la UI y en la base local
        setList(updatedList); 
        setIsModalOpen(false);
        
        const adminEmailToUse = user?.adminEmail || user?.email || localStorage.getItem('adminEmail') || '';
        
        notify("Procesando accesos en la nube...", "info");

        // 2. Ejecuta el guardado en la base Maestra y ESCUCHA la respuesta
        google.script.run
            .withSuccessHandler((res) => {
                if (res && res.success === false) {
                    notify("⚠️ " + res.message, "error"); 
                } else {
                    notify("✅ " + res.message, "success");
                }
            })
            .withFailureHandler((err) => {
                console.error(err);
                notify("Error de conexión con el servidor.", "error");
            })
            .saveProfessionalWithUser(adminEmailToUse, JSON.stringify(newProf));
    };

    const handleDelete = () => {
        const idToDelete = confirmDelete.id;
        const updatedList = list.filter(p => p.id !== idToDelete);
        
        setList(updatedList);
        setConfirmDelete({ open: false, id: null });
        notify("Eliminando profesional...", "info");
        
        const adminEmailToUse = user?.adminEmail || user?.email || localStorage.getItem('adminEmail') || '';
        
        google.script.run
            .withSuccessHandler(res => {
                if(res && res.success) notify("Profesional eliminado completamente", "success");
                else notify("Error servidor: " + res.message, "error");
            })
            .deleteProfessionalAndUser(adminEmailToUse, idToDelete);
    };

    const toggleDay = (index) => {
        const days = [...form.workingDays];
        days[index].active = !days[index].active;
        setForm({...form, workingDays: days});
    };

    const updateTime = (index, field, value) => {
        const days = [...form.workingDays];
        days[index][field] = value;
        setForm({...form, workingDays: days});
    };

    const toggleSpecialty = (catName) => {
        const specs = (form.specialties || []).includes(catName) 
            ? form.specialties.filter(s => s !== catName) 
            : [...(form.specialties || []), catName];
        setForm({...form, specialties: specs});
    };

    const togglePermission = (permKey) => {
        setForm({
            ...form,
            permissions: {
                ...form.permissions,
                [permKey]: !form.permissions[permKey]
            }
        });
    };

    const openEdit = (prof) => {
        setForm({
            ...prof,
            birthday: prof?.birthday || '', 
            hasAccess: prof?.hasAccess || false,
            email: prof?.email || '',
            password: prof?.password || '',
            permissions: prof?.permissions || defaultPermissions, 
            workingDays: prof?.workingDays || defaultDays(),
            specialties: prof?.specialties || [],
            hasCommission: prof?.hasCommission || false, 
            commissionType: prof?.commissionType || 'percentage', 
            commissionValue: prof?.commissionValue || '', 
            commissionRates: prof?.commissionRates || (prof?.commissionRate ? { "GENERAL": prof.commissionRate } : {})
        });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setForm({ 
            id: '', name: '', phone: '', birthday: '', color: colors[Math.floor(Math.random()*colors.length)], specialties: [], 
            workingDays: defaultDays(),
            hasAccess: false, email: '', password: '',
            permissions: defaultPermissions, 
            hasCommission: false, 
            commissionType: 'percentage', 
            commissionValue: '', 
            commissionRates: {}
        });
        setIsModalOpen(true);
    };

    const weekMap = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

    const isBirthdayToday = (dateString) => {
        if (!dateString) return false;
        const today = new Date();
        const [year, month, day] = dateString.split('-');
        return today.getDate() === parseInt(day) && (today.getMonth() + 1) === parseInt(month);
    };

    return (
        <div className="p-8 h-full bg-brand-bg overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Profesionales</h2>
                    <p className="text-sm text-gray-500 mt-1">Gestiona tu equipo y sus accesos.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-gray-200 flex rounded-xl p-1 shadow-sm">
                        <button 
                            onClick={() => setViewMode('grid')} 
                            className={`p-2.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} 
                            title="Vista de Tarjetas"
                        >
                            <Icon name="grid" size={18}/>
                        </button>
                        <button 
                            onClick={() => setViewMode('table')} 
                            className={`p-2.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} 
                            title="Vista de Lista"
                        >
                            <Icon name="list" size={18}/>
                        </button>
                    </div>
                    
                    <button onClick={openNew} className="bg-[var(--color-primary)] text-[var(--color-primary-text)] px-6 py-3 rounded-xl font-bold shadow-md transition-transform hover:scale-105 flex items-center gap-2">
                        <Icon name="plus" size={18} /> Agregar
                    </button>
                </div>
            </header>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
                    {(list || []).map(p => (
                        <div key={p.id} className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow group relative ${isBirthdayToday(p.birthday) ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-sm ${p.color || 'bg-gray-100'}`}>
                                        {(p?.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                                            {p?.name || "Sin nombre"} 
                                            {isBirthdayToday(p.birthday) && <span title="¡Hoy es su cumpleaños!">🎂</span>}
                                            {p?.hasCommission && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold" title="Cobra comisión">$</span>}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <Icon name="phone" size={14}/> {p?.phone || '-'}
                                        </div>
                                        {p?.hasAccess && (
                                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[9px] px-2 py-0.5 rounded-full font-bold mt-1.5 border border-blue-100">
                                                <Icon name="lock" size={8}/> ACCESO APP
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>openEdit(p)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"><Icon name="edit" size={18}/></button>
                                    <button onClick={()=>setConfirmDelete({open:true, id:p.id})} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Icon name="trash-2" size={18}/></button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {(p?.specialties || []).map((s, idx) => {
                                    const specName = typeof s === 'object' ? s.name : s;
                                    return <span key={idx} className="text-[10px] font-bold bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-gray-600">{specName}</span>;
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="p-4 whitespace-nowrap">Profesional</th>
                                    <th className="p-4">Contacto</th>
                                    <th className="p-4">Especialidades</th>
                                    <th className="p-4">Acceso App</th>
                                    <th className="p-4 text-center">Comisiones</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {(list || []).length === 0 ? (
                                    <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">No hay profesionales registrados.</td></tr>
                                ) : (
                                    (list || []).map(p => (
                                        <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isBirthdayToday(p.birthday) ? 'bg-orange-50/30' : ''}`}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${p.color || 'bg-gray-100'}`}>
                                                        {(p?.name || "?").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-gray-800 whitespace-nowrap text-sm">
                                                        {p.name || "Sin nombre"}
                                                        {isBirthdayToday(p.birthday) && <span className="ml-2" title="¡Hoy es su cumpleaños!">🎂</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-600 whitespace-nowrap text-sm">
                                                {p.phone ? <span className="flex items-center gap-1.5"><Icon name="phone" size={14}/> {p.phone}</span> : '-'}
                                            </td>
                                            <td className="p-4 max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {(p?.specialties || []).map((s, idx) => {
                                                        const specName = typeof s === 'object' ? s.name : s;
                                                        return <span key={idx} className="text-[9px] font-bold bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">{specName}</span>;
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {p.hasAccess ? (
                                                    <span className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs truncate max-w-[150px]" title={p.email}>
                                                        <Icon name="unlock" size={12}/> {p.email}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Sin acceso</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {p.hasCommission ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded font-bold uppercase">
                                                            <Icon name="dollar-sign" size={10}/> Activo
                                                        </span>
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase truncate max-w-[80px]">
                                                            {p.commissionType === 'fixed_service' ? 'Fijo x Serv.' : p.commissionType === 'fixed_day' ? 'Fijo x Día' : '% Especialidad'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={()=>openEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition-colors" title="Editar"><Icon name="edit" size={16}/></button>
                                                    <button onClick={()=>setConfirmDelete({open:true, id:p.id})} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Eliminar"><Icon name="trash-2" size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL DE EDICIÓN / CREACIÓN */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                        
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                            <h3 className="font-bold text-lg text-gray-800">Perfil del Profesional</h3>
                            <button onClick={()=>setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><Icon name="x" size={24}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8 custom-scrollbar">
                            <div className="flex-1 space-y-6">
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre Completo</label>
                                        <input type="text" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-800 transition-colors text-sm" value={form.name || ""} onChange={e=>setForm({...form, name:e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Teléfono</label>
                                        <input type="tel" className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-800 transition-colors text-sm" value={form.phone || ""} onChange={e=>setForm({...form, phone:e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nacimiento (Opcional)</label>
                                        <input type="date" className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-800 transition-colors text-sm" value={form.birthday || ""} onChange={e=>setForm({...form, birthday:e.target.value})} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Color Agenda</label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {colors.map((c, i) => (
                                                <button key={i} type="button" onClick={() => setForm({...form, color: c})}
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform ${c} ${form.color === c ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent opacity-70'}`}
                                                ></button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ESPECIALIDADES */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Especialidades (Qué servicios hace)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(categories || []).map((c, i) => {
                                            const catName = typeof c === 'object' ? c.name : c;
                                            if (!catName) return null;
                                            const isSelected = (form.specialties || []).includes(catName);
                                            return (
                                                <button key={i} type="button" onClick={()=>toggleSpecialty(catName)} 
                                                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${isSelected ? 'bg-[var(--color-primary)] text-white shadow-sm border-[var(--color-primary)]' : 'bg-white text-gray-500 hover:border-gray-300'}`}>
                                                    {catName}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* ✅ SECCIÓN COMISIONES MÚLTIPLES (ACTUALIZADA A CUSTOM SELECT) */}
                                <div className="bg-green-50/50 border border-green-100 rounded-xl p-5 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-green-900 flex items-center gap-2 text-sm"><Icon name="dollar-sign" size={18}/> Esquema de Pago</h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={form.hasCommission || false} onChange={e => setForm({...form, hasCommission: e.target.checked})} />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                    
                                    {form.hasCommission && (
                                        <div className="pt-4 border-t border-green-100/50 animate-fade-in space-y-4">
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-green-800 mb-1.5">Modelo de Pago</label>
                                                {/* ✅ IMPLEMENTACIÓN DEL CUSTOM SELECT */}
                                                <CustomSelect 
                                                    value={form.commissionType} 
                                                    onChange={e => setForm({...form, commissionType: e.target.value})}
                                                    options={[
                                                        { value: 'percentage', label: 'Porcentaje (%) por Especialidad' },
                                                        { value: 'fixed_service', label: 'Monto Fijo ($) por Servicio Asistido' },
                                                        { value: 'fixed_day', label: 'Monto Fijo ($) por Día Trabajado' }
                                                    ]}
                                                />
                                            </div>

                                            {form.commissionType === 'percentage' && (
                                                <div className="space-y-3">
                                                    {(form.specialties || []).length > 0 ? (
                                                        <>
                                                            <p className="text-[10px] uppercase font-bold text-green-800">Porcentaje por especialidad:</p>
                                                            {(form.specialties || []).map(spec => (
                                                                <div key={spec} className="flex justify-between items-center bg-white p-3 rounded-lg border border-green-200">
                                                                    <span className="text-xs font-bold text-gray-700">{spec}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input 
                                                                            type="number" min="0" max="100" 
                                                                            className="w-16 border border-gray-300 p-1.5 rounded text-center text-sm font-bold text-green-700 outline-none focus:border-green-500 transition-colors" 
                                                                            value={form.commissionRates?.[spec] || ''} 
                                                                            onChange={e => setForm({
                                                                                ...form, 
                                                                                commissionRates: { ...form.commissionRates, [spec]: e.target.value }
                                                                            })} 
                                                                        />
                                                                        <span className="text-xs text-gray-500 font-bold">%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-orange-600 italic font-medium">Sube a la sección de arriba y marca las especialidades de este profesional para asignar los porcentajes.</p>
                                                    )}
                                                </div>
                                            )}

                                            {(form.commissionType === 'fixed_service' || form.commissionType === 'fixed_day') && (
                                                <div className="animate-fade-in">
                                                    <label className="block text-[10px] uppercase font-bold text-green-800 mb-1.5">Monto a Pagar ($)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                                        <input 
                                                            type="number" min="0" step="100"
                                                            className="w-full border border-green-200 p-2.5 pl-7 rounded-lg text-sm font-bold text-green-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 bg-white transition-all"
                                                            value={form.commissionValue || ''}
                                                            onChange={e => setForm({...form, commissionValue: e.target.value})}
                                                            placeholder="Ej: 2000"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ACCESO AL SISTEMA Y PERMISOS */}
                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-blue-900 flex items-center gap-2 text-sm"><Icon name="shield" size={18}/> Acceso al Sistema</h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={form.hasAccess || false} onChange={e => setForm({...form, hasAccess: e.target.checked})} />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                        </label>
                                    </div>
                                    
                                    {form.hasAccess && (
                                        <div className="space-y-5 pt-2 border-t border-blue-100/50 animate-fade-in">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Email (Usuario)</label>
                                                    <input type="email" placeholder="juan@local.com" className="w-full border border-blue-200 p-2.5 rounded-lg bg-white text-sm outline-none focus:border-blue-400 transition-colors" value={form.email || ""} onChange={e=>setForm({...form, email:e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Contraseña</label>
                                                    <input type="text" placeholder="1234" className="w-full border border-blue-200 p-2.5 rounded-lg bg-white text-sm outline-none focus:border-blue-400 transition-colors" value={form.password || ""} onChange={e=>setForm({...form, password:e.target.value})} />
                                                </div>
                                            </div>

                                            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-3 border-b border-blue-50 pb-2">Permisos de Visualización</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Icon name="layout-dashboard" size={14} className="text-blue-400"/> Dashboard</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={form.permissions?.dashboard ?? true} onChange={() => togglePermission('dashboard')} />
                                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                                                        </label>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Icon name="calendar" size={14} className="text-blue-400"/> Mi Agenda</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={form.permissions?.agenda ?? true} onChange={() => togglePermission('agenda')} />
                                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Icon name="receipt" size={14} className="text-blue-400"/> Mi Facturación</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={form.permissions?.billing ?? false} onChange={() => togglePermission('billing')} />
                                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Icon name="bar-chart-2" size={14} className="text-blue-400"/> Mis Estadísticas</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={form.permissions?.stats ?? false} onChange={() => togglePermission('stats')} />
                                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* HORARIOS */}
                            <div className="w-full md:w-80 bg-gray-50 rounded-xl p-6 border border-gray-100 h-fit shrink-0">
                                <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                                    <Icon name="clock" size={16}/> Horarios de Trabajo
                                </h3>
                                <div className="space-y-4">
                                    {(form.workingDays || []).map((day, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-3 w-20">
                                                <input type="checkbox" checked={day?.active || false} onChange={()=>toggleDay(i)} className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"/>
                                                <span className={`font-bold ${day?.active ? 'text-gray-800' : 'text-gray-400'}`}>{weekMap[i]}</span>
                                            </div>
                                            {day?.active ? (
                                                <div className="flex items-center gap-2">
                                                    <input type="text" className="w-14 text-center p-1.5 border border-gray-300 rounded text-xs font-mono outline-none focus:border-[var(--color-primary)] transition-colors" value={day.start || "0900"} onChange={e=>updateTime(i,'start',e.target.value)} maxLength="4" placeholder="0900"/>
                                                    <span className="text-gray-400">-</span>
                                                    <input type="text" className="w-14 text-center p-1.5 border border-gray-300 rounded text-xs font-mono outline-none focus:border-[var(--color-primary)] transition-colors" value={day.end || "1800"} onChange={e=>updateTime(i,'end',e.target.value)} maxLength="4" placeholder="1800"/>
                                                </div>
                                            ) : <span className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded">Descanso</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-4 shrink-0">
                            <button onClick={()=>setIsModalOpen(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-800 transition-colors text-sm">Cancelar</button>
                            <button onClick={handleSave} className="px-8 py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg font-bold hover:opacity-90 transition-all shadow-md flex items-center gap-2 text-sm">
                                <Icon name="save" size={18}/> Guardar Perfil
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* MODAL CONFIRMAR BORRADO */}
            {confirmDelete.open && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center border border-gray-100 animate-scale-in">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="alert-triangle" size={24} />
                        </div>
                        <h3 className="font-bold text-base mb-2 text-gray-800">¿Eliminar Profesional?</h3>
                        <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer y borrará también su acceso al sistema.</p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setConfirmDelete({open:false, id:null})} className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg font-bold text-gray-600 transition-colors">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-md transition-colors">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
