// --- COMPONENTE CLIENTES (LIMPIO Y CORREGIDO) ---
const Clients = ({ clients = [], setClients, saveClients, appointments = [], treatments = [], categories = [], notify }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', birthday: '', notes: '' });
    const [searchTerm, setSearchTerm] = useState("");
    const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
    
    // --- FUNCIONES AUXILIARES ---
    const formatCurrency = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    const formatDate = (dateString) => {
        if(!dateString) return '-';
        // Ajuste de zona horaria para evitar que la fecha retroceda un día
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
    };
    
    // --- GUARDADO DE CLIENTES ---
    const handleSubmit = (e) => {
        e.preventDefault();
        
        let updatedList;
        if (editingId) {
            // Edición
            updatedList = clients.map(c => c.id === editingId ? { ...c, ...formData } : c);
        } else {
            // Creación: AGREGAMOS AL PRINCIPIO PARA VERLO INSTANTÁNEAMENTE
            updatedList = [{ id: Date.now().toString(), ...formData }, ...clients];
        }
        
        // Actualización Optimista
        saveClients(updatedList);
        setIsModalOpen(false);
        notify("Cliente guardado correctamente", "success");
    };

    const handleDelete = () => {
        const updatedList = clients.filter(c => c.id !== confirmDelete.id);
        saveClients(updatedList);
        setConfirmDelete({open: false, id: null});
        notify("Cliente eliminado", "success");
    };

    const getClientHistory = (clientId) => {
        if (!appointments) return [];
        return appointments.filter(a => a?.clientId === clientId && (a.status === 'completed' || a.status === 'confirmed_deposit' || a.status === 'confirmed_no_deposit'))
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    };

    // Filtro de búsqueda optimizado
    const filtered = useMemo(() => {
        return (clients || []).filter(c => (c?.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()));
    }, [clients, searchTerm]);

    return (
      <div className="p-4 md:p-8 h-full flex flex-col bg-brand-bg overflow-hidden relative">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <div><h2 className="text-2xl font-bold text-brand-text">Clientes</h2><p className="text-brand-text-light text-sm mt-1">Base de datos</p></div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingId(null); setFormData({name:'',phone:'',email:'',birthday:'',notes:''}); setIsModalOpen(true); }} className="bg-primary text-brand-text px-5 py-2.5 rounded-brand shadow-lg shadow-primary/20 flex gap-2 font-bold hover:bg-primary-dark hover:text-white transition-all"><Icon name="plus" /> Nuevo</button>
          </div>
        </header>
        
        <div className="mb-6 relative shrink-0">
            <Icon name="search" className="absolute left-4 top-3 text-brand-text-light"/>
            <input className="w-full border border-brand-border pl-11 p-3 rounded-brand outline-none focus:border-primary transition-all bg-white shadow-sm" placeholder="Buscar Cliente..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        </div>

        {/* CONTENEDOR DE TABLA RESPONSIVE */}
        <div className="bg-white rounded-brand shadow-card border border-brand-border overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm backdrop-blur-md">
                        <tr>
                            <th className="p-4 pl-6">Nombre</th>
                            <th className="p-4">Contacto</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Cumple</th>
                            <th className="p-4 pr-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-4 pl-6 font-bold text-gray-800 flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-full bg-[#008395]/10 text-[#008395] flex items-center justify-center text-xs font-black shadow-sm">
                                        {(c?.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[150px] md:max-w-none">{c?.name || "Sin nombre"}</span>
                                </td>
                                <td className="p-4 text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span className="whitespace-nowrap font-medium text-sm">{c?.phone || "-"}</span>
                                        {/* ✅ BOTÓN DE WHATSAPP DIRECTO A LA APP CORREGIDO */}
                                        {c?.phone && (
                                            <button 
                                                onClick={() => {
                                                    const phoneClean = formatPhoneForWhatsApp(c.phone);
                                                    const url = `whatsapp://send?phone=${phoneClean}`;
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.target = '_top';
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }} 
                                                className="text-[#25D366] hover:text-green-600 bg-green-50 p-1.5 rounded-full hover:bg-green-100 transition-colors" 
                                                title="Enviar WhatsApp"
                                            >
                                                <Icon name="message-circle" size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-gray-500 text-sm truncate max-w-[150px]">{c?.email || '-'}</td>
                                <td className="p-4 text-gray-500 text-sm whitespace-nowrap">{c?.birthday ? formatDate(c.birthday) : '-'}</td>
                                <td className="p-4 pr-6 text-right">
                                    <button onClick={() => { setEditingId(c.id); setFormData(c); setIsModalOpen(true); }} className="text-[#008395] hover:text-white p-2 rounded-lg hover:bg-[#008395] transition-colors shadow-sm bg-gray-50 border border-gray-200 hover:border-[#008395]">
                                        <Icon name="pencil" size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="5" className="p-12 text-center text-gray-400 italic text-sm">No hay Clientes que coincidan con la búsqueda.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        
        {/* MODAL CLIENTE */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-scale-in">
              
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Icon name="user" className="text-[#008395]"/> {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm hover:bg-red-50 transition-colors">
                      <Icon name="x" size={18}/>
                  </button>
              </div>

              <div className="flex-1 overflow-auto flex flex-col lg:flex-row p-6 gap-8 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col h-full">
                  <div className="space-y-4 flex-1">
                      <div>
                          <label className="text-[10px] font-bold uppercase text-gray-500 ml-1 mb-1 block">Nombre Completo</label>
                          <input required placeholder="Ej: Sofía López" className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all text-gray-800" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-gray-500 ml-1 mb-1 block">Teléfono</label>
                          <input required placeholder="Ej: 1155554444" className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all text-gray-800" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-gray-500 ml-1 mb-1 block">Cumpleaños</label>
                          <input type="date" className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all text-gray-800" value={formData.birthday} onChange={e=>setFormData({...formData, birthday:e.target.value})} />
                        </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold uppercase text-gray-500 ml-1 mb-1 block">Email</label>
                          <input type="email" placeholder="correo@ejemplo.com" className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all text-gray-800" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold uppercase text-gray-500 ml-1 mb-1 block">Notas / Ficha (Privado)</label>
                          <textarea placeholder="Alergias, preferencias, notas sobre tratamientos..." className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 transition-all h-28 resize-none text-gray-800" value={formData.notes} onChange={e=>setFormData({...formData, notes:e.target.value})}></textarea>
                      </div>
                  </div>

                  <div className="flex justify-end items-center gap-3 mt-6 pt-5 border-t border-gray-100 shrink-0">
                    {editingId && (
                        <button type="button" onClick={() => setConfirmDelete({open:true, id:editingId})} className="mr-auto text-red-500 hover:text-red-700 bg-red-50 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                            <Icon name="trash-2" size={16}/> <span className="hidden sm:inline">Eliminar</span>
                        </button>
                    )}
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                    <button type="submit" className="px-8 py-2.5 bg-[#008395] text-white rounded-xl font-bold shadow-lg hover:bg-[#006a78] transition-colors flex items-center gap-2">
                        <Icon name="save" size={18}/> Guardar
                    </button>
                  </div>
                </form>

                {/* HISTORIAL */}
                {editingId && (
                  <div className="flex-1 bg-gray-50/50 rounded-xl p-5 border border-gray-200 flex flex-col h-[400px] lg:h-auto">
                    <h4 className="font-bold text-base text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-3 shrink-0">
                      <Icon name="history" size={18} className="text-[#008395]"/> Historial de Servicios
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {getClientHistory(editingId).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                                <Icon name="folder-open" size={40} className="mb-3"/>
                                <p className="text-sm font-medium">Sin tratamientos registrados.</p>
                            </div>
                        ) : (
                            getClientHistory(editingId).map(a => { 
                                const t = treatments?.find(tr => tr.id === a.treatmentId); 
                                return (
                                  <div key={a.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-[#008395]/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-gray-800 text-sm line-clamp-1 pr-2">{t?.name || 'Servicio Eliminado'}</span>
                                        <span className="font-black text-[#008395] text-sm bg-[#008395]/10 px-2 py-0.5 rounded-lg shrink-0">{formatCurrency(t?.price || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase mt-3 pt-2 border-t border-gray-100">
                                        <span className="flex items-center gap-1.5"><Icon name="calendar" size={12}/> {a?.date ? formatDate(a.date.split('T')[0]) : '-'}</span>
                                        {a?.paymentMethod === 'cash' && <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded"><Icon name="banknote" size={12}/> Efectivo</span>}
                                        {a?.paymentMethod === 'transfer' && <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded"><Icon name="landmark" size={12}/> Transf.</span>}
                                    </div>
                                  </div>
                                ) 
                            })
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* MODAL ELIMINAR */}
        {confirmDelete.open && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl animate-scale-in">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="alert-triangle" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar Cliente?</h3>
                    <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer y se perderá su historial.</p>
                    <div className="flex gap-3">
                        <button onClick={()=>setConfirmDelete({open:false, id:null})} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-md transition-colors">Sí, eliminar</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
};
