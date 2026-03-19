
// --- COMPONENTE SERVICIOS / TREATMENTS (OPTIMIZADO, CON PRECIOS Y MÁRGENES) ---
const Treatments = ({ treatments = [], setTreatments, saveTreatments, categories = [], setCategories, saveCategories, notify, settings }) => {
    
    // ESTADOS UI
    const [isModalOpen, setIsModalOpen] = useState(false); // Modal manual (Editar/Nuevo)
    const [isCatManagerOpen, setIsCatManagerOpen] = useState(false); // Modal Categorías
    const [subCatModal, setSubCatModal] = useState({ open: false, catId: null, catName: '' }); // Modal Subcategorías
    const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, type: 'item' });
    const [isSocialMode, setIsSocialMode] = useState(false);

    // ESTADOS FORMULARIO
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ category: '', subCategory: '', price: '', duration: '30', hasMargin: false, margin: '15' });
    
    // ESTADOS CREACIÓN RÁPIDA
    const [newCatName, setNewCatName] = useState("");
    const [newSub, setNewSub] = useState({ name: '', price: '', duration: '30', hasMargin: false, margin: '15' }); 

    // 1. CONFIGURACIÓN
    const agentConfig = useMemo(() => settings?.find(s => s.id === 'agent_config') || {}, [settings]);
    const brandingConfig = useMemo(() => settings?.find(s => s.id === 'branding') || {}, [settings]);
    const portalUrl = agentConfig.schedulerUrl || (window.SCRIPT_URL ? `${window.SCRIPT_URL}?view=client` : window.location.href.split('?')[0] + '?view=client');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(portalUrl)}&color=2E3A38&bgcolor=F7FBFA`;

    // --- LÓGICA CATEGORÍAS (OPTIMISTA) ---
    const handleAddCategory = () => {
        if(!newCatName.trim()) return;
        
        const newCategory = { id: Date.now().toString(), name: newCatName.trim(), subs: [] };
        const updatedCats = [...categories, newCategory];
        
        setCategories(updatedCats);
        setNewCatName("");
        
        saveCategories(updatedCats); 
        notify("Categoría creada", "success");
    };

    // --- LÓGICA SUBCATEGORÍAS + SERVICIO AUTOMÁTICO (OPTIMISTA) ---
    const handleAddSubCategory = () => {
        if(!newSub.name.trim()) return notify("Falta el nombre", "error");
        if(!newSub.price) return notify("Falta el precio", "error");

        const updatedCats = categories.map(c => 
            c.id === subCatModal.catId 
            ? { ...c, subs: [...(c.subs || []), newSub.name.trim()] } 
            : c
        );

        const newTreatment = {
            id: Date.now().toString(),
            category: subCatModal.catName,
            name: newSub.name.trim(),
            price: Number(newSub.price),
            duration: Number(newSub.duration),
            hasMargin: newSub.hasMargin,
            margin: Number(newSub.margin || 0)
        };
        const updatedTreatments = [...treatments, newTreatment];

        setCategories(updatedCats);
        setTreatments(updatedTreatments);
        setNewSub({ name: '', price: '', duration: '30', hasMargin: false, margin: '15' });
        
        saveCategories(updatedCats);
        saveTreatments(updatedTreatments);
        
        notify("Servicio agregado correctamente", "success");
    };

    const handleDeleteSub = (catId, subName) => {
        const updatedCats = categories.map(c => c.id === catId ? { ...c, subs: c.subs.filter(s => s !== subName) } : c);
        setCategories(updatedCats);
        saveCategories(updatedCats);
        notify("Opción eliminada", "success");
    };

    // --- LÓGICA SERVICIOS MANUAL (OPTIMISTA) ---
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.subCategory) return notify("Selecciona una opción", "error");

        const item = { 
            ...formData, 
            name: formData.subCategory, 
            price: Number(formData.price), 
            duration: Number(formData.duration),
            margin: Number(formData.margin || 0)
        };

        let updatedList;
        if (editingId) {
            updatedList = treatments.map(t => t.id === editingId ? { ...t, ...item } : t);
        } else {
            updatedList = [...treatments, { id: Date.now().toString(), ...item }];
        }
        
        setTreatments(updatedList); 
        saveTreatments(updatedList); 
        setIsModalOpen(false);
        notify("Guardado", "success");
    };

    const handleDeleteItem = () => {
        if (confirmDelete.type === 'item') {
            const newList = treatments.filter(x => x.id !== confirmDelete.id);
            setTreatments(newList);
            saveTreatments(newList);
        }
        if (confirmDelete.type === 'cat') {
            const newList = categories.filter(c => c.id !== confirmDelete.id);
            setCategories(newList);
            saveCategories(newList);
        }
        setConfirmDelete({open: false, id: null, type: 'item'});
        notify("Eliminado", "success");
    };

    return (
      <div className="p-8 bg-brand-bg min-h-full overflow-x-auto relative">
        <header className="flex justify-between items-center mb-8 min-w-[800px]">
          <div>
            <h2 className="text-3xl font-bold text-brand-text">Servicios</h2>
            <p className="text-brand-text-light">Gestión de precios y tiempos</p>
          </div>
          <div className="flex gap-3">
            <button 
                onClick={() => setIsSocialMode(true)} 
                className="bg-secondary text-brand-text px-4 py-2.5 rounded-brand font-bold shadow-lg shadow-secondary/20 flex items-center gap-2 hover:animate-pulse transition-all"
            >
                {/* Cambiamos "camera" por "instagram" */}
                <Icon name="instagram" size={18} /> 
                <span>Redes</span>
            </button>
             <button onClick={() => setIsCatManagerOpen(true)} className="bg-white border border-brand-border text-brand-text-light px-4 py-2.5 rounded-brand font-medium shadow-sm hover:bg-brand-bg flex items-center gap-2 transition-colors">
                <Icon name="list" /> Categorías
             <button 
                onClick={() => { 
                    setEditingId(null); 
                    setFormData({category:categories[0]?.name||'',subCategory:'',price:'',duration:'30', hasMargin: false, margin: '15'}); 
                    setIsModalOpen(true); 
                }} 
                className="bg-primary text-[var(--color-primary-text)] px-5 py-2.5 rounded-brand shadow-lg shadow-primary/20 flex gap-2 font-medium hover:bg-primary-dark transition-all"
                >
                <Icon name="plus" /> Manual
            </button>
          </div>
        </header>

        {/* LISTADO DE TARJETAS */}
        <div className="flex gap-6 items-start min-w-max pb-10">
            {categories.map(cat => (
                <div key={cat.id} className="w-80 bg-white rounded-brand shadow-card border border-brand-border flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-brand-border bg-brand-bg flex justify-between items-center">
                        <h3 className="font-bold text-brand-text uppercase tracking-wide text-sm">{cat.name}</h3>
                        <button onClick={() => setSubCatModal({open: true, catId: cat.id, catName: cat.name})} className="text-brand-text-light hover:text-primary p-1 rounded-md hover:bg-white transition-colors" title="Agregar opciones rápidas"><Icon name="plus-circle" size={18} /></button>
                    </div>
                    <div className="p-4 space-y-3">
                        {treatments.filter(t => t.category === cat.name).length === 0 && <p className="text-center text-xs text-brand-text-light py-4 italic">Sin servicios activos</p>}
                        
                        {treatments.filter(t => t.category === cat.name).map(t => (
                            <div key={t.id} onClick={() => { setEditingId(t.id); setFormData({category: t.category, subCategory: t.name, price: t.price, duration: t.duration, hasMargin: t.hasMargin || false, margin: t.margin || '15'}); setIsModalOpen(true); }} 
                                 className="group bg-white border border-brand-border rounded-brand p-3 hover:border-primary hover:shadow-soft cursor-pointer transition-all relative">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-bold text-brand-text text-sm leading-tight">{t.name}</h4>
                                    <span className="font-bold text-primary-dark text-sm">${t.price}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] text-brand-text-light bg-brand-bg px-2 py-0.5 rounded-md flex gap-1 items-center">
                                        <Icon name="clock" size={10}/> {t.duration} min
                                        {t.hasMargin && <span className="text-yellow-600 font-bold ml-1">(+{t.margin}m extra)</span>}
                                    </span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({open:true, id:t.id, type:'item'}) }} className="absolute -top-2 -right-2 bg-white text-accent shadow-sm border border-brand-border p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400">
                                    <Icon name="x" size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {categories.length === 0 && (
                <div className="p-10 flex flex-col items-center justify-center w-full text-brand-text-light opacity-50 border-2 border-dashed border-brand-border rounded-xl">
                    <Icon name="layout" size={48} className="mb-4"/>
                    <p>Comienza creando una Categoría</p>
                </div>
            )}
        </div>

        {/* --- MODAL 1: GESTOR DE CATEGORÍAS (SIMPLE) --- */}
        {isCatManagerOpen && (
            <div className="fixed inset-0 bg-brand-text/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-brand p-6 w-full max-w-sm shadow-2xl animate-scale-in border border-brand-border">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-brand-text">Categorías</h3>
                        <button onClick={()=>setIsCatManagerOpen(false)}><Icon name="x" className="text-gray-400 hover:text-black"/></button>
                    </div>
                    <div className="flex gap-2 mb-6">
                        <input autoFocus className="border border-brand-border p-2 rounded-brand flex-1 outline-none focus:border-primary bg-brand-bg" placeholder="Ej: Manos, Pies..." value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
                        <button onClick={handleAddCategory} className="bg-primary text-brand-text px-3 rounded-brand hover:text-white transition-colors"><Icon name="plus"/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-auto pr-2 custom-scrollbar">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex justify-between items-center bg-brand-bg p-3 rounded-brand border border-brand-border">
                                <span className="font-medium text-brand-text-light">{cat.name}</span>
                                <button onClick={() => setConfirmDelete({open:true, id:cat.id, type:'cat'})} className="text-accent hover:text-primary transition-colors"><Icon name="trash-2" size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- MODAL 2: NUEVO SERVICIO RÁPIDO (CON PRECIO Y TIEMPO Y MARGEN) --- */}
        {subCatModal.open && (
            <div className="fixed inset-0 bg-brand-text/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-brand p-6 w-full max-w-sm shadow-2xl animate-scale-in border border-brand-border">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div>
                            <p className="text-[10px] text-brand-text-light uppercase tracking-wider">Agregar a</p>
                            <h3 className="text-lg font-bold text-primary-dark leading-tight">{subCatModal.catName}</h3>
                        </div>
                        <button onClick={()=>setSubCatModal({open:false, catId:null, catName:''})}><Icon name="x" className="text-gray-400 hover:text-black"/></button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre del Servicio</label>
                            <input autoFocus className="w-full border border-brand-border p-2 rounded-brand outline-none focus:border-secondary bg-brand-bg" placeholder="Ej: Semipermanente" value={newSub.name} onChange={e=>setNewSub({...newSub, name:e.target.value})} />
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Precio ($)</label>
                                <input type="number" className="w-full border border-brand-border p-2 rounded-brand outline-none focus:border-secondary bg-brand-bg font-bold" placeholder="0" value={newSub.price} onChange={e=>setNewSub({...newSub, price:e.target.value})} />
                            </div>
                            <div className="w-24">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Minutos</label>
                                <input type="number" className="w-full border border-brand-border p-2 rounded-brand outline-none focus:border-secondary bg-brand-bg text-center" placeholder="30" value={newSub.duration} onChange={e=>setNewSub({...newSub, duration:e.target.value})} />
                            </div>
                        </div>

                        {/* SWITCH DE MARGEN (RÁPIDO) */}
                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-yellow-800 uppercase flex items-center gap-1"><Icon name="clock" size={12}/> Buffer de limpieza</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={newSub.hasMargin} onChange={e => setNewSub({...newSub, hasMargin: e.target.checked})} />
                                    <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-yellow-500"></div>
                                </label>
                            </div>
                            {newSub.hasMargin && (
                                <div className="mt-2 pt-2 border-t border-yellow-200/50 flex items-center justify-between">
                                    <span className="text-[10px] text-yellow-700">Tiempo oculto extra:</span>
                                    <div className="flex items-center gap-1">
                                        <input type="number" min="0" step="5" className="w-12 border border-yellow-200 p-1 text-center text-xs rounded outline-none" value={newSub.margin} onChange={e=>setNewSub({...newSub, margin:e.target.value})} />
                                        <span className="text-[10px] text-yellow-700 font-bold">min</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleAddSubCategory} className="w-full bg-secondary text-brand-text py-2 rounded-brand font-bold hover:text-white transition-colors mt-2 flex justify-center gap-2">
                            <Icon name="plus-circle" size={18}/> Crear Servicio
                        </button>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-auto pr-2 border-t pt-2 custom-scrollbar">
                        <p className="text-xs text-gray-400 mb-2">Servicios existentes en esta categoría:</p>
                        {(categories.find(c=>c.id===subCatModal.catId)?.subs || []).map(sub => (
                            <div key={sub} className="flex justify-between items-center text-xs text-brand-text-light bg-gray-50 p-1.5 rounded px-2">
                                <span>{sub}</span>
                                <button onClick={() => handleDeleteSub(subCatModal.catId, sub)} className="text-red-300 hover:text-red-500"><Icon name="x" size={12}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- MODAL 3: EDITOR MANUAL (DETALLADO CON MARGEN) --- */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-brand-text/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-brand w-full max-w-md p-8 shadow-2xl animate-scale-in border border-brand-border">
                    <h3 className="text-xl font-bold mb-6 text-brand-text">{editingId ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-brand-text-light ml-1">Categoría</label>
                                <select className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, subCategory: ''})}>
                                    <option value="">Seleccionar...</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-brand-text-light ml-1">Opción</label>
                                <select required className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})} disabled={!(categories.find(c => c.name === formData.category)?.subs || []).length}>
                                    <option value="">Seleccionar...</option>
                                    {(categories.find(c => c.name === formData.category)?.subs || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-brand-text-light ml-1">Precio ($)</label>
                                <input type="number" required className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none font-bold text-brand-text focus:border-primary" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-brand-text-light ml-1">Minutos</label>
                                <input type="number" required className="w-full bg-brand-bg border border-brand-border p-3 rounded-brand outline-none focus:border-primary" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                            </div>
                        </div>

                        {/* SWITCH DE MARGEN (MANUAL) */}
                        <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-4 mt-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-yellow-800 text-sm flex items-center gap-2"><Icon name="clock" size={16}/> Margen de Limpieza</h4>
                                    <p className="text-[9px] text-yellow-600 mt-0.5 leading-tight">Tiempo extra que se bloquea en la agenda pero no lo ve el cliente.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" className="sr-only peer" checked={formData.hasMargin || false} onChange={e => setFormData({...formData, hasMargin: e.target.checked})} />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                                </label>
                            </div>
                            {formData.hasMargin && (
                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-yellow-200 animate-fade-in">
                                    <label className="text-xs font-bold text-yellow-800">Agregar minutos:</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" step="5" className="w-16 border border-yellow-300 p-1.5 rounded-lg bg-white text-center font-bold text-yellow-800 outline-none focus:border-yellow-500" value={formData.margin || ""} onChange={e=>setFormData({...formData, margin:e.target.value})} />
                                        <span className="text-xs font-bold text-yellow-600">min</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-brand-border">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-brand-text-light font-medium hover:text-brand-text transition-colors">Cancelar</button>
                            <button type="submit" className="px-6 py-2 bg-primary text-brand-text rounded-brand font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark hover:text-white transition-all">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* --- MODAL 4: MODO REDES (INSTAGRAM) --- */}
        {isSocialMode && (
            <div className="fixed inset-0 bg-brand-text/90 z-[100] flex items-center justify-center p-4 overflow-auto">
                <div className="relative bg-white w-full max-w-sm md:max-w-md min-h-[600px] rounded-none shadow-2xl flex flex-col animate-scale-in">
                    <button onClick={()=>setIsSocialMode(false)} className="absolute top-4 right-4 bg-brand-border p-2 rounded-full z-20 hover:bg-secondary transition-colors"><Icon name="x"/></button>
                    
                    <div id="capture-area" className="flex-1 bg-brand-bg flex flex-col items-center relative overflow-hidden border-8 border-white">
                        <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-secondary rounded-bl-full opacity-50"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-tr-full"></div>

                        <div className="w-full h-full p-8 flex flex-col items-center z-10">
                            <div className="mb-6 text-center flex flex-col items-center w-full">
                                {brandingConfig.logoBase64 && <img src={brandingConfig.logoBase64} alt="Logo" className="h-24 object-contain mb-3 drop-shadow-sm" />}
                                <h2 contentEditable suppressContentEditableWarning className="text-base ont-bold text-brand-text mb-1 tracking-widest outline-none uppercase font-serif leading-none text-center">
                                    LISTA DE PRECIOS
                                </h2>
                            </div>

                            <div className="w-full flex-1 space-y-5">
                                {categories.map(cat => {
                                    const catTreatments = treatments.filter(t => t.category === cat.name);
                                    if(catTreatments.length === 0) return null;
                                    return (
                                        <div key={cat.id} className="mb-3">
                                            <h3 className="font-bold text-primary-dark border-b border-primary/30 pb-1 mb-2 uppercase text-xs tracking-wider text-center">{cat.name}</h3>
                                            <ul className="space-y-2">
                                                {catTreatments.map(t => (
                                                    <li key={t.id} className="flex justify-between items-end text-sm group">
                                                        <span className="text-brand-text font-medium bg-brand-bg pr-2 z-10">{t.name}</span>
                                                        <span className="border-b border-dotted border-brand-text-light/30 flex-1 mx-1 mb-1"></span>
                                                        <span className="text-brand-text font-bold bg-brand-bg pl-2 z-10">${t.price}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="mt-6 w-full border-t border-brand-border pt-4 text-center">
                                <div className="flex flex-col items-center gap-1 mb-4">
                                    <p contentEditable suppressContentEditableWarning className="text-xs font-bold text-brand-text flex items-center gap-1 justify-center outline-none"><Icon name="map-pin" size={10} /> {agentConfig.address || "Consultar dirección"}</p>
                                    <p contentEditable suppressContentEditableWarning className="text-xs font-bold text-brand-text flex items-center gap-1 justify-center outline-none"><Icon name="phone" size={10} /> {agentConfig.whatsapp || "WhatsApp"}</p>
                                </div>
                                <div className="bg-white p-2 rounded-brand shadow-sm inline-block border border-brand-border/50">
                                    <img src={qrUrl} alt="QR Turnos" className="w-24 h-24 mix-blend-multiply" />
                                </div>
                                <p className="text-[9px] text-brand-text-light mt-2 uppercase tracking-wide font-bold">Escanea para reservar turno</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-white border-t border-brand-border flex justify-between items-center">
                        <p className="text-xs text-brand-text-light leading-tight">💡 Haz captura de pantalla para Instagram.</p>
                        <button onClick={()=>setIsSocialMode(false)} className="bg-brand-text text-white px-4 py-2 rounded-brand text-sm font-bold hover:bg-black transition-colors ml-4">Cerrar</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL CONFIRMAR BORRADO (ESTÁTICO Y CENTRADO) */}
        {confirmDelete.open && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center border border-gray-100 transform transition-all">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="alert-triangle" size={24} />
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-gray-800">¿Eliminar?</h3>
                    <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setConfirmDelete({open:false, id:null, type:'item'})} 
                            className="flex-1 py-2.5 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDeleteItem} 
                            className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
                        >
                            Sí, Eliminar
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
};
