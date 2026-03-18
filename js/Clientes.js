
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
      <div className="p-8 h-full flex flex-col bg-brand-bg overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div><h2 className="text-3xl font-bold text-brand-text">Clientes</h2><p className="text-brand-text-light">Base de datos</p></div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingId(null); setFormData({name:'',phone:'',email:'',birthday:'',notes:''}); setIsModalOpen(true); }} className="bg-primary text-brand-text px-5 py-2.5 rounded-brand shadow-lg shadow-primary/20 flex gap-2 font-bold hover:bg-primary-dark hover:text-white transition-all"><Icon name="plus" /> Nuevo</button>
          </div>
        </header>
        
        <div className="mb-6 relative">
            <Icon name="search" className="absolute left-4 top-3 text-brand-text-light"/>
            <input className="w-full border border-brand-border pl-11 p-3 rounded-brand outline-none focus:border-primary transition-all bg-white" placeholder="Buscar Cliente..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        </div>

        <div className="bg-white rounded-brand shadow-card border border-brand-border overflow-hidden flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-brand-bg text-brand-text-light text-xs uppercase font-bold tracking-wider sticky top-0 z-10">
                <tr><th className="p-5">Nombre</th><th className="p-5">Contacto</th><th className="p-5 hidden md:table-cell">Email</th><th className="p-5 hidden md:table-cell">Cumple</th><th className="p-5 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
                {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-brand-bg transition-colors group">
                        <td className="p-5 font-bold text-brand-text flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-brand-text flex items-center justify-center text-xs">
                                {(c?.name || "?").charAt(0).toUpperCase()}
                            </div>
                            {c?.name || "Sin nombre"}
                        </td>
                        <td className="p-5 text-brand-text-light">
                            <div className="flex items-center gap-2">
                                <span>{c?.phone || "-"}</span>
                                
                                {/* BOTÓN DE WHATSAPP DIRECTO A LA APP */}
                                {c?.phone && (
                                    <button 
                                        onClick={() => {
                                            const phoneClean = String(c.phone).replace(/[^0-9]/g, '');
                                            const url = `whatsapp://send?phone=${phoneClean}`;
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.target = '_top';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }} 
                                        className="text-primary hover:text-primary-dark p-1 rounded-full" 
                                        title="Abrir App de WhatsApp"
                                    >
                                        <Icon name="message-circle" size={16}/>
                                    </button>
                                )}
                            </div>
                        </td>
                        <td className="p-5 text-brand-text-light hidden md:table-cell text-sm">{c?.email || '-'}</td>
                        <td className="p-5 text-brand-text-light hidden md:table-cell text-sm">{c?.birthday ? formatDate(c.birthday) : '-'}</td>
                        <td className="p-5 text-right">
                            <button onClick={() => { setEditingId(c.id); setFormData(c); setIsModalOpen(true); }} className="text-primary-dark hover:text-primary p-2 rounded hover:bg-brand-bg transition-colors"><Icon name="pencil" size={18}/></button>
                        </td>
                    </tr>
                ))}
                {filtered.length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-brand-text-light italic">No hay Clientes registrados.</td></tr>
                )}
            </tbody>
          </table>
        </div>
        
        {/* MODAL CLIENTE */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-brand-text/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-brand w-full max-w-4xl p-8 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-scale-in">
              <h3 className="text-xl font-bold mb-6 text-brand-text">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <div className="flex-1 overflow-auto flex flex-col lg:flex-row gap-8">
                <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                  <div>
                      <label className="text-xs font-bold text-brand-text-light ml-1">Nombre Completo</label>
                      <input required placeholder="Ej: Sofía López" className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-brand-text-light ml-1">Teléfono</label>
                      <input required placeholder="Ej: 1155554444" className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-brand-text-light ml-1">Cumpleaños</label>
                      <input type="date" className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.birthday} onChange={e=>setFormData({...formData, birthday:e.target.value})} />
                    </div>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-brand-text-light ml-1">Email</label>
                      <input type="email" placeholder="correo@ejemplo.com" className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-brand-text-light ml-1">Notas / Ficha</label>
                      <textarea placeholder="Alergias, preferencias, notas sobre tratamientos..." className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary h-24 resize-none" value={formData.notes} onChange={e=>setFormData({...formData, notes:e.target.value})}></textarea>
                  </div>
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-brand-border">
                    {editingId && <button type="button" onClick={() => setConfirmDelete({open:true, id:editingId})} className="mr-auto text-accent hover:text-red-400 font-bold text-sm">Eliminar</button>}
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-brand-text-light font-medium">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-primary text-brand-text rounded-brand font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark hover:text-white transition-all">Guardar</button>
                  </div>
                </form>

                {/* HISTORIAL */}
                {editingId && (
                  <div className="flex-1 bg-brand-bg rounded-brand p-5 border border-brand-border overflow-auto flex flex-col h-full max-h-[60vh]">
                    <h4 className="font-bold text-brand-text mb-4 flex items-center gap-2 border-b border-brand-border pb-2">
                      <Icon name="history" size={18} className="text-primary"/> Historial de Servicios
                    </h4>
                    <div className="flex-1 overflow-auto space-y-3 pr-2 custom-scrollbar">
                        {getClientHistory(editingId).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-brand-text-light opacity-50 py-10">
                                <Icon name="folder-open" size={40} className="mb-2"/>
                                <p className="text-sm italic">Sin tratamientos realizados aún.</p>
                            </div>
                        ) : (
                            getClientHistory(editingId).map(a => { 
                                const t = treatments?.find(tr => tr.id === a.treatmentId); 
                                return (
                                  <div key={a.id} className="bg-white p-4 rounded-brand border border-brand-border shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-brand-text text-sm">{t?.name || 'Servicio Desconocido'}</span>
                                        <span className="font-bold text-primary-dark text-sm bg-primary/10 px-2 py-0.5 rounded-full">{formatCurrency(t?.price || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-brand-text-light mt-2">
                                        <span className="flex items-center gap-1"><Icon name="calendar" size={12}/> {a?.date ? formatDate(a.date.split('T')[0]) : '-'}</span>
                                        {a?.paymentMethod === 'cash' && <span className="flex items-center gap-1"><Icon name="banknote" size={12}/> Efectivo</span>}
                                        {a?.paymentMethod === 'transfer' && <span className="flex items-center gap-1"><Icon name="landmark" size={12}/> Transf.</span>}
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
        
        <ConfirmModal isOpen={confirmDelete.open} title="¿Eliminar Cliente?" message="Se perderá su historial permanentemente." onCancel={()=>setConfirmDelete({open:false, id:null})} onConfirm={handleDelete} />
      </div>
    );
};
