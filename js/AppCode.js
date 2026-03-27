// --- 1. COMPONENTE DE LOGIN ---
const LoginScreen = ({ onLogin, notify }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    
    const [view, setView] = useState('login'); 
    const [recoverEmail, setRecoverEmail] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);

    const [forcePassUser, setForcePassUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [isChangingPass, setIsChangingPass] = useState(false);

    const handleSuccessLogin = (userOrComp) => {
        // Solo guarda el ID si es un código largo válido
        if (userOrComp.spreadsheetId && userOrComp.spreadsheetId.length > 20) {
            localStorage.setItem('targetDbId', userOrComp.spreadsheetId);
        } else {
            localStorage.removeItem('targetDbId');
        }

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

                    <h3 className="font-bold text-gray-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2 justify-center">
                        <span className="h-[1px] w-8 bg-gray-200"></span>
                        {isSuper ? 'O entrar a un Local' : 'Selecciona tu Empresa'}
                        <span className="h-[1px] w-8 bg-gray-200"></span>
                    </h3>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {availableCompanies.map((comp, idx) => {
                            const nombre = comp.businessName || "";
                            if (nombre === "haceclick-ai" || nombre === "d/mm/yyyy") return null;
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
                        <div className="relative"><Icon name="mail" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="email" required className="w-full border p-3 pl-10 rounded-xl" placeholder="Tu Email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                        <div className="relative"><Icon name="lock" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="password" required className="w-full border p-3 pl-10 rounded-xl" placeholder="Tu Contraseña" value={password} onChange={e => setPassword(e.target.value)} /></div>
                        <button type="submit" disabled={isChecking} className="w-full bg-[#008395] text-white font-bold py-4 rounded-xl shadow-lg">{isChecking ? "Verificando..." : "Entrar al Sistema"}</button>
                        <div className="pt-2"><button type="button" onClick={() => setView('recover')} className="text-xs font-bold text-gray-400 underline">¿Olvidaste tu contraseña?</button></div>
                    </form>
                )}

                {view === 'recover' && (
                    <form onSubmit={handleRecover} className="space-y-5 animate-fade-in">
                        <h3 className="font-bold text-gray-800">Recuperar Acceso</h3>
                        <div className="relative"><Icon name="mail" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="email" required className="w-full border p-3 pl-10 rounded-xl" placeholder="Correo registrado" value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)} /></div>
                        <button type="submit" disabled={isRecovering} className="w-full bg-[#1e293b] text-white font-bold py-4 rounded-xl shadow-lg">{isRecovering ? "Enviando..." : "Solicitar Clave"}</button>
                        <div className="pt-2"><button type="button" onClick={() => setView('login')} className="text-xs font-bold text-gray-400 uppercase tracking-widest">← Volver Atrás</button></div>
                    </form>
                )}

                {view === 'force_password' && (
                    <form onSubmit={handleChangePassword} className="space-y-5 animate-fade-in">
                        <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-2"><Icon name="shield-alert" size={32}/></div>
                        <h3 className="font-bold text-gray-800">Nueva Contraseña</h3>
                        <div className="relative"><Icon name="lock" className="absolute left-3 top-3.5 text-gray-400" size={18} /><input type="password" required minLength="6" className="w-full border p-3 pl-10 rounded-xl" placeholder="Nueva Contraseña" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
                        <button type="submit" disabled={isChangingPass} className="w-full bg-[#008395] text-white font-bold py-4 rounded-xl shadow-lg">{isChangingPass ? "Guardando..." : "Guardar e Ingresar"}</button>
                    </form>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE SIDEBAR (CON LECTURA REAL DE PERMISOS Y SECCIONES) ---
const Sidebar = ({ currentView, setCurrentView, isOpen, setIsOpen, user, customLogo, brandConfig, professionals = [] }) => {

    // 1. Definimos los botones con su propiedad 'group'
    const rawMenuItems = [
        // GRUPO: PRINCIPAL (Sin título)
        { id: 'dashboard', label: 'Panel General', icon: 'layout-dashboard', roles: ['admin', 'manager', 'professional'], group: 'MAIN' },
        { id: 'agenda', label: 'Agenda', icon: 'calendar', roles: ['admin', 'manager', 'professional'], group: 'MAIN' },
        { id: 'clients', label: 'Clientes', icon: 'users', roles: ['admin', 'manager'], group: 'MAIN' },
        { id: 'treatments', label: 'Servicios', icon: 'tag', roles: ['admin', 'manager'], group: 'MAIN' },
        
        // GRUPO: MI EQUIPO
        { id: 'professionals', label: 'Profesionales', icon: 'briefcase', roles: ['admin', 'manager'], group: 'TEAM' },
        
        // GRUPO: MI NEGOCIO
        { id: 'billing', label: 'Facturación', icon: 'receipt', roles: ['admin', 'manager', 'professional'], group: 'BUSINESS' },
        { id: 'stats', label: 'Estadísticas', icon: 'bar-chart-2', roles: ['admin', 'manager', 'professional'], group: 'BUSINESS' },
        { id: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin', 'manager'], group: 'BUSINESS' },
        
        // GRUPO: ADMINISTRADOR
        { id: 'agent', label: 'Agente IA', icon: 'bot', roles: ['admin'], group: 'ADMIN' },
        { id: 'superadmin', label: 'Admin Sistema', icon: 'shield-check', roles: ['admin', 'manager'], visible: user?.isSuperAdmin === true, group: 'ADMIN' }
    ];

    // 2. Filtramos mágicamente qué botones puede ver el usuario logueado
    const allowedItems = rawMenuItems.filter(item => {
        // Validar si el rol básico tiene acceso
        if (!item.roles.includes(user?.role)) return false;
        
        // Validar restricciones explícitas (ej: superadmin)
        if (item.visible === false) return false;

        // LECTURA DE PERMISOS REALES DEL PROFESIONAL
        if (user?.role === 'professional') {
            const myProfile = professionals.find(p => p.id === user?.profId);
            const myPerms = myProfile?.permissions || {};
            
            if (myPerms[item.id] !== undefined) {
                return myPerms[item.id] === true;
            }
            return item.id === 'agenda'; // Por defecto solo agenda
        }

        // Admin y Manager ven todo lo que pasa los primeros filtros
        return true;
    });

    // 3. Definimos los títulos de cada grupo
    const menuGroups = [
        { id: 'MAIN', title: null },
        { id: 'TEAM', title: 'MI EQUIPO' },
        { id: 'BUSINESS', title: 'MI NEGOCIO' },
        { id: 'ADMIN', title: 'ADMINISTRADOR' }
    ];

    return (
        <div 
            className={`fixed md:static inset-y-0 left-0 z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 w-72 flex flex-col shadow-2xl shrink-0`} 
            style={{ backgroundColor: brandConfig.sidebarBg || '#111827' }}
        >
            {/* LOGO */}
            <div className="p-8 flex flex-col items-center justify-center min-h-[160px] shrink-0">
                {customLogo ? (
                    <img src={customLogo} alt="Logo" className="w-[85%] max-h-40 object-contain drop-shadow-xl" />
                ) : (
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold"><Icon name="scissors" size={24}/></div>
                )}
            </div>

            {/* NAVEGACIÓN AGRUPADA */}
            <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
                {menuGroups.map(group => {
                    // Solo obtenemos los botones de este grupo que pasaron el filtro de permisos
                    const groupItems = allowedItems.filter(item => item.group === group.id);
                    
                    // Si el grupo se quedó vacío (por permisos), no lo dibujamos ni ponemos su título
                    if (groupItems.length === 0) return null;

                    return (
                        <div key={group.id} className={group.title ? "mt-8 mb-2" : "mb-2"}>
                            {/* TÍTULO DEL GRUPO (Si tiene) */}
                            {group.title && (
                                <p className="px-4 text-[10px] font-bold tracking-[0.15em] mb-3 opacity-60" style={{ color: brandConfig.sidebarText || '#9ca3af' }}>
                                    {group.title}
                                </p>
                            )}
                            
                            {/* BOTONES DEL GRUPO */}
                            {/* 1. Cambiamos space-y-1 por space-y-2 para darle más aire vertical */}
                            <div className="space-y-2">
                                {groupItems.map(item => {
                                    const isActive = currentView === item.id;
                                    return (
                                        <button key={item.id} onClick={() => { setCurrentView(item.id); setIsOpen(false); }} 
                                            // 2. Agregamos 'text-sm' (o text-[13px]) para achicar la letra
                                            // y ajustamos un poco el padding vertical (py-2.5 en vez de py-3)
                                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-normal text-sm hover:opacity-80 transition-all"
                                            style={{ 
                                                backgroundColor: isActive ? (brandConfig.primaryColor || '#008395') : 'transparent',
                                                color: isActive ? (brandConfig.sidebarActive || '#ffffff') : (brandConfig.sidebarText || '#9ca3af')
                                            }}
                                        >
                                            {/* 3. Achicamos un poquito el ícono de 20 a 18 para que acompañe la nueva letra */}
                                            <Icon name={item.icon} size={18} style={{ color: isActive ? (brandConfig.sidebarActive || '#ffffff') : 'inherit' }} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* SOPORTE */}
            <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <button 
                    onClick={() => { setCurrentView('support'); setIsOpen(false); }} 
                    // Agregamos text-sm y py-2.5 para igualar al resto
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-normal text-sm hover:opacity-80 transition-opacity"
                    style={{ 
                        backgroundColor: currentView === 'support' ? (brandConfig.primaryColor || '#008395') : 'transparent',
                        color: currentView === 'support' ? (brandConfig.sidebarActive || '#ffffff') : (brandConfig.sidebarText || '#9ca3af')
                    }}
                >
                    {/* Achicamos el ícono a 18 */}
                    <Icon name="help-circle" size={18} style={{ color: currentView === 'support' ? (brandConfig.sidebarActive || '#ffffff') : 'inherit' }} />
                    Soporte y Ayuda
                </button>
            </div>

            {/* PERFIL Y SALIR */}
            <div className="p-4 border-t flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-md"
                        style={{ backgroundColor: brandConfig.primaryColor || '#008395', color: '#ffffff' }}
                    >
                        {(user?.email || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: brandConfig.sidebarText || '#9ca3af' }}>
                            {user?.email}
                        </p>
                        <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold" style={{ color: brandConfig.sidebarText || '#9ca3af' }}>
                            {user?.role}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="flex items-center justify-center p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all shrink-0 shadow-sm active:scale-95 group"
                    title="Cerrar Sesión"
                >
                    <Icon name="log-out" size={18} className="group-hover:-translate-x-0.5 transition-transform" />
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


// --- FUNCIÓN MATEMÁTICA DE CONTRASTE (YIQ) ---
// Decide si el texto debe ser claro u oscuro dependiendo del fondo
const getContrastColor = (hexcolor) => {
    if (!hexcolor) return '#ffffff'; // Por defecto blanco
    
    // Le quitamos el # si lo tiene
    hexcolor = hexcolor.replace("#", "");
    
    // Si el cliente puso un hex de 3 letras (ej: #FFF), lo pasamos a 6 (#FFFFFF)
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(c => c + c).join('');
    }
    
    // Convertimos a RGB
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    // Ecuación YIQ para medir el brillo percibido por el ojo humano
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Si el brillo es mayor a 128 (es un color claro) -> Letra Oscura
    // Si el brillo es menor a 128 (es un color oscuro) -> Letra Blanca
    return (yiq >= 128) ? '#1e293b' : '#ffffff'; 
};



// --- 4. APP PRINCIPAL ---
const App = () => {
    // --- ESTADOS ---
    const [mode, setMode] = useState('admin');
    const [tenantId, setTenantId] = useState(null); 
    const [currentUser, setCurrentUser] = useState(null); 
    const [data, setData] = useState({ clients:[], treatments:[], appointments:[], categories:[], professionals:[], settings:[], notifications:[], adminMessages:[] });
    const [loadingData, setLoadingData] = useState(true); 
    const [currentView, setCurrentView] = useState('dashboard');
    const [targetApptId, setTargetApptId] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [publicData, setPublicData] = useState(null);
    const [publicError, setPublicError] = useState('');
    const [publicAlias, setPublicAlias] = useState('');
    const [brandConfig, setBrandConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('localBranding');
            return saved ? JSON.parse(saved) : { sidebarBg: '#1e293b', primaryColor: '#008395' };
        } catch(e) { return { sidebarBg: '#1e293b', primaryColor: '#008395' }; }
    });

    // --- FUNCIONES AUXILIARES ---
    const addToast = (msg, type='info') => { 
        const id = Date.now();
        setToasts(prev => [...prev, {id, msg, type}]); 
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000); 
    };

    const handleLogin = (userOrComp) => {
        if (userOrComp.email) {
            localStorage.setItem('adminEmail', userOrComp.email);
        }
        if (userOrComp.spreadsheetId) {
            localStorage.setItem('targetDbId', userOrComp.spreadsheetId);
        }
        
        if (userOrComp.isMasterPanel) {
            setCurrentUser(userOrComp);
            setCurrentView('superadmin');
            return;
        }
        
        // 🔥 LA MAGIA: Prendemos la pantalla de carga ANTES de setear al usuario
        setLoadingData(true); 
        setCurrentUser(userOrComp);
    };

    const refreshData = () => {
        const emailToUse = currentUser?.adminEmail || currentUser?.email || tenantId;
        if (!emailToUse) return;

        let dbId = localStorage.getItem('targetDbId');
        
        if (dbId && (dbId.includes('@') || dbId.length < 20)) {
            localStorage.removeItem('targetDbId');
            dbId = null;
        }

        google.script.run
            .withSuccessHandler((res) => {
                setLoadingData(false);
                if (res && res.success) {
                    setData({
                        clients:        res.clients        || [],
                        treatments:     res.treatments     || [],
                        appointments:   res.appointments   || [],
                        categories:     res.categories     || [],
                        professionals:  res.professionals  || [],
                        settings:       res.settings       || [],
                        notifications:  res.notifications  || [],
                        adminMessages:  res.adminMessages  || []
                    });
                } else {
                    addToast('Error al cargar datos: ' + (res?.message || 'Respuesta inválida'), 'error');
                }
            })
            .withFailureHandler((err) => {
                setLoadingData(false);
                addToast('Error de conexión al cargar datos', 'error');
            })
            .getAllData(emailToUse, dbId);
    };

    const save = (type, dataToSave) => {
        window.isSavingData = true;
        const emailToUse = currentUser?.adminEmail || currentUser?.email;
        if (!emailToUse) return;

        const specificId = localStorage.getItem('targetDbId');

        setData(prev => ({ ...prev, [type]: dataToSave }));

        google.script.run
            .withSuccessHandler((res) => {
                window.isSavingData = false;
                if (res && !res.success) {
                    addToast('Error al guardar: ' + (res.message || ''), 'error');
                }
            })
            .withFailureHandler((err) => {
                window.isSavingData = false;
                addToast('Error de conexión al guardar', 'error');
                console.error('save error:', err);
            })
            .saveData(emailToUse, type, JSON.stringify(dataToSave), specificId);
    };

    // --- EFFECTS ---
    useEffect(() => { 
        const initPortal = (aliasStr) => {
            const alias = aliasStr.replace('#/', '').replace('?local=', '').replace('/', '').toLowerCase();
            if (!alias) { setLoadingData(false); return; }
            
            // Magia de Caché: Verificamos si cambió el local
            const savedAlias = localStorage.getItem('last_visited_alias');
            if (savedAlias !== alias) {
                localStorage.removeItem('localBranding'); 
                localStorage.setItem('last_visited_alias', alias); 
                setBrandConfig({ sidebarBg: '#1e293b', primaryColor: '#008395' }); 
            }

            setPublicAlias(alias);
            setMode('public_portal');
            setLoadingData(true);
            
            google.script.run
                .withSuccessHandler(res => {
                    if (res.success) setPublicData(res);
                    else { setPublicError(res.message); setMode('public_error'); }
                    setLoadingData(false);
                })
                .getPublicData(alias);
        };

        // 🔥 LA SOLUCIÓN: Leemos la URL nativa de Google Apps Script 🔥
        if (typeof google !== 'undefined' && google.script && google.script.url) {
            google.script.url.getLocation(function(location) {
                // Apps Script guarda los parámetros en un formato especial: location.parameters.nombre[0]
                const localParam = location.parameters.local ? location.parameters.local[0] : null;
                const viewParam = location.parameters.view ? location.parameters.view[0] : null;
                const hash = location.hash;

                if (localParam) {
                    initPortal(localParam);
                } else if (hash && hash.startsWith('amara')) { 
                    initPortal(hash);
                } else if (window.location.hash && window.location.hash.startsWith('#/')) {
                    initPortal(window.location.hash);
                } else {
                    if (viewParam === 'client') {
                        setMode('client');
                        const t = location.parameters.tenant ? location.parameters.tenant[0] : null;
                        if (t) setTenantId(t);
                    }
                    setLoadingData(false); 
                }
            });
        } else {
            // (Mantenemos esto por si corres la app fuera de Apps Script)
            const hash = window.location.hash;
            const params = new URLSearchParams(window.location.search);
            const localParam = params.get('local'); 
            const viewParam = params.get('view');

            if (localParam) {
                initPortal(localParam);
            } else if (hash && hash.startsWith('#/')) {
                initPortal(hash);
            } else {
                if (viewParam === 'client') {
                    setMode('client');
                    const t = params.get('tenant');
                    if (t) setTenantId(t);
                }
                setLoadingData(false); 
            }
        }
    }, []);

    useEffect(() => {
        if (currentUser || (mode === 'client' && tenantId)) {
            setLoadingData(true);
            refreshData();
        }
    }, [currentUser, tenantId]);

    useEffect(() => {
        if (!currentUser || currentUser.isMasterPanel || mode === 'client' || mode === 'public_portal') return;
        const RADAR_INTERVAL = 60000;
        const radarId = setInterval(() => {
            if (document.visibilityState === 'visible') refreshData();
        }, RADAR_INTERVAL);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !window.isSavingData) refreshData();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            clearInterval(radarId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [currentUser, mode, tenantId]);

    // --- EFECTO DE APLICACIÓN DE MARCA (BRANDING) ---
    useEffect(() => {
        let targetSettings = (mode === 'public_portal' && publicData) ? publicData.settings : data.settings;
        if (!targetSettings || !Array.isArray(targetSettings)) return;
        
        // Buscamos la entrada de marca (branding)
        let targetBranding = targetSettings.find(s => s.id === 'branding' || s.primaryColor);

        if (targetBranding && targetBranding.primaryColor) {
            
            // 👇 ESTA ES LA LÍNEA MÁGICA QUE SOLUCIONA EL PROBLEMA 👇
            // Guardamos esta configuración como la "actual" en la memoria del navegador
            localStorage.setItem('localBranding', JSON.stringify(targetBranding));
            // 👆 FIN DE LA SOLUCIÓN 👆

            // Actualizamos el estado y las variables CSS
            setBrandConfig(targetBranding);
            const root = document.documentElement;
            
            // 1. Colores de fondo que eligió el cliente
            root.style.setProperty('--color-primary', targetBranding.primaryColor);
            root.style.setProperty('--color-sidebar-bg', targetBranding.sidebarBg);
            
            // 2. 🔥 LA MAGIA: Calculamos el contraste perfecto para los textos
            const autoPrimaryText = getContrastColor(targetBranding.primaryColor);
            const autoSidebarActiveText = getContrastColor(targetBranding.sidebarBg);

            // 3. Inyectamos los textos inteligentes
            root.style.setProperty('--color-sidebar-text', targetBranding.sidebarText || '#9ca3af');
            
            // Pero el texto ACTIVO y el texto de los BOTONES los forzamos para que siempre se lean perfecto
            root.style.setProperty('--color-sidebar-active', autoSidebarActiveText);
            root.style.setProperty('--color-primary-text', autoPrimaryText);
        }
    }, [data, publicData, currentUser, mode, tenantId]);

// --- 4. RENDERIZADO ---

    if (loadingData) return <div className="h-[100dvh] flex items-center justify-center bg-white"><img src="https://i.postimg.cc/rFq103qv/SOLO-LAMPARA-SIN-FONDO.png" className="h-24 animate-bounce" /></div>;

    if (mode === 'public_error') return <div className="h-[100dvh] flex items-center justify-center bg-brand-bg text-red-500 font-bold p-10 text-center">{publicError || 'Local no encontrado'}</div>;

    if (mode === 'public_portal' && publicData) {
        return (
            <div className="flex h-[100dvh] bg-brand-bg font-sans overflow-hidden">
                <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
                <ClientPortal 
                    alias={publicAlias}
                    appointments={publicData.appointments} 
                    treatments={publicData.treatments} 
                    professionals={publicData.professionals} 
                    categories={publicData.categories}
                    settings={publicData.settings}
                    notify={addToast} 
                    refreshData={() => {
                        if (publicAlias) {
                            google.script.run.withSuccessHandler(res => { if (res.success) setPublicData(res); }).getPublicData(publicAlias);
                        }
                    }}
                />
            </div>
        );
    }

    if (mode === 'client') return (
        <div className="flex h-[100dvh] bg-brand-bg font-sans overflow-hidden">
            <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <ClientPortal 
                {...data} 
                saveAppointments={d => save('appointments', d)} 
                saveClients={d => save('clients', d)} 
                saveNotifications={d => save('notifications', d)} 
                notify={addToast} 
                refreshData={refreshData} 
            />
        </div>
    );

    if (!currentUser) return (
        <div className="flex h-[100dvh] bg-gray-100 font-sans overflow-hidden text-center">
            <ToastContainer toasts={toasts} removeToast={id => setToasts(p => p.filter(t => t.id !== id))} />
            <LoginScreen notify={addToast} onLogin={handleLogin} />
        </div>
    );

   return (
        <div className="flex h-[100dvh] bg-gray-50 font-sans overflow-hidden relative">
            <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <button className="md:hidden fixed top-4 right-4 z-50 bg-white p-2 rounded-lg shadow-md border" onClick={()=>setIsSidebarOpen(!isSidebarOpen)}>
                <Icon name={isSidebarOpen ? "x" : "menu"} />
            </button>
            <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen} 
                user={currentUser} 
                customLogo={brandConfig.logoBase64} 
                brandConfig={brandConfig} 
                professionals={data.professionals} /* 🔥 ESTA ES LA LÍNEA NUEVA 🔥 */
            />
            <main className="flex-1 relative overflow-y-auto flex flex-col bg-white custom-scrollbar">
                <div className="flex-1">
                    {currentView === 'dashboard'    && <Dashboard {...data} user={currentUser} saveAppointments={d => save('appointments', d)} saveNotifications={d => save('notifications', d)} notify={addToast} goToAgenda={id => { setTargetApptId(id); setCurrentView('agenda'); }} refreshData={refreshData} />}
                    {currentView === 'agenda'       && <Agenda {...data} saveAppointments={d => save('appointments', d)} notify={addToast} targetApptId={targetApptId} clearTargetAppt={() => setTargetApptId(null)} loggedProfId={currentUser.role === 'professional' ? currentUser.profId : null} userRole={currentUser.role} refreshData={refreshData} />}
                    {currentView === 'clients'      && <Clients {...data} saveClients={d => save('clients', d)} notify={addToast} />}
                    {currentView === 'professionals'&& <Professionals list={data.professionals} setList={d => save('professionals', d)} notify={addToast} categories={data.categories} user={currentUser} />}
                    {currentView === 'treatments'   && <Treatments treatments={data.treatments} setTreatments={d => setData(prev => ({...prev, treatments: d}))} saveTreatments={d => save('treatments', d)} categories={data.categories} setCategories={d => setData(prev => ({...prev, categories: d}))} saveCategories={d => save('categories', d)} notify={addToast} settings={data.settings} />}
                    {currentView === 'billing'      && <Billing {...data} saveSettings={d => save('settings', d)} notify={addToast} user={currentUser} />}
                    {currentView === 'stats'        && <Statistics {...data} loggedProfId={currentUser.role === 'professional' ? currentUser.profId : null} />}
                    {currentView === 'support'      && <SupportPanel settings={data.settings} saveSettings={d => save('settings', d)} user={currentUser} notify={addToast} />}
                    {currentView === 'settings'     && <LocalSettings settings={data.settings} setSettings={d => setData(prev => ({...prev, settings: d}))} targetEmail={(mode === 'client' && tenantId) ? tenantId : currentUser?.email} notify={addToast} updateBrandingState={b => setBrandConfig(b)} user={currentUser} />}
                    {currentView === 'agent'        && <AgentBuilderWrapper {...data} onSaveSettings={(k, v) => save(k, v)} />}
                    {currentView === 'superadmin'   && <SuperAdminPanel notify={addToast} user={currentUser} />}
                </div>
                 <footer className="w-full pt-8 pb-20 md:pb-8 mt-auto flex items-center justify-center border-t border-gray-100 bg-gray-50/30 shrink-0">
                    <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400">POWERED BY |</p>
                        <a href="https://haceclick-ai.com/" target="_blank" rel="noopener noreferrer">
                            <img src="https://i.postimg.cc/HLNzb26w/LATERAL-SIN-FONDO.png" alt="HaceClick" className="h-6 md:h-7 object-contain grayscale hover:grayscale-0 transition-all duration-300" />
                        </a>
                    </div>
                </footer>
            </main>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

