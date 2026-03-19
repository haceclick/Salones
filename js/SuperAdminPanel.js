// --- 3. SUPER ADMIN PANEL ---
const SuperAdminPanel = ({ notify, user }) => {
    const [form, setForm] = useState({ email: '', pass: '', name: '', rubro: '' });
    const [loading, setLoading] = useState(false);
    
    const [messages, setMessages] = useState([]);
    const [msgForm, setMsgForm] = useState({ target: 'ALL', title: '', message: '' });
    const [sendingMsg, setSendingMsg] = useState(false);
    const [editingMsgId, setEditingMsgId] = useState(null);

    const [tenants, setTenants] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', pass: '' });
    const [deleteTarget, setDeleteTarget] = useState(null);

    // ✅ ESTADO PARA EL ACORDEÓN (Inicia con 'empresas' abierto)
    const [openSection, setOpenSection] = useState('empresas');

    const toggleSection = (sectionName) => {
        setOpenSection(prev => prev === sectionName ? null : sectionName);
    };

    useEffect(() => { 
        loadTenants(); 
        loadMessages();
    }, []);

    const loadTenants = () => {
        setLoadingList(true);
        google.script.run
            .withSuccessHandler(res => {
                setLoadingList(false);
                if (res.success) setTenants(res.clients);
            })
            .getAllTenants(user.email);
    };

    const loadMessages = () => {
        google.script.run
            .withSuccessHandler(res => {
                if (res.success) setMessages(res.messages || []);
            })
            .getGlobalMessages(user.email);
    };

    const handleCreate = (e) => {
        e.preventDefault();
        setLoading(true);
        google.script.run
            .withSuccessHandler(res => {
                setLoading(false);
                if(res.success) {
                    notify(res.message, "success");
                    setForm({ email: '', pass: '', name: '', rubro: '' });
                    loadTenants(); 
                    setOpenSection('empresas'); // Redirige la vista a la tabla de empresas
                } else notify(res.message, "error");
            })
            .createNewTenant(form.email, form.pass, form.name, form.rubro, user.email);
    };

    const handleSaveMsg = (e) => {
        e.preventDefault();
        setSendingMsg(true);
        notify(editingMsgId ? "Actualizando aviso..." : "Enviando aviso...", "info");
        
        let updatedMsgs;
        if (editingMsgId) {
            updatedMsgs = messages.map(m => m.id === editingMsgId ? { ...msgForm, id: editingMsgId, date: m.date, type: 'admin_manual' } : m);
        } else {
            updatedMsgs = [...messages, { ...msgForm, id: 'SYS-' + Date.now(), date: new Date().toISOString(), type: 'admin_manual' }];
        }
        
        const payloadStr = JSON.stringify(updatedMsgs);
        
        // 🛡️ Aseguramos que el email del admin no viaje vacío
        const adminMail = user?.email || localStorage.getItem('adminEmail') || '';

        google.script.run
            .withSuccessHandler(res => {
                setSendingMsg(false);
                
                // 🚨 EL DETECTOR: Vemos qué respondió Google realmente
                console.log("Respuesta cruda de Google:", res);
                
                if (res && res.success) {
                    notify(res.message || "Aviso publicado correctamente", "success");
                    setMessages(updatedMsgs);
                    setMsgForm({ target: 'ALL', title: '', message: '' }); 
                    setEditingMsgId(null);
                    setOpenSection('avisos');
                } else if (res && !res.success) {
                    // Si Google responde un error (ej: No autorizado)
                    notify(res.message || "Error devuelto por Google", "error");
                } else {
                    // Si Google responde "vacío" (Versión vieja congelada)
                    alert("⚠️ DETECTOR: Google no devolvió ningún mensaje. Tu página web sigue leyendo una versión vieja del Código.gs que no tiene los 'return'. Debes hacer una Nueva Implementación.");
                    notify("Error al guardar en el Excel Maestro.", "error");
                }
            })
            .withFailureHandler(err => {
                setSendingMsg(false);
                notify("Fallo de conexión con Google: " + (err.message || err.toString()), "error");
            })
            .saveGlobalMessagesList(adminMail, payloadStr);
    };

    const handleDeleteMsg = (id) => {
        const updatedMsgs = messages.filter(m => m.id !== id);
        notify("Borrando mensaje...", "info");
        
        const payloadStr = JSON.stringify(updatedMsgs);

        google.script.run
            .withSuccessHandler(res => {
                if (res && res.success) {
                    notify("Aviso eliminado.", "success");
                    setMessages(updatedMsgs);
                } else {
                    notify(res?.message || "No se pudo eliminar el aviso.", "error");
                }
            })
            .withFailureHandler(err => {
                notify("Error al borrar: " + (err.message || err.toString()), "error");
            })
            .saveGlobalMessagesList(user.email, payloadStr);
    };

    const startEditMsg = (m) => {
        setMsgForm({ target: m.target, title: m.title, message: m.message });
        setEditingMsgId(m.id);
        // Ya no hacemos scrollIntoView, simplemente nos aseguramos de que la sección esté abierta
        setOpenSection('avisos');
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        const { id } = deleteTarget;
        setDeleteTarget(null);
        notify("Eliminando acceso...", "info");
        google.script.run
            .withSuccessHandler(res => {
                if(res.success) {
                    notify(res.message, "success");
                    loadTenants();
                } else notify(res.message, "error");
            })
            .deleteTenant(user.email, id);
    };

    const startEdit = (client) => {
        setEditingId(client.sheetId);
        setEditForm({ name: client.businessName, pass: client.password });
    };

    const saveEdit = (sheetId) => {
        notify("Guardando...", "info");
        google.script.run
            .withSuccessHandler(res => {
                if(res.success) {
                    notify(res.message, "success");
                    setEditingId(null);
                    loadTenants();
                } else notify(res.message, "error");
            })
            .updateTenant(user.email, sheetId, editForm.name, editForm.pass);
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto relative h-full bg-brand-bg">
            
            {/* MODAL ELIMINAR ACCESO */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon name="alert-triangle" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar Acceso?</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Se borrará el acceso para <strong>{deleteTarget.name}</strong>.<br/>
                                <span className="text-xs text-red-500 mt-2 block font-medium">El archivo de Excel quedará intacto en Google Drive por seguridad.</span>
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
                                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-md transition-colors">Sí, Eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-12 h-12 bg-[#008395] text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                        <Icon name="shield-check" size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800">Administración Central</h2>
                        <p className="text-sm text-gray-500 mt-1">Gestión global de clientes SaaS y notificaciones del sistema.</p>
                    </div>
                </div>
            </header>

            <div className="w-full space-y-4 pb-20">
                
                {/* 1. EMPRESAS ACTIVAS */}
                <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                    <button 
                        type="button" 
                        onClick={() => toggleSection('empresas')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'empresas' ? 'border-b border-gray-100' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Icon name="server" className="text-[var(--color-primary)]"/> Empresas Activas</h3>
                            <span className="bg-[#008395]/10 text-[#008395] text-xs font-bold px-2.5 py-0.5 rounded-full">{tenants.length}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div 
                                onClick={(e) => { e.stopPropagation(); loadTenants(); }} 
                                className="text-gray-400 hover:text-[#008395] p-2 hover:bg-[#008395]/10 rounded-full transition-colors"
                                title="Recargar Lista"
                            >
                                <Icon name="refresh-cw" size={16} className={loadingList ? "animate-spin" : ""} />
                            </div>
                            <Icon name={openSection === 'empresas' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                        </div>
                    </button>
                    
                    {openSection === 'empresas' && (
                        <div className="animate-fade-in overflow-x-auto">
                            {tenants.length === 0 && !loadingList ? (
                                <div className="p-8 text-center text-gray-400">No hay empresas registradas aún.</div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b text-[10px] uppercase text-gray-400 font-bold">
                                        <tr>
                                            <th className="p-4 pl-6">Empresa</th>
                                            <th className="p-4">Email Dueño</th>
                                            <th className="p-4">Contraseña App</th>
                                            <th className="p-4 pr-6 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {tenants
                                            .filter(client => !client.email.includes('haceclick.ai') && !client.email.includes('matias.bote'))
                                            .map((client, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 pl-6 font-bold text-gray-800">
                                                    {editingId === client.sheetId 
                                                        ? <input className="border border-[#008395] p-2 rounded-lg w-full outline-none ring-2 ring-[#008395]/20" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})}/> 
                                                        : client.businessName}
                                                </td>
                                                <td className="p-4 text-gray-500">{client.email}</td>
                                                <td className="p-4 font-mono text-gray-600">
                                                    {editingId === client.sheetId 
                                                        ? <input className="border border-[#008395] p-2 rounded-lg w-28 outline-none ring-2 ring-[#008395]/20" value={editForm.pass} onChange={e=>setEditForm({...editForm, pass:e.target.value})}/> 
                                                        : <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs">{client.password}</span>}
                                                </td>
                                                <td className="p-4 pr-6">
                                                    <div className="flex justify-center gap-2">
                                                        {editingId === client.sheetId ? (
                                                            <>
                                                                <button onClick={()=>saveEdit(client.sheetId)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors shadow-sm" title="Guardar"><Icon name="check" size={16}/></button>
                                                                <button onClick={()=>setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors shadow-sm" title="Cancelar"><Icon name="x" size={16}/></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={()=>startEdit(client)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shadow-sm" title="Editar Credenciales"><Icon name="edit-2" size={16}/></button>
                                                                <button onClick={()=>setDeleteTarget({id:client.sheetId, name:client.businessName})} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors shadow-sm" title="Borrar Acceso"><Icon name="trash-2" size={16}/></button>
                                                                <a href={`https://docs.google.com/spreadsheets/d/${client.sheetId}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-lg transition-colors shadow-sm" title="Abrir DB Original en Drive"><Icon name="sheet" size={16}/></a>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. ALTA DE NUEVO CLIENTE */}
                <div className={`bg-white rounded-brand shadow-sm border ${openSection === 'nuevo' ? 'border-[#008395]' : 'border-brand-border'} overflow-hidden transition-all`}>
                    <button 
                        type="button" 
                        onClick={() => toggleSection('nuevo')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'nuevo' ? 'border-b border-[#008395]/20' : ''}`}
                    >
                        <h3 className="font-bold text-lg flex items-center gap-2 text-[#008395]"><Icon name="user-plus"/> Alta de Nueva Empresa</h3>
                        <Icon name={openSection === 'nuevo' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>

                    {openSection === 'nuevo' && (
                        <div className="p-6 animate-fade-in bg-[#008395]/5">
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="bg-white p-5 rounded-xl border border-[#008395]/20 shadow-sm">
                                        <h4 className="text-[10px] font-bold uppercase text-[#008395] mb-4 flex items-center gap-2"><Icon name="store" size={14}/> Datos del Local</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Empresa</label>
                                                <input required className="w-full border border-gray-200 p-3 rounded-lg outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Nombre comercial"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Rubro / Categoría</label>
                                                <select required className="w-full border border-gray-200 p-3 rounded-lg outline-none bg-white focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all" value={form.rubro} onChange={e=>setForm({...form, rubro: e.target.value})}>
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Estetica">Centro de Estética</option>
                                                    <option value="Barberia">Barbería / Peluquería</option>
                                                    <option value="Salud">Consultorio / Salud</option>
                                                    <option value="Otro">Otro</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white p-5 rounded-xl border border-[#008395]/20 shadow-sm">
                                        <h4 className="text-[10px] font-bold uppercase text-[#008395] mb-4 flex items-center gap-2"><Icon name="key" size={14}/> Credenciales de Acceso</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Email del Dueño (Login)</label>
                                                <input required type="email" className="w-full border border-gray-200 p-3 rounded-lg outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="ejemplo@correo.com"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Contraseña Temporal</label>
                                                <input required className="w-full border border-gray-200 p-3 rounded-lg outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all" value={form.pass} onChange={e=>setForm({...form, pass: e.target.value})} placeholder="La cambiará al ingresar"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <button disabled={loading} className="w-full md:w-auto bg-[#008395] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg hover:bg-[#006a78] hover:scale-105 transition-all flex items-center justify-center gap-2">
                                        {loading ? <><Icon name="loader" className="animate-spin" size={18}/> Procesando...</> : <><Icon name="database" size={18}/> Generar Empresa y DB Aislada</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* 3. AVISOS DEL SISTEMA */}
                <div className={`bg-white rounded-brand shadow-sm border ${openSection === 'avisos' ? 'border-blue-400' : 'border-brand-border'} overflow-hidden transition-all`}>
                    <button 
                        type="button" 
                        onClick={() => toggleSection('avisos')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'avisos' ? 'border-b border-blue-100' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600"><Icon name="message-square"/> Avisos a Clientes SaaS</h3>
                            {messages.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{messages.length} Activos</span>}
                        </div>
                        <Icon name={openSection === 'avisos' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>

                    {openSection === 'avisos' && (
                        <div className="p-6 animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* FORMULARIO DE AVISO */}
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-inner">
                                <h4 className="font-bold text-sm text-blue-900 mb-4">{editingMsgId ? 'Editar Aviso' : 'Crear Nuevo Aviso'}</h4>
                                <form onSubmit={handleSaveMsg} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Destinatario</label>
                                        <select required className="w-full border border-blue-200 p-3 rounded-xl outline-none bg-white text-blue-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" value={msgForm.target} onChange={e=>setMsgForm({...msgForm, target:e.target.value})}>
                                            <option value="ALL">📢 A Todas las Empresas (Global)</option>
                                            <optgroup label="Específico (Solo a 1 local)">
                                                {tenants.map(t => <option key={t.sheetId} value={t.sheetId}>{t.businessName}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Título del Aviso</label>
                                        <input required type="text" className="w-full border border-blue-200 p-3 rounded-xl outline-none bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-blue-900" value={msgForm.title} onChange={e=>setMsgForm({...msgForm, title:e.target.value})} placeholder="Ej: Nueva Función Disponible"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Mensaje</label>
                                        <textarea required className="w-full border border-blue-200 p-3 rounded-xl outline-none bg-white resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-blue-900" rows="3" value={msgForm.message} onChange={e=>setMsgForm({...msgForm, message:e.target.value})} placeholder="Escribe el mensaje que verán en sus Dashboards..."></textarea>
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        {editingMsgId && <button type="button" onClick={() => {setEditingMsgId(null); setMsgForm({target:'ALL', title:'', message:''})}} className="w-1/3 border border-blue-200 text-blue-600 bg-white p-3 rounded-xl font-bold hover:bg-blue-50 transition-colors">Cancelar</button>}
                                        <button disabled={sendingMsg} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                            <Icon name={editingMsgId ? "save" : "send"} size={18}/> {sendingMsg ? "Procesando..." : (editingMsgId ? "Guardar Cambios" : "Publicar Aviso")}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* LISTADO DE AVISOS */}
                            <div className="flex flex-col h-full">
                                <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2"><Icon name="radio" size={16} className="text-gray-400"/> Transmitiendo Ahora</h4>
                                {messages.length === 0 ? (
                                    <div className="flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-6 text-gray-400">
                                        <Icon name="bell-off" size={32} className="mb-2 opacity-50"/>
                                        <p className="text-sm text-center">No hay avisos activos en este momento.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 flex-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {messages.map(m => (
                                            <div key={m.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-start group hover:border-blue-300 transition-colors">
                                                <div className="overflow-hidden pr-3">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        {m.target === 'ALL' 
                                                            ? <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">GLOBAL</span> 
                                                            : <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase truncate max-w-[120px] shrink-0" title={tenants.find(t=>t.sheetId===m.target)?.businessName}>{tenants.find(t=>t.sheetId===m.target)?.businessName || 'Específico'}</span>
                                                        }
                                                        <span className="font-bold text-sm text-gray-800 truncate">{m.title}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{m.message}</p>
                                                </div>
                                                <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={()=>startEditMsg(m)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Icon name="edit-2" size={14}/></button>
                                                    <button onClick={()=>handleDeleteMsg(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Dejar de transmitir"><Icon name="trash-2" size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
