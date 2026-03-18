
// --- 1. COMPONENTE DE LOGIN (CON MODO ADMINISTRACIÓN Y FORZADO DE CLAVE) ---
const LoginScreen = ({ onLogin, notify }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    
    // Estados de vistas: 'login', 'recover', 'force_password'
    const [view, setView] = useState('login'); 
    const [recoverEmail, setRecoverEmail] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);

    // Estado para forzar cambio
    const [forcePassUser, setForcePassUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [isChangingPass, setIsChangingPass] = useState(false);

    const handleSuccessLogin = (userOrComp) => {
        if (userOrComp.needsPasswordChange) {
            setForcePassUser(userOrComp);
            setView('force_password');
        } else {
            onLogin(userOrComp);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsChecking(true);
        google.script.run
            .withSuccessHandler((res) => {
                setIsChecking(false);
                if (res.success) {
                    if (res.isMultiTenant && res.companies.length > 0) {
                        setAvailableCompanies(res.companies);
                    } else {
                        handleSuccessLogin(res.user);
                    }
                } else {
                    notify(res.message, 'error');
                }
            })
            .withFailureHandler(() => { setIsChecking(false); notify('Error de conexión', 'error'); })
            .authenticateUser(email, password);
    };

    const handleRecover = (e) => {
        e.preventDefault();
        setIsRecovering(true);
        google.script.run
            .withSuccessHandler((res) => {
                setIsRecovering(false);
                if (res.success) {
                    notify(res.message, 'success');
                    setView('login');
                    setRecoverEmail('');
                } else notify(res.message, 'error');
            })
            .recoverPassword(recoverEmail);
    };

    const handleChangePassword = (e) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            notify("La contraseña debe tener al menos 6 caracteres", "error");
            return;
        }
        setIsChangingPass(true);
        google.script.run
            .withSuccessHandler((res) => {
                setIsChangingPass(false);
                if (res.success) {
                    notify("Contraseña actualizada con éxito", "success");
                    // Ingresamos automáticamente
                    onLogin({...forcePassUser, needsPasswordChange: false});
                } else notify(res.message, 'error');
            })
            .updateUserPassword(forcePassUser.email, newPassword);
    };

    if (availableCompanies.length > 0 && view !== 'force_password') {
        const isSuper = availableCompanies[0]?.isSuperAdmin;
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-100 p-4 font-sans text-center">
                <div className="bg-white p-8 rounded-[20px] shadow-2xl w-full max-w-[400px]">
                    <div className="mb-6"><img src="https://i.postimg.cc/6QMLthk0/CENTRADO-SIN-FONDO.png" alt="Logo" className="h-20 object-contain mx-auto" /></div>
                    
                    {/* --- BOTÓN ESPECIAL PARA SUPER ADMIN (MODO ADMINISTRACIÓN) --- */}
                    {isSuper && (
                        <div className="mb-8 p-1 bg-gradient-to-r from-[#008395] to-[#1e293b] rounded-2xl">
                            <button 
                                onClick={() => handleSuccessLogin({ 
                                    ...availableCompanies[0], 
                                    spreadsheetId: null, 
                                    businessName: 'HaceClick SaaS', 
                                    role: 'admin', 
                                    isMasterPanel: true 
                                })}
                                className="w-full bg-white p-4 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-4 group"
                            >
                                <div className="bg-[#008395] text-white p-2.5 rounded-lg shadow-lg group-hover:scale-110 transition-transform">
                                    <Icon name="shield-check" size={24} />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-[#008395] text-sm tracking-tight">MODO ADMINISTRACIÓN</p>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Gestión Global HaceClick</p>
                                </div>
                            </button>
                        </div>
                    )}

                    <h3 className="font-bold text-gray-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2 justify-center"><span className="h-[1px] w-8 bg-gray-200"></span>{isSuper ? 'O entrar a un Local' : 'Selecciona tu Empresa'}<span className="h-[1px] w-8 bg-gray-200"></span></h3>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {availableCompanies.map((comp, idx) => {
                            if (isSuper && !comp.spreadsheetId) return null;
                            return (
                                <button key={idx} onClick={() => handleSuccessLogin(comp)} className="w-full p-4 border border-gray-100 rounded-xl hover:bg-gray-50 hover:border-[#008395] transition-all flex items-center justify-between group">
                                    <div className="text-left"><p className="font-bold text-gray-700">{comp.businessName || "Empresa"}</p></div>
                                    <Icon name="chevron-right" size={18} className="text-gray-300" />
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => setAvailableCompanies([])} className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">← Volver al Login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
            <div className="bg-white p-10 rounded-[25px] shadow-2xl w-full max-w-[380px]">
                <div className="mb-10"><img src="https://i.postimg.cc/6QMLthk0/CENTRADO-SIN-FONDO.png" alt="HaceClick.ai" className="h-32 object-contain mx-auto" /></div>
                
                {view === 'login' && (
                    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
                        <div className="relative"><Icon name="mail" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="email" required className="w-full pl-10 pr-4 py-3 border rounded-xl" placeholder="Tu Email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                        <div className="relative"><Icon name="lock" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="password" required className="w-full pl-10 pr-4 py-3 border rounded-xl" placeholder="Tu Contraseña" value={password} onChange={e => setPassword(e.target.value)} /></div>
                        <button type="submit" disabled={isChecking} className="w-full bg-[#008395] text-white font-bold py-4 rounded-xl shadow-lg">{isChecking ? "Verificando..." : "Entrar al Sistema"}</button>
                        <div className="pt-2"><button type="button" onClick={() => setView('recover')} className="text-xs font-bold text-gray-400 underline">¿Olvidaste tu contraseña?</button></div>
                    </form>
                )}

                {view === 'recover' && (
                    <form onSubmit={handleRecover} className="space-y-5 animate-fade-in">
                        <h3 className="font-bold text-gray-800">Recuperar Acceso</h3>
                        <p className="text-xs text-gray-500 mb-4">Ingresa tu correo y te enviaremos una clave temporal.</p>
                        <div className="relative"><Icon name="mail" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="email" required className="w-full pl-10 pr-4 py-3 border rounded-xl" placeholder="Correo registrado" value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)} /></div>
                        <button type="submit" disabled={isRecovering} className="w-full bg-[#1e293b] text-white font-bold py-4 rounded-xl shadow-lg">{isRecovering ? "Enviando..." : "Solicitar Clave"}</button>
                        <div className="pt-2"><button type="button" onClick={() => setView('login')} className="text-xs font-bold text-gray-400 uppercase tracking-widest">← Volver Atrás</button></div>
                    </form>
                )}

                {view === 'force_password' && (
                    <form onSubmit={handleChangePassword} className="space-y-5 animate-fade-in">
                        <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-2"><Icon name="shield-alert" size={32}/></div>
                        <h3 className="font-bold text-gray-800">Cambio Obligatorio</h3>
                        <p className="text-xs text-gray-500 mb-4">Estás usando una contraseña temporal. Por tu seguridad, debes crear una nueva clave definitiva.</p>
                        <div className="relative"><Icon name="lock" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="password" required minLength="6" className="w-full pl-10 pr-4 py-3 border rounded-xl" placeholder="Nueva Contraseña" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
                        <button type="submit" disabled={isChangingPass} className="w-full bg-[#008395] text-white font-bold py-4 rounded-xl shadow-lg">{isChangingPass ? "Guardando..." : "Guardar e Ingresar"}</button>
                    </form>
                )}
            </div>
        </div>
    );
};
// --- 2. SIDEBAR ---
const Sidebar = ({ currentView, setCurrentView, isOpen, setIsOpen, user, customLogo, brandConfig }) => {

    const getClientLink = () => {
        let url = window.SCRIPT_URL || window.location.href.split('?')[0];
        url = url.replace(/\/dev$/, '/exec');
        let tenantEmail = (user?.role === 'professional') ? user.adminEmail : user.email;
        const tenantParam = tenantEmail ? `&tenant=${encodeURIComponent(tenantEmail)}` : '';
        return url.includes('?') ? `${url}&view=client${tenantParam}` : `${url}?view=client${tenantParam}`;
    };

    const menuItems = [
        { id: 'dashboard', label: 'Panel General', icon: 'layout-dashboard', roles: ['admin', 'manager'] },
        { id: 'agenda', label: 'Agenda', icon: 'calendar', roles: ['admin', 'manager', 'professional'] },
        { id: 'clients', label: 'Clientes', icon: 'users', roles: ['admin', 'manager'] },
        { id: 'professionals', label: 'Profesionales', icon: 'briefcase', roles: ['admin', 'manager'] },
        { id: 'treatments', label: 'Servicios', icon: 'tag', roles: ['admin', 'manager'] },
        { id: 'billing', label: 'Facturación', icon: 'receipt', roles: ['admin', 'manager'] },
        { id: 'stats', label: 'Estadísticas', icon: 'bar-chart-2', roles: ['admin', 'manager', 'professional'] },
        { id: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin', 'manager'] },
        { id: 'agent', label: 'Agente IA', icon: 'bot', roles: ['admin'] },
        { id: 'superadmin', label: 'Admin Sistema', icon: 'shield-check', roles: ['admin', 'manager'], visible: user?.isSuperAdmin === true }
    ].filter(item => item.roles.includes(user?.role) && (item.visible === undefined || item.visible === true));

    return (
        <div 
            className={`fixed md:static inset-y-0 left-0 z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 w-72 flex flex-col shadow-2xl shrink-0`} 
            style={{ backgroundColor: brandConfig.sidebarBg || '#111827' }}
        >
            <div className="p-8 flex flex-col items-center justify-center min-h-[160px]">
                {customLogo ? (
                    <img src={customLogo} alt="Logo" className="w-[85%] max-h-40 object-contain drop-shadow-xl" />
                ) : (
                    <Logo className="h-12" />
                )}
            </div>

            {/* ZONA DE SCROLL: Menús principales */}
            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
                {menuItems.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => { setCurrentView(item.id); setIsOpen(false); }} 
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-normal hover:opacity-80 transition-opacity"
                            style={{ 
                                backgroundColor: isActive ? (brandConfig.primaryColor || '#008395') : 'transparent',
                                color: isActive ? (brandConfig.sidebarActive || '#ffffff') : (brandConfig.sidebarText || '#9ca3af')
                            }}
                        >
                            <Icon name={item.icon} size={20} style={{ color: isActive ? (brandConfig.sidebarActive || '#ffffff') : 'inherit' }} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* ZONA INFERIOR FIJA: Botón de Soporte SEPARADO */}
            <div className="px-4 py-3 border-t mt-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <button 
                    onClick={() => { setCurrentView('support'); setIsOpen(false); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-normal hover:opacity-80 transition-opacity"
                    style={{ 
                        backgroundColor: currentView === 'support' ? (brandConfig.primaryColor || '#008395') : 'transparent',
                        color: currentView === 'support' ? (brandConfig.sidebarActive || '#ffffff') : (brandConfig.sidebarText || '#9ca3af')
                    }}
                >
                    <Icon name="help-circle" size={20} style={{ color: currentView === 'support' ? (brandConfig.sidebarActive || '#ffffff') : 'inherit' }} />
                    Soporte y Ayuda
                </button>
            </div>

            {/* ZONA INFERIOR FIJA: Perfil de Usuario y Logout */}
            <div className="p-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-md"
                        style={{ backgroundColor: brandConfig.primaryColor || '#008395', color: '#ffffff' }}
                    >
                        {(user?.email || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: brandConfig.sidebarActive || '#ffffff' }}>
                            {user?.email}
                        </p>
                        <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold" style={{ color: brandConfig.sidebarText || '#9ca3af' }}>
                            {user?.role}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shrink-0 shadow-lg active:scale-95"
                    title="Cerrar Sesión"
                >
                    <Icon name="log-out" size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Salir</span>
                </button>
            </div>
        </div>
    );
};

const AgentBuilderWrapper = (props) => {
    const [Component, setComponent] = useState(null);
    useEffect(() => {
        if (window.AgentBuilder) setComponent(() => window.AgentBuilder);
        else { const i = setInterval(() => { if (window.AgentBuilder) { setComponent(() => window.AgentBuilder); clearInterval(i); } }, 200); return () => clearInterval(i); }
    }, []);
    if (!Component) return <div className="h-full flex items-center justify-center text-gray-400 animate-pulse"><Icon name="loader" className="animate-spin" /></div>;
    return <Component {...props} />;
};


// --- 3. APP PRINCIPAL (SÚPER ADMIN PANEL) ---
const SuperAdminPanel = ({ notify, user }) => {
    // ESTADOS CREAR
    const [form, setForm] = useState({ email: '', pass: '', name: '', rubro: '' });
    const [loading, setLoading] = useState(false);
    
    // ESTADOS MENSAJERÍA GLOBAL
    const [messages, setMessages] = useState([]);
    const [msgForm, setMsgForm] = useState({ target: 'ALL', title: '', message: '' });
    const [sendingMsg, setSendingMsg] = useState(false);
    const [editingMsgId, setEditingMsgId] = useState(null);

    // ESTADOS GESTIONAR (TABLA)
    const [tenants, setTenants] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', pass: '' });
    
    const [deleteTarget, setDeleteTarget] = useState(null);

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
        
        google.script.run
            .withSuccessHandler(res => {
                setSendingMsg(false);
                if (res.success) {
                    notify(res.message, "success");
                    setMessages(updatedMsgs);
                    setMsgForm({ target: 'ALL', title: '', message: '' }); 
                    setEditingMsgId(null);
                } else {
                    notify(res.message, "error");
                }
            })
            .saveGlobalMessagesList(user.email, updatedMsgs);
    };

    const handleDeleteMsg = (id) => {
        const updatedMsgs = messages.filter(m => m.id !== id);
        notify("Borrando mensaje...", "info");
        google.script.run
            .withSuccessHandler(res => {
                if (res.success) {
                    notify("Aviso eliminado.", "success");
                    setMessages(updatedMsgs);
                }
            })
            .saveGlobalMessagesList(user.email, updatedMsgs);
    };

    const startEditMsg = (m) => {
        setMsgForm({ target: m.target, title: m.title, message: m.message });
        setEditingMsgId(m.id);
        document.getElementById('msg-form').scrollIntoView({ behavior: 'smooth' });
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
        <div className="p-8 max-w-6xl mx-auto space-y-10 relative">
            
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar Acceso?</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Se borrará el acceso para <strong>{deleteTarget.name}</strong>.<br/>
                                <span className="text-xs text-red-500">El archivo de Excel quedará en Drive por seguridad.</span>
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border font-bold text-gray-600">Cancelar</button>
                                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Sí, Eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FORMULARIO CREAR CLIENTE */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">Alta de Nuevo Cliente</h2>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Empresa</label>
                                    <input required className="w-full border p-3 rounded-xl outline-none focus:border-gray-400" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Nombre comercial"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rubro</label>
                                    <select required className="w-full border p-3 rounded-xl outline-none bg-white focus:border-gray-400" value={form.rubro} onChange={e=>setForm({...form, rubro: e.target.value})}>
                                        <option value="">Seleccionar...</option>
                                        <option value="Estetica">Estética</option>
                                        <option value="Barberia">Barbería</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email Dueño</label>
                                    <input required type="email" className="w-full border p-3 rounded-xl outline-none focus:border-gray-400" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="ejemplo@correo.com"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Contraseña</label>
                                    <input required className="w-full border p-3 rounded-xl outline-none focus:border-gray-400" value={form.pass} onChange={e=>setForm({...form, pass: e.target.value})} placeholder="Clave temporal"/>
                                </div>
                            </div>
                            <div className="pt-4">
                                <button disabled={loading} className="w-full bg-[#1e293b] text-white p-4 rounded-xl font-bold shadow-lg hover:bg-black transition-colors">
                                    {loading ? "Creando..." : "Generar Empresa y Base de Datos"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* MENSAJERÍA GLOBAL (CON HISTORIAL) */}
                <div id="msg-form">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Icon name="message-square" className="text-blue-500"/> Notificaciones</h2>
                    <div className="bg-blue-50 p-6 rounded-2xl shadow-lg border border-blue-100">
                        <form onSubmit={handleSaveMsg} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Destinatario</label>
                                    <select required className="w-full border border-blue-200 p-3 rounded-xl outline-none bg-white text-blue-900 focus:border-blue-400" value={msgForm.target} onChange={e=>setMsgForm({...msgForm, target:e.target.value})}>
                                        <option value="ALL">📢 A Todas las Empresas</option>
                                        <optgroup label="Específico">
                                            {tenants.map(t => <option key={t.sheetId} value={t.sheetId}>{t.businessName}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Título del Aviso</label>
                                    <input required type="text" className="w-full border border-blue-200 p-3 rounded-xl outline-none focus:border-blue-400 text-blue-900" value={msgForm.title} onChange={e=>setMsgForm({...msgForm, title:e.target.value})} placeholder="Ej: Nueva Función"/>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label className="block text-[10px] font-bold uppercase text-blue-800 mb-1">Mensaje</label>
                                <textarea required className="w-full border border-blue-200 p-3 rounded-xl outline-none resize-none focus:border-blue-400 text-blue-900" rows="3" value={msgForm.message} onChange={e=>setMsgForm({...msgForm, message:e.target.value})} placeholder="Escribe el mensaje aquí..."></textarea>
                            </div>
                            <div className="pt-2 flex gap-2">
                                {editingMsgId && <button type="button" onClick={() => {setEditingMsgId(null); setMsgForm({target:'ALL', title:'', message:''})}} className="w-1/3 border border-blue-300 text-blue-700 p-3 rounded-xl font-bold hover:bg-blue-100 transition-colors">Cancelar</button>}
                                <button disabled={sendingMsg} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                    <Icon name={editingMsgId ? "save" : "send"} size={18}/> {sendingMsg ? "Procesando..." : (editingMsgId ? "Guardar Cambios" : "Publicar Aviso")}
                                </button>
                            </div>
                        </form>
                        
                        {/* LISTADO DE MENSAJES ENVIADOS */}
                        {messages.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-blue-200">
                                <p className="text-[10px] font-bold uppercase text-blue-800 mb-3">Avisos Activos</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {messages.map(m => (
                                        <div key={m.id} className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center group">
                                            <div className="overflow-hidden pr-2">
                                                <div className="flex items-center gap-2">
                                                    {m.target === 'ALL' ? <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 rounded font-bold uppercase">GLOBAL</span> : <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 rounded font-bold uppercase truncate max-w-[100px]">{tenants.find(t=>t.sheetId===m.target)?.businessName || 'Específico'}</span>}
                                                    <span className="font-bold text-sm text-blue-900 truncate">{m.title}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">{m.message}</p>
                                            </div>
                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={()=>startEditMsg(m)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Icon name="edit-2" size={14}/></button>
                                                <button onClick={()=>handleDeleteMsg(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Icon name="trash-2" size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TABLA LISTADO DE EMPRESAS (Se mantiene idéntico) */}
            <div>
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Empresas Activas ({tenants.length})</h2>
                        <p className="text-sm text-gray-500 mt-1">Listado de bases de datos operativas en el servidor.</p>
                    </div>
                    <button onClick={loadTenants} className="p-3 bg-white rounded-xl shadow-sm border text-gray-600 hover:text-blue-600 transition-colors">
                        <Icon name="refresh-cw" size={18} className={loadingList ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b text-[10px] uppercase text-gray-400 font-bold">
                                <tr>
                                    <th className="p-4">Empresa</th>
                                    <th className="p-4">Email Dueño</th>
                                    <th className="p-4">Contraseña App</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-sm">
                                {tenants.map((client, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-gray-800">
                                            {editingId === client.sheetId 
                                                ? <input className="border border-blue-300 p-1.5 rounded w-full outline-none" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})}/> 
                                                : client.businessName}
                                        </td>
                                        <td className="p-4 text-gray-500">{client.email}</td>
                                        <td className="p-4 font-mono text-gray-600">
                                            {editingId === client.sheetId 
                                                ? <input className="border border-blue-300 p-1.5 rounded w-24 outline-none" value={editForm.pass} onChange={e=>setEditForm({...editForm, pass:e.target.value})}/> 
                                                : <span className="bg-gray-100 px-2 py-1 rounded">{client.password}</span>}
                                        </td>
                                        <td className="p-4 flex justify-center gap-2">
                                            {editingId === client.sheetId ? (
                                                <>
                                                    <button onClick={()=>saveEdit(client.sheetId)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors" title="Guardar"><Icon name="check" size={16}/></button>
                                                    <button onClick={()=>setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Cancelar"><Icon name="x" size={16}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={()=>startEdit(client)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Icon name="edit-2" size={16}/></button>
                                                    <button onClick={()=>setDeleteTarget({id:client.sheetId, name:client.businessName})} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Borrar"><Icon name="trash-2" size={16}/></button>
                                                    <a href={`https://docs.google.com/spreadsheets/d/${client.sheetId}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-lg transition-colors" title="Abrir Base de Datos"><Icon name="sheet" size={16}/></a>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
// --- NUEVO COMPONENTE DE SOPORTE E INSTRUCTIVOS (DISEÑO OPTIMIZADO) ---
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
    
    // NUEVO ESTADO: Para abrir el video en tamaño grande
    const [selectedVideo, setSelectedVideo] = useState(null);

    useEffect(() => {
        if (settings && Array.isArray(settings)) {
            const saved = settings.find(s => s.id === 'support_config');
            if (saved) {
                let loadedVideos = saved.videos || [];
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

    // Funciones para extraer ID y Links de YouTube
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
        <div className="p-4 md:p-8 h-full bg-brand-bg overflow-y-auto custom-scrollbar relative">
            
            {/* MODAL DE REPRODUCTOR DE VIDEO */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[500] p-4 md:p-10 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800 truncate pr-4">{selectedVideo.title || 'Video Instructivo'}</h3>
                            <button onClick={() => setSelectedVideo(null)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-100 hover:bg-red-50 p-2 rounded-full">
                                <Icon name="x" size={20}/>
                            </button>
                        </div>
                        <div className="aspect-video w-full bg-black">
                            <iframe className="w-full h-full" src={getEmbedUrl(selectedVideo.url)} title={selectedVideo.title} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* ENCABEZADO */}
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
                <div>
                    {/* Contenedor flex para alinear Logo y Título uno al lado del otro */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-3">
                        <img 
                            src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" 
                            alt="HaceClick" 
                            className="h-10 sm:h-14 opacity-90 object-contain shrink-0" 
                        />
                        {/* Línea vertical divisoria (solo visible en pantallas medianas/grandes) */}
                        <div className="hidden sm:block h-10 w-px bg-gray-300"></div>
                        
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <Icon name="help-circle" className="text-[#008395] hidden sm:block"/> 
                            Capacitación & Soporte
                        </h2>
                    </div>
                    <p className="text-gray-500 mt-1">Aprende a usar la plataforma o contáctate con nuestro equipo.</p>
                </div>
                
                {canConfigure && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-colors shrink-0 mb-1">
                        <Icon name="edit" size={16}/> Configurar Soporte
                    </button>
                )}
            </header>

            {isEditing && canConfigure ? (
                <form onSubmit={handleSave} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-brand-border mb-8 animate-fade-in">
                    {/* ... (Todo el formulario de edición se mantiene exactamente igual que antes) ... */}
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-800 border-b pb-3"><Icon name="settings"/> Ajustes del Centro de Ayuda</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-[#008395] uppercase tracking-wider mb-4 flex items-center gap-2"><Icon name="phone" size={16}/> Canales de Contacto</h4>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Email de Soporte Oficial</label><input type="email" required className="w-full border p-3 rounded-lg focus:border-[#008395] outline-none" value={config.supportEmail} onChange={e=>setConfig({...config, supportEmail: e.target.value})} placeholder="soporte@haceclick.com"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">WhatsApp de Soporte (con código país, sin +)</label><input type="tel" required className="w-full border p-3 rounded-lg focus:border-[#008395] outline-none" value={config.supportWa} onChange={e=>setConfig({...config, supportWa: e.target.value})} placeholder="Ej: 5491155554444"/></div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-[#008395] uppercase tracking-wider mb-4 flex items-center gap-2"><Icon name="youtube" size={16}/> Videos Instructivos</h4>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {config.videos.map((vid) => (
                                    <div key={vid.id} className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                        <div className="flex-1"><input type="text" className="w-full border p-2 text-sm rounded focus:border-[#008395] outline-none" value={vid.title} onChange={e=>updateVideo(vid.id, 'title', e.target.value)} placeholder="Título..."/></div>
                                        <div className="flex-1"><input type="url" className="w-full border p-2 text-sm rounded focus:border-[#008395] outline-none" value={vid.url} onChange={e=>updateVideo(vid.id, 'url', e.target.value)} placeholder="Link YouTube..."/></div>
                                        <button type="button" onClick={() => removeVideo(vid.id)} className="p-2 bg-white text-red-500 border border-red-200 rounded hover:bg-red-50"><Icon name="trash-2" size={16}/></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addVideo} className="mt-4 text-[#008395] font-bold text-sm flex items-center gap-2 hover:opacity-70 transition-opacity"><Icon name="plus-circle" size={18}/> Agregar otro video</button>
                        </div>
                    </div>
                    <div className="mt-8 pt-4 border-t flex justify-end gap-3">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                        <button type="submit" className="bg-[#008395] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-[#006a78] transition-colors flex items-center gap-2"><Icon name="save" size={18}/> Guardar Cambios</button>
                    </div>
                </form>
            ) : (
                <div className="space-y-8 animate-fade-in">
                    
                    {/* 1. INSTRUCTIVOS YOUTUBE (ARRIBA Y COMPACTOS) */}
                    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-brand-border">
                        <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-800"><Icon name="youtube" className="text-red-500"/> Instructivos en Video</h3>
                        {activeVideos.length === 0 ? (
                            <p className="text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center border border-dashed border-gray-300">Aún no hay videos instructivos cargados.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {activeVideos.map((vid, idx) => {
                                    const videoId = getVideoId(vid.url);
                                    const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
                                    
                                    return (
                                        <button 
                                            key={idx} 
                                            onClick={() => videoId ? setSelectedVideo(vid) : null}
                                            className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group text-left flex flex-col"
                                        >
                                            <div className="aspect-video w-full bg-gray-200 relative">
                                                {thumbUrl ? (
                                                    <img src={thumbUrl} alt="Thumbnail" className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Link inválido</div>
                                                )}
                                                {/* Icono de Play sobre la imagen */}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                                        <Icon name="play" size={20} className="ml-1"/>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white flex-1">
                                                <p className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight">{vid.title || 'Video sin título'}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 2. ZONA DE CONTACTO (ABAJO Y APILADAS UNA SOBRE OTRA) */}
                    <div className="flex flex-col gap-6">
                        
                        {/* TARJETA EMAIL */}
                        {config.supportEmail && (
                            <div className="bg-gradient-to-br from-[#008395] to-[#005f6b] p-6 md:p-8 rounded-2xl shadow-xl border border-[#004a54] text-white relative overflow-hidden group">
                                <Icon name="mail" size={160} className="absolute -bottom-10 -right-10 text-white opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500"/>
                                <div className="relative z-10">
                                    <h3 className="font-bold text-2xl mb-2 flex items-center gap-2"><Icon name="mail" className="text-white"/> Correo Directo</h3>
                                    <p className="text-white/80 text-sm mb-6">Redacta tu consulta y llegará a nuestra bandeja de entrada administrativa.</p>
                                    
                                    <form 
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if(!config.supportEmail) { notify("El administrador no configuró un correo de soporte.", "error"); return; }
                                            
                                            const body = e.target.mensaje.value;
                                            const btn = e.target.enviarBtn;
                                            btn.disabled = true;
                                            btn.innerText = "Enviando...";
                                            
                                            google.script.run
                                                .withSuccessHandler((res) => {
                                                    if (res.success) { notify(res.message, "success"); e.target.reset(); } 
                                                    else notify(res.message, "error");
                                                    btn.disabled = false;
                                                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Mensaje';
                                                })
                                                .sendSupportEmail(config.supportEmail, user.email, user.businessName || 'Local', body);
                                        }} 
                                    >
                                        <textarea 
                                            name="mensaje" required rows="3" 
                                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/50 outline-none focus:bg-white/20 focus:border-white/40 resize-none mb-4 transition-colors"
                                            placeholder="Describe detalladamente tu problema o consulta..."
                                        ></textarea>
                                        <div className="flex justify-end">
                                            <button name="enviarBtn" type="submit" className="bg-white text-[#008395] px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg">
                                                <Icon name="send" size={18}/> Enviar Mensaje
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* TARJETA WHATSAPP */}
                        {config.supportWa && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-200 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#25D366]"></div>
                                <Icon name="message-circle" size={160} className="absolute -bottom-10 -right-10 text-[#25D366] opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-500"/>
                                <div className="relative z-10">
                                    <h3 className="font-bold text-2xl mb-2 flex items-center gap-2 text-gray-800"><Icon name="message-circle" className="text-[#25D366]"/> Chat Rápido</h3>
                                    <p className="text-gray-500 text-sm mb-6">Escribe tu mensaje aquí y se enviará directo a nuestro WhatsApp Oficial.</p>
                                    
                                    <form 
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if(!config.supportWa) { notify("El administrador no configuró un número de WhatsApp.", "error"); return; }
                                            
                                            const text = e.target.waMensaje.value;
                                            const phone = config.supportWa.replace(/\D/g, '');
                                            const encodedText = encodeURIComponent(`Hola soporte de HaceClick, soy del local "${user?.businessName || user?.email}".\n\nConsulta: ${text}`);
                                            
                                            // MAGIA: El esquema whatsapp:// abre la app directamente saltando el navegador
                                            window.location.href = `whatsapp://send?phone=${phone}&text=${encodedText}`;
                                            e.target.reset();
                                        }} 
                                    >
                                        <textarea 
                                            name="waMensaje" required rows="3" 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 placeholder-gray-400 outline-none focus:bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 resize-none mb-4 transition-all"
                                            placeholder="Escribe aquí tu duda o problema rápido..."
                                        ></textarea>
                                        <div className="flex justify-end">
                                            <button type="submit" className="bg-[#25D366] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2 shadow-lg">
                                                <Icon name="send" size={18}/> Abrir WhatsApp
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};


const App = () => {
    const [mode, setMode] = useState('admin');
    const [tenantId, setTenantId] = useState(null); 
    
    const [currentUser, setCurrentUser] = useState(null); 
    const [data, setData] = useState({ clients:[], treatments:[], appointments:[], categories:[], professionals:[], settings:[], notifications:[], adminMessages:[] });
    const [loadingData, setLoadingData] = useState(true); 
    const [currentView, setCurrentView] = useState('dashboard');
    const [targetApptId, setTargetApptId] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    
    // ESCUDO ANDROID Y BRANDING LOCAL
    const [brandConfig, setBrandConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('localBranding');
            return saved ? JSON.parse(saved) : { sidebarBg: '#1e293b', primaryColor: '#008395' };
        } catch(e) {
            return { sidebarBg: '#1e293b', primaryColor: '#008395' };
        }
    });

    const addToast = (msg, type='info') => { 
        const id = Date.now(); setToasts(prev => [...prev, {id, msg, type}]); 
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000); 
    };

    // --- FUNCIÓN DE LOGUEO ---
    const handleLogin = (u) => { 
        if (u.branding) {
            setBrandConfig(u.branding);
            try { localStorage.setItem('localBranding', JSON.stringify(u.branding)); } catch(e) {}
            
            const root = document.documentElement;
            if (u.branding.primaryColor) root.style.setProperty('--color-primary', u.branding.primaryColor);
            if (u.branding.sidebarBg) root.style.setProperty('--color-sidebar-bg', u.branding.sidebarBg);
            if (u.branding.sidebarText) root.style.setProperty('--color-sidebar-text', u.branding.sidebarText);
            if (u.branding.sidebarActive) root.style.setProperty('--color-sidebar-active', u.branding.sidebarActive);
        }

        setCurrentUser(u); 
        
        if (u.isMasterPanel) {
            setCurrentView('superadmin');
            // AQUÍ: Como Súper Admin, SÍ le decimos que cargue los datos (para leer el logo y los colores de la base maestra)
            setLoadingData(true); 
        } else {
            setLoadingData(true);
        }
    };

    // --- FUNCIÓN DE CARGA (REFRESH) ---
    const refreshData = () => {
        if (window.isSavingData) return;

        let emailToLoad = null;
        if (mode === 'client' && tenantId) {
            emailToLoad = tenantId;
        } else if (currentUser) {
            emailToLoad = currentUser.adminEmail || currentUser.email;
        }

        if (!emailToLoad) return;

        google.script.run
            .withSuccessHandler(d => { 
                if (d && d.success === false) {
                    addToast("Error BD: " + d.message, "error");
                    setLoadingData(false);
                    return;
                }
                
                setData({
                    clients: d?.clients || [],
                    treatments: d?.treatments || [],
                    appointments: d?.appointments || [],
                    categories: d?.categories || [],
                    professionals: d?.professionals || [],
                    settings: d?.settings || [],
                    notifications: d?.notifications || [],
                    adminMessages: d?.adminMessages || []
                });
                
                setLoadingData(false); 
                // Console.log eliminado para limpieza de consola
            })
            .withFailureHandler((err) => {
                addToast("Fallo de conexión con Google", "error");
                setLoadingData(false);
            })
            .getAllData(emailToLoad); 
    };

    // --- FUNCIÓN DE GUARDADO ---
    const save = (key, value) => { 
        window.isSavingData = true;
        
        let emailToSave = null;
        if (mode === 'client' && tenantId) {
            emailToSave = tenantId;
        } else if (currentUser) {
            emailToSave = currentUser.adminEmail || currentUser.email;
        }

        if (!emailToSave) {
            window.isSavingData = false;
            return;
        }

        setData(prev => ({ ...prev, [key]: value })); 
        
        google.script.run
            .withSuccessHandler(() => { 
                setTimeout(() => window.isSavingData = false, 2000); 
            })
            .withFailureHandler(() => {
                window.isSavingData = false;
                addToast("Error al guardar cambios", "error");
            })
            .saveData(emailToSave, key, JSON.stringify(value));
    };

// --- EFECTO 1: LECTURA DE URL (VERSIÓN WEB/GITHUB) ---
    useEffect(() => { 
        // Leemos los parámetros directamente de la barra de direcciones del navegador
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const tenant = params.get('tenant');

        if (view === 'client') {
            setMode('client');
            if (tenant) setTenantId(tenant);
        } else {
            // Si no es cliente, asumimos que es admin o carga normal
            setLoadingData(false); 
        }
    }, []);

    // --- EFECTO 2: CARGA INICIAL ---
    useEffect(() => {
        if (currentUser || (mode === 'client' && tenantId)) {
            setLoadingData(true);
            refreshData();
        }
    }, [currentUser, tenantId]);

    // --- EFECTO 3: RADAR INTELIGENTE ---
    useEffect(() => {
        // Regla 1: No radar para SuperAdmin ni para Portal de Clientes
        if (!currentUser || currentUser.isMasterPanel || mode === 'client') return;

        // Regla 2: Configuración del Radar (1 minuto = 60000ms)
        const RADAR_INTERVAL = 60000;
        let radarId = setInterval(() => {
            // Solo sincroniza si la pestaña del navegador está activa (visible)
            if (document.visibilityState === 'visible') {
                refreshData();
            }
        }, RADAR_INTERVAL);

        // Regla 3: Sincronización inmediata al volver a la pestaña
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !window.isSavingData) {
                // Al volver de otra pestaña, hace un refresh automático
                refreshData();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(radarId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [currentUser, mode, tenantId]);


    // BRANDING
    // --- BRANDING INTELIGENTE ---
    useEffect(() => {
        if (!data || !data.settings || !Array.isArray(data.settings)) return;
        let targetBranding = null;

        // 1. SI ES EL MODO ADMINISTRACIÓN (SUPER ADMIN), BUSCAMOS EN LA BASE MAESTRA
        if (currentUser?.isMasterPanel) {
            targetBranding = data.settings.find(s => s.id === 'branding');
            
            // Si la base maestra está vacía, usamos los colores por defecto de HaceClick
            if (!targetBranding || !targetBranding.primaryColor) {
                targetBranding = {
                    primaryColor: '#008395',
                    sidebarBg: '#1e293b',
                    sidebarText: '#9ca3af',
                    sidebarActive: '#ffffff',
                    logoBase64: 'https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png'
                };
            }
        } 
        // 2. SI ES UN LOCAL NORMAL O EL PORTAL DE CLIENTES, LEEMOS SU DB
        else if (mode === 'admin' && currentUser) {
            if (currentUser.role === 'admin' || currentUser.role === 'manager') {
                targetBranding = data.settings.find(s => s.adminEmail === currentUser.email);
            } else if (currentUser.role === 'professional') {
                targetBranding = data.settings.find(s => s.adminEmail === currentUser.adminEmail);
            }
        } else if (mode === 'client' && tenantId) {
            targetBranding = data.settings.find(s => s.adminEmail === tenantId);
        }

        if (!targetBranding) targetBranding = data.settings.find(s => s.primaryColor);

        if (targetBranding && targetBranding.primaryColor) {
            setBrandConfig(targetBranding);
            try { localStorage.setItem('localBranding', JSON.stringify(targetBranding)); } catch(e) {}
            const root = document.documentElement;
            root.style.setProperty('--color-primary', targetBranding.primaryColor);
            root.style.setProperty('--color-sidebar-bg', targetBranding.sidebarBg);
            root.style.setProperty('--color-sidebar-text', targetBranding.sidebarText || '#9ca3af');
            root.style.setProperty('--color-sidebar-active', targetBranding.sidebarActive || '#ffffff');
        }
    }, [data, currentUser, mode, tenantId]);

    // RENDERIZADO
    if (loadingData) return <div className="h-screen flex items-center justify-center bg-white"><img src="https://i.postimg.cc/rFq103qv/SOLO-LAMPARA-SIN-FONDO.png" className="h-24 animate-bounce" /></div>;
    
    if (!data) return <div className="flex h-screen w-full items-center justify-center bg-gray-50"><div className="text-gray-500 font-bold animate-pulse flex flex-col items-center gap-2"><Icon name="loader" className="animate-spin" size={32} /> Cargando datos...</div></div>;

    if (mode === 'client') return (
        <div className="flex h-screen bg-brand-bg font-sans overflow-hidden">
            <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <ClientPortal 
                clients={data.clients} 
                appointments={data.appointments} 
                treatments={data.treatments} 
                professionals={data.professionals} 
                settings={data.settings} 
                notifications={data.notifications} 
                saveAppointments={d => save('appointments', d)} 
                saveClients={d => save('clients', d)} 
                saveNotifications={d => save('notifications', d)}
                notify={addToast} 
                refreshData={refreshData}
            />
        </div>
    );

    if (!currentUser) return (
        <div className="flex h-screen bg-gray-100 font-sans overflow-hidden text-center">
            <ToastContainer toasts={toasts} removeToast={id => setToasts(p => p.filter(t => t.id !== id))} />
            <LoginScreen notify={addToast} onLogin={handleLogin} />
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden relative">
            <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <button className="md:hidden fixed top-4 right-4 z-50 bg-white p-2 rounded-lg shadow-md border" onClick={()=>setIsSidebarOpen(!isSidebarOpen)}><Icon name={isSidebarOpen ? "x" : "menu"} /></button>
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} user={currentUser} customLogo={brandConfig.logoBase64} brandConfig={brandConfig} />
            <main className="flex-1 relative overflow-y-auto flex flex-col bg-white custom-scrollbar">
                <div className="flex-1">
                    {currentView === 'dashboard' && <Dashboard {...data} saveAppointments={d => save('appointments', d)} notify={addToast} goToAgenda={id => { setTargetApptId(id); setCurrentView('agenda'); }} />}
                    {currentView === 'agenda' && <Agenda {...data} saveAppointments={d => save('appointments', d)} notify={addToast} targetApptId={targetApptId} clearTargetAppt={() => setTargetApptId(null)} loggedProfId={currentUser.role === 'professional' ? currentUser.profId : null} userRole={currentUser.role} refreshData={refreshData} />}                    {currentView === 'clients' && <Clients {...data} saveClients={d => save('clients', d)} notify={addToast} />}
                    {currentView === 'professionals' && <Professionals list={data.professionals} setList={d => save('professionals', d)} notify={addToast} categories={data.categories} user={currentUser} />}
                    {currentView === 'treatments' && (
                        <Treatments 
                            treatments={data.treatments} 
                            setTreatments={d => setData(prev => ({...prev, treatments: d}))} 
                            saveTreatments={d => save('treatments', d)} 
                            categories={data.categories} 
                            setCategories={d => setData(prev => ({...prev, categories: d}))} 
                            saveCategories={d => save('categories', d)} 
                            notify={addToast} 
                            settings={data.settings} 
                        />
                    )}
                    {currentView === 'billing' && (
                        <Billing 
                            {...data} 
                            saveSettings={d => save('settings', d)} 
                            notify={addToast} 
                            user={currentUser} // <-- ESTA LÍNEA ES VITAL
                        />
                    )}
                    {currentView === 'stats' && <Statistics {...data} loggedProfId={currentUser.role === 'professional' ? currentUser.profId : null} />}
                    {currentView === 'support' && (
                        <SupportPanel 
                            settings={data.settings} 
                            saveSettings={d => save('settings', d)} 
                            user={currentUser} 
                            notify={addToast} 
                        />
                    )}
                    {currentView === 'settings' && (
                        <LocalSettings 
                            settings={data.settings} 
                            setSettings={d => setData(prev => ({...prev, settings: d}))} 
                            targetEmail={(mode === 'client' && tenantId) ? tenantId : currentUser?.email}
                            notify={addToast} 
                            updateBrandingState={b => setBrandConfig(b)} 
                            user={currentUser} 
                        />
                    )}
                    {currentView === 'agent' && <AgentBuilderWrapper {...data} onSaveSettings={(k, v) => save(k, v)} />}
                    {currentView === 'superadmin' && <SuperAdminPanel notify={addToast} user={currentUser} />}
                </div>
                <footer className="w-full py-8 mt-10 flex items-center justify-center border-t border-gray-100 bg-gray-50/30">
                    <div className="flex items-center gap-2 opacity-50">
                        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400">POWERED BY |</p>
                        <a href="https://haceclick-ai.com/" target="_blank" rel="noopener noreferrer"><img src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" alt="HaceClick" className="h-10 object-contain" /></a>
                    </div>
                </footer>
            </main>
        </div>
    );
};



const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 500);
