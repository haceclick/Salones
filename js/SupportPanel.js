// --- COMPONENTE SOPORTE (SEPARADO) ---
const SupportPanel = ({ settings, saveSettings, user, notify }) => {
    const canConfigure = user?.role === 'admin' || user?.isSuperAdmin;
    
    const defaultConfig = { 
        id: 'support_config', 
        videos: [
            { id: 1, title: 'Alta y Gestión de Clientes', url: '' },
            { id: 2, title: 'Alta de Profesionales', url: '' }
        ],
        supportEmail: '', 
        supportWa: '' 
    };

    const [config, setConfig] = useState(defaultConfig);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // ✅ ESTADO PARA EL ACORDEÓN (Inicia con 'videos' abierto)
    const [openSection, setOpenSection] = useState('videos');

    const toggleSection = (sectionName) => {
        setOpenSection(prev => prev === sectionName ? null : sectionName);
    };

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

    useEffect(() => {
        if (settings && Array.isArray(settings)) {
            const saved = settings.find(s => s.id === 'support_config');
            if (saved) {
                let loadedVideos = saved.videos || [];
                // Migración de datos viejos si existen
                if (!saved.videos && (saved.ytClients || saved.ytProfs || saved.ytAgenda)) {
                    if (saved.ytClients) loadedVideos.push({ id: 101, title: 'Clientes', url: saved.ytClients });
                    if (saved.ytProfs) loadedVideos.push({ id: 102, title: 'Profesionales', url: saved.ytProfs });
                    if (saved.ytAgenda) loadedVideos.push({ id: 103, title: 'Agenda', url: saved.ytAgenda });
                }
                setConfig(prev => ({ ...prev, ...saved, videos: loadedVideos.length > 0 ? loadedVideos : prev.videos }));
            }
        }
    }, [settings]);

    const handleSave = (e) => {
        e.preventDefault();
        const newSettings = settings.filter(s => s.id !== 'support_config');
        newSettings.push({...config, id: 'support_config'});
        saveSettings(newSettings);
        setIsEditing(false);
        notify("Configuración de soporte actualizada", "success");
    };

    const addVideo = () => setConfig(prev => ({ ...prev, videos: [...prev.videos, { id: Date.now(), title: '', url: '' }] }));
    const removeVideo = (id) => setConfig(prev => ({ ...prev, videos: prev.videos.filter(v => v.id !== id) }));
    const updateVideo = (id, field, value) => setConfig(prev => ({ ...prev, videos: prev.videos.map(v => v.id === id ? { ...v, [field]: value } : v) }));

    const getVideoId = (url) => {
        if (!url) return null;
        let videoId = '';
        if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return videoId;
    };
    
    const getEmbedUrl = (url) => {
        const videoId = getVideoId(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    };

    const activeVideos = config.videos.filter(v => v.url && v.url.trim() !== '');

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto relative h-full bg-brand-bg">
            
            {/* MODAL REPRODUCTOR DE VIDEO */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[500] p-4 md:p-10 animate-fade-in">
                    <div className="bg-black rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col border border-gray-800">
                        <div className="flex justify-between items-center p-4 bg-gray-900/80 border-b border-gray-800">
                            {/* ACHICADO A text-base */}
                            <h3 className="font-bold text-base text-white truncate pr-4 flex items-center gap-2">
                                <Icon name="play-circle" className="text-red-500"/>
                                {selectedVideo.title || 'Video Instructivo'}
                            </h3>
                            <button onClick={() => setSelectedVideo(null)} className="text-gray-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full">
                                <Icon name="x" size={18}/>
                            </button>
                        </div>
                        <div className="aspect-video w-full bg-black relative">
                            {/* Mostramos un loader mientras carga el iframe */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Icon name="loader" size={32} className="text-gray-600 animate-spin"/>
                            </div>
                            <iframe className="w-full h-full relative z-10" src={getEmbedUrl(selectedVideo.url)} title={selectedVideo.title} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen></iframe>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <img src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" alt="HaceClick" className="h-10 sm:h-12 opacity-90 object-contain shrink-0" />
                        <div className="hidden sm:block h-10 w-px bg-gray-300"></div>
                        <div>
                            {/* ACHICADO A text-2xl */}
                            <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-3">
                                <Icon name="help-circle" className="text-[#008395] hidden sm:block"/> 
                                Capacitación & Soporte
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">Aprende a usar la plataforma o contáctate con nosotros.</p>
                        </div>
                    </div>
                    {canConfigure && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0 text-sm">
                            <Icon name="settings" size={16}/> Configurar
                        </button>
                    )}
                </div>
            </header>

            {isEditing && canConfigure ? (
                <form onSubmit={handleSave} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-brand-border mb-8 animate-fade-in">
                    {/* ACHICADO A text-base */}
                    <h3 className="font-bold text-base mb-6 flex items-center gap-2 text-gray-800 border-b pb-3"><Icon name="edit-3"/> Ajustes del Centro de Ayuda</h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h4 className="font-bold text-xs text-[#008395] uppercase tracking-wider mb-4 flex items-center gap-2"><Icon name="phone" size={16}/> Canales de Contacto</h4>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Email de Soporte Oficial</label><input type="email" required className="w-full border border-gray-200 p-3 rounded-lg focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 outline-none transition-all text-sm" value={config.supportEmail} onChange={e=>setConfig({...config, supportEmail: e.target.value})} placeholder="soporte@haceclick.com"/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">WhatsApp de Soporte (con código país, sin +)</label><input type="tel" required className="w-full border border-gray-200 p-3 rounded-lg focus:border-[#008395] focus:ring-2 focus:ring-[#008395]/20 outline-none transition-all text-sm" value={config.supportWa} onChange={e=>setConfig({...config, supportWa: e.target.value})} placeholder="Ej: 5491155554444"/></div>
                        </div>
                        
                        <div>
                            <h4 className="font-bold text-xs text-[#008395] uppercase tracking-wider mb-4 flex items-center gap-2"><Icon name="youtube" size={16}/> Videos Instructivos</h4>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {config.videos.map((vid) => (
                                    <div key={vid.id} className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-inner">
                                        <div className="flex-1"><input type="text" className="w-full border p-2 text-sm rounded-lg focus:border-[#008395] outline-none" value={vid.title} onChange={e=>updateVideo(vid.id, 'title', e.target.value)} placeholder="Título..."/></div>
                                        <div className="flex-1"><input type="url" className="w-full border p-2 text-sm rounded-lg focus:border-[#008395] outline-none" value={vid.url} onChange={e=>updateVideo(vid.id, 'url', e.target.value)} placeholder="Link YouTube..."/></div>
                                        <button type="button" onClick={() => removeVideo(vid.id)} className="p-2 bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors" title="Quitar video"><Icon name="trash-2" size={16}/></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addVideo} className="mt-4 bg-[#008395]/10 text-[#008395] px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-[#008395]/20 transition-colors w-full justify-center">
                                <Icon name="plus-circle" size={16}/> Agregar otro video
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t flex justify-end gap-3">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-[#008395] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-[#006a78] transition-colors flex items-center gap-2 text-sm">
                            <Icon name="save" size={18}/> Guardar Cambios
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4 pb-20">
                    
                    {/* SECCIÓN 1: VIDEOS */}
                    <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                        <button 
                            type="button" 
                            onClick={() => toggleSection('videos')}
                            className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'videos' ? 'border-b border-gray-100' : ''}`}
                        >
                            {/* ACHICADO A text-base */}
                            <h3 className="font-bold text-base flex items-center gap-2 text-gray-800"><Icon name="youtube" className="text-red-500"/> Instructivos en Video</h3>
                            <Icon name={openSection === 'videos' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                        </button>

                        {openSection === 'videos' && (
                            <div className="p-6 animate-fade-in bg-gray-50/50">
                                {activeVideos.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                                        <Icon name="video-off" size={40} className="mb-3 opacity-50"/>
                                        <p className="text-sm font-medium">Aún no hay videos instructivos cargados.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                                        {activeVideos.map((vid, idx) => {
                                            const videoId = getVideoId(vid.url);
                                            // Usamos mqdefault o hqdefault para mejor calidad de miniatura
                                            const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
                                            return (
                                                <button key={idx} onClick={() => videoId ? setSelectedVideo(vid) : null}
                                                    className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-red-300 hover:-translate-y-1 transition-all group text-left flex flex-col"
                                                >
                                                    <div className="aspect-video w-full bg-gray-100 relative">
                                                        {thumbUrl 
                                                            ? <img src={thumbUrl} alt="Thumbnail" className="w-full h-full object-cover"/>
                                                            : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Link inválido</div>
                                                        }
                                                        {/* Play Button Overlay */}
                                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                            <div className="w-10 h-10 bg-red-600/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                                                <Icon name="play" size={18} className="ml-0.5"/>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 flex-1 flex flex-col justify-center">
                                                        <p className="font-bold text-gray-800 text-xs line-clamp-2 leading-tight text-center">{vid.title || 'Video sin título'}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN 2: CONTACTO (Email y WhatsApp lado a lado si la pantalla es ancha) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* TARJETA EMAIL */}
                        {config.supportEmail && (
                            <div className={`bg-gradient-to-br from-[#008395] to-[#005f6b] rounded-brand shadow-sm border border-[#004a54] overflow-hidden transition-all relative group ${openSection === 'email' ? 'row-span-2' : ''}`}>
                                <Icon name="mail" size={120} className="absolute -bottom-4 -right-4 text-white opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500 pointer-events-none"/>
                                <button 
                                    type="button" 
                                    onClick={() => toggleSection('email')}
                                    className="w-full flex justify-between items-center p-6 transition-colors relative z-10"
                                >
                                    {/* ACHICADO A text-base */}
                                    <h3 className="font-bold text-base flex items-center gap-2 text-white"><Icon name="mail" size={18}/> Correo Directo</h3>
                                    <Icon name={openSection === 'email' ? 'chevron-up' : 'chevron-down'} className="text-white/70"/>
                                </button>

                                {openSection === 'email' && (
                                    <div className="p-6 pt-0 animate-fade-in relative z-10 flex flex-col h-full">
                                        <p className="text-white/80 text-sm mb-4">Redacta tu consulta y llegará a nuestra bandeja de entrada administrativa.</p>
                                        <form className="flex-1 flex flex-col" onSubmit={(e) => {
                                            e.preventDefault();
                                            if(!config.supportEmail) { notify("El administrador no configuró un correo de soporte.", "error"); return; }
                                            const body = e.target.mensaje.value;
                                            const btn = e.target.querySelector('button[type="submit"]');
                                            if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }
                                            google.script.run
                                                .withSuccessHandler((res) => {
                                                    if (res.success) { notify(res.message, "success"); e.target.reset(); } 
                                                    else notify(res.message, "error");
                                                    if (btn) { btn.disabled = false; btn.textContent = "Enviar Mensaje"; }
                                                })
                                                .sendSupportEmail(config.supportEmail, user.email, user.businessName || 'Local', body);
                                        }}>
                                            <textarea name="mensaje" required rows="4" 
                                                className="flex-1 w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/50 outline-none focus:bg-white/20 focus:border-white/40 resize-none mb-4 transition-colors text-sm"
                                                placeholder="Describe detalladamente tu problema o consulta...">
                                            </textarea>
                                            <div className="flex justify-end mt-auto">
                                                <button type="submit" className="bg-white text-[#008395] px-6 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg w-full md:w-auto text-sm">
                                                    <Icon name="send" size={16}/> Enviar
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TARJETA WHATSAPP */}
                        {config.supportWa && (
                            <div className={`bg-white rounded-brand shadow-sm border border-gray-200 overflow-hidden transition-all relative group ${openSection === 'whatsapp' ? 'row-span-2' : ''}`}>
                                <div className="absolute top-0 left-0 w-full h-1 bg-[#25D366]"></div>
                                <Icon name="message-circle" size={120} className="absolute -bottom-4 -right-4 text-[#25D366] opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500 pointer-events-none"/>
                                <button 
                                    type="button" 
                                    onClick={() => toggleSection('whatsapp')}
                                    className="w-full flex justify-between items-center p-6 hover:bg-gray-50 transition-colors relative z-10"
                                >
                                    {/* ACHICADO A text-base */}
                                    <h3 className="font-bold text-base flex items-center gap-2 text-gray-800"><Icon name="message-circle" className="text-[#25D366]" size={18}/> Chat Rápido</h3>
                                    <Icon name={openSection === 'whatsapp' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                                </button>

                                {openSection === 'whatsapp' && (
                                    <div className="p-6 pt-0 animate-fade-in relative z-10 flex flex-col h-full">
                                        <p className="text-gray-500 text-sm mb-4">Escribe tu mensaje aquí y se enviará directo a nuestro WhatsApp Oficial.</p>
                                        <form className="flex-1 flex flex-col" onSubmit={(e) => {
                                            e.preventDefault();
                                            if(!config.supportWa) { notify("El administrador no configuró un número de WhatsApp.", "error"); return; }
                                            
                                            // ✅ AHORA UTILIZAMOS LA NAVAJA SUIZA Y EL TRUCO DEL ENLACE
                                            const text = e.target.waMensaje.value;
                                            const cleanPhone = getCleanPhone(config.supportWa);
                                            const encodedText = encodeURIComponent(`Hola soporte de HaceClick, soy del local "${user?.businessName || user?.email}".\n\nConsulta: ${text}`);
                                            const url = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
                                            
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.target = '_top';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            
                                            e.target.reset();
                                        }}>
                                            <textarea name="waMensaje" required rows="4" 
                                                className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 placeholder-gray-400 outline-none focus:bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 resize-none mb-4 transition-all text-sm"
                                                placeholder="Escribe aquí tu duda o problema rápido...">
                                            </textarea>
                                            <div className="flex justify-end mt-auto">
                                                <button type="submit" className="bg-[#25D366] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2 shadow-lg w-full md:w-auto text-sm">
                                                    <Icon name="send" size={16}/> Abrir WhatsApp
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
