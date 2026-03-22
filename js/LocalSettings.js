const LocalSettings = ({ settings, setSettings, saveSettings, notify, updateBrandingState, user, targetEmail }) => {
    // 1. Valores por defecto (✅ AGREGAMOS enableDiscounts)
    const defaultBranding = { id: 'branding', primaryColor: '#008395', sidebarBg: '#111827', sidebarText: '#9ca3af', sidebarActive: '#ffffff', logoBase64: '', adminEmail: '' };
    const defaultAgent = { 
        id: 'agent_config', businessName: '', whatsapp: '', address: '', tenantAlias: '', mapsUrl: '',
        requireDeposit: false, depositType: 'link', depositAmount: '', paymentUrl: '', 
        transferAlias: '', transferName: '', transferCuit: '',
        reschedulePolicy: '24',
        showPolicyModal: false, 
        policyText: '',
        enableDiscounts: false,
        discountType: 'fixed',
    };
    const defaultMsg = { 
        id: 'messages_config', 
        birthday: 'Para festejar con vos te damos un regalo especial.',
        welcome: '¡Qué alegría sumarte a nuestro local! Te escribimos para confirmarte que tu perfil fue dado de alta exitosamente.\n\nEn breve revisaremos la solicitud de tu turno. ¡Gracias por elegirnos!',
        confirm: '¡Te esperamos!',
        reject: 'Te pedimos mil disculpas, pero tuvimos que rechazar tu solicitud porque el espacio se ocupó o el profesional no está disponible.\n\n¿Te gustaría que te ofrezcamos otro horario? Quedamos a tu disposición. 🙏',
        promoSubject: '¡Novedades!', 
        promo: 'Aprovecha nuestras promos.' 
    };

    // 2. Estados Iniciales
    const [branding, setBranding] = useState(defaultBranding);
    const [agentConfig, setAgentConfig] = useState(defaultAgent);
    const [messagesConfig, setMessagesConfig] = useState(defaultMsg);
    
    const [isSaving, setIsSaving] = useState(false);
    const [emailGroups, setEmailGroups] = useState([]);
    
    const [hasLoadedInit, setHasLoadedInit] = useState(false); 
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [tempAlias, setTempAlias] = useState('');

    // ESTADO PARA EL ACORDEÓN (Inicia con 'negocio' abierto)
    const [openSection, setOpenSection] = useState('negocio');

    const toggleSection = (sectionName) => {
        setOpenSection(prev => prev === sectionName ? null : sectionName);
    };

    // 3. EL ARREGLO DEL "RADAR"
    useEffect(() => {
        if (settings && settings.length > 0 && !hasLoadedInit) {
            const incBranding = settings.find(s => s.id === 'branding') || {};
            const incAgent = settings.find(s => s.id === 'agent_config') || {};
            const incMsg = settings.find(s => s.id === 'messages_config') || {};

            setBranding(prev => ({ ...defaultBranding, ...incBranding }));
            setAgentConfig(prev => ({ ...defaultAgent, ...incAgent }));
            setMessagesConfig(prev => ({ ...defaultMsg, ...incMsg }));
            
            setHasLoadedInit(true); 
        }
    }, [settings, hasLoadedInit]);

    // 4. LÓGICA DEL ALIAS
    const startAliasEdit = () => {
        setTempAlias(agentConfig.tenantAlias || '');
        setIsEditingAlias(true);
    };

    const handleAliasTyping = (e) => {
        let val = e.target.value;
        val = val.toLowerCase();
        val = val.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
        val = val.replace(/[^a-z0-9-]/g, ""); 
        val = val.replace(/-+/g, "-"); 
        setTempAlias(val);
    };

    const confirmAliasEdit = () => {
        setAgentConfig({ ...agentConfig, tenantAlias: tempAlias });
        setIsEditingAlias(false);
    };

    // 5. LOGO UPLOAD
    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > height) { if (width > 500) { height *= 500 / width; width = 500; } } else { if (height > 500) { width *= 500 / height; height = 500; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                setBranding(prev => ({ ...prev, logoBase64: canvas.toDataURL('image/png') }));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // 6. GUARDADO GENERAL
    const handleSave = (e) => {
        e.preventDefault();
        setIsSaving(true);

        const performFinalSave = (finalLogoUrl) => {
            const updatedBranding = { ...branding, logoBase64: finalLogoUrl, id: 'branding', adminEmail: targetEmail };
            const updatedAgent = { ...agentConfig, id: 'agent_config', adminEmail: targetEmail, tenantAlias: agentConfig.tenantAlias };
            const updatedMessages = { ...messagesConfig, id: 'messages_config', adminEmail: targetEmail };
            const newSettings = [updatedBranding, updatedAgent, updatedMessages];
            
            setSettings(newSettings);
            if (updateBrandingState) updateBrandingState(updatedBranding);

            google.script.run
                .withSuccessHandler((res) => {
                    setIsSaving(false);
                    if (res && res.success) notify("Ajustes guardados correctamente.", "success");
                    else notify("Error al guardar datos.", "error");
                })
                .withFailureHandler(err => { 
                    setIsSaving(false); 
                    notify("Error de conexión: " + err, "error"); 
                })
                .saveData(targetEmail, 'settings', JSON.stringify(newSettings));
        };

        if (branding.logoBase64 && branding.logoBase64.startsWith('data:')) {
            notify("Subiendo logo a la nube...", "info");
            google.script.run
                .withSuccessHandler((driveUrl) => {
                    setBranding(prev => ({ ...prev, logoBase64: driveUrl })); 
                    performFinalSave(driveUrl);
                })
                .withFailureHandler((err) => {
                    setIsSaving(false);
                    notify("Error al subir logo. Intenta otra imagen.", "error");
                })
                .uploadBrandLogo(targetEmail, branding.logoBase64);
        } else {
            performFinalSave(branding.logoBase64);
        }
    };

    // 7. MARKETING LOGIC
    const handlePreparePromo = () => {
        notify("Analizando clientes...", "info");
        google.script.run
            .withSuccessHandler((clientsData) => {
                const validEmails = (clientsData || []).map(c => c.email).filter(e => e && e.includes('@'));
                if (validEmails.length === 0) return notify("No hay clientes con email.", "warning");
                const groups = [];
                for (let i = 0; i < validEmails.length; i += 50) groups.push(validEmails.slice(i, i + 50));
                setEmailGroups(groups);
                notify(`Listos ${groups.length} grupos de envío.`, "success");
            })
            .getClientsEmails(targetEmail); 
    };

    const getGmailLink = (group) => {
        if (!group) return '#';
        const bcc = group.join(','); 
        const subject = encodeURIComponent(messagesConfig.promoSubject || 'Novedades');
        const bodyText = `${messagesConfig.promo}\n\nAtentamente,\n${agentConfig.businessName || 'El Equipo'}`;
        return `https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subject}&body=${encodeURIComponent(bodyText)}`;
    };

    // ✅ Estilo unificado para los títulos de los acordeones (Achicado a text-base)
    const accordionTitleClass = "font-bold text-base flex items-center gap-3 text-gray-800";
    const accordionIconColor = "text-gray-500";

    return (
        <div className="p-4 md:p-8 h-full bg-brand-bg">
            <header className="mb-8">
                {/* ACHICADO A text-2xl */}
                <h2 className="text-2xl font-bold text-gray-800">Ajustes del Local</h2>
            </header>
            <form onSubmit={handleSave} className="w-full space-y-4">
                
                {/* 1. NEGOCIO Y PAGOS */}
                <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                    <button 
                        type="button" 
                        onClick={() => toggleSection('negocio')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'negocio' ? 'border-b border-gray-100' : ''}`}
                    >
                        <h3 className={accordionTitleClass}><Icon name="store" className={accordionIconColor}/> Negocio y Pagos</h3>
                        <Icon name={openSection === 'negocio' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>
                    
                    {openSection === 'negocio' && (
                        <div className="p-6 space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-xs font-bold text-gray-500 mb-2">Nombre Comercial</label><input type="text" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)]" value={agentConfig.businessName || ''} onChange={e => setAgentConfig({...agentConfig, businessName: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-2">WhatsApp</label><input type="tel" placeholder="Ej: 5491112345678" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)]" value={agentConfig.whatsapp || ''} onChange={e => setAgentConfig({...agentConfig, whatsapp: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-2">Dirección Física</label><input type="text" placeholder="Ej: Av. Santa Fe 1234" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)]" value={agentConfig.address || ''} onChange={e => setAgentConfig({...agentConfig, address: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-2">Link Google Maps</label><input type="url" placeholder="https://maps.app.goo.gl/..." className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)]" value={agentConfig.mapsUrl || ''} onChange={e => setAgentConfig({...agentConfig, mapsUrl: e.target.value})} /></div>
                            </div>

                            {/* ENLACE PÚBLICO */}
                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-sm text-blue-900 mb-2 flex items-center gap-2"><Icon name="link" size={16}/> Enlace Público de Reservas</h4>
                                <p className="text-xs text-blue-700 mb-4">Este es el link que compartirás en tu Instagram. Asegúrate de configurarlo correctamente.</p>
                                
                                {!isEditingAlias ? (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full overflow-hidden">
                                        {/* ✅ AGREGADO: overflow-x-auto, custom-scrollbar y whitespace-nowrap */}
                                        <div className="bg-white border border-gray-300 p-3 rounded-lg text-gray-700 text-sm font-mono flex-1 w-full flex items-center shadow-sm overflow-x-auto custom-scrollbar whitespace-nowrap">
                                            <span className="text-gray-400">salones.haceclick-ai.com/?local=</span>
                                            <strong className="text-blue-900 ml-0.5">{agentConfig.tenantAlias || 'tu-local'}</strong>
                                        </div>
                                        <button type="button" onClick={startAliasEdit} className="w-full sm:w-auto bg-blue-100 text-blue-700 px-6 py-3 rounded-lg font-bold hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 shrink-0 text-sm">
                                            <Icon name="edit-2" size={16}/> Editar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 animate-fade-in w-full overflow-hidden">
                                        {/* ✅ AGREGADO: overflow-x-auto y scroll */}
                                        <div className="bg-white border-2 border-blue-400 p-2.5 rounded-lg flex items-center flex-1 w-full focus-within:ring-4 focus-within:ring-blue-100 transition-all shadow-inner overflow-x-auto custom-scrollbar whitespace-nowrap">
                                            <span className="text-gray-400 text-sm font-mono">salones.haceclick-ai.com/?local=</span>
                                            <input 
                                                type="text" autoFocus
                                                className="outline-none font-bold text-blue-900 font-mono min-w-[150px] bg-transparent ml-0.5 text-sm" 
                                                value={tempAlias} onChange={handleAliasTyping} placeholder="ej: peluqueria-marcela" 
                                            />
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                            <button type="button" onClick={() => setIsEditingAlias(false)} className="flex-1 sm:flex-none bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-300 transition-colors text-sm" title="Cancelar">
                                                <Icon name="x" size={18} className="mx-auto"/>
                                            </button>
                                            <button type="button" onClick={confirmAliasEdit} className="flex-1 sm:flex-none bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-600 shadow-md transition-colors flex items-center justify-center gap-2 text-sm">
                                                <Icon name="check" size={16}/> Fijar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* POLÍTICA DE REPROGRAMACIÓN Y TÉRMINOS */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <div className="mb-4">
                                    <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2"><Icon name="calendar" size={16} className="text-[var(--color-primary)]"/> Políticas del Local</h4>
                                    <p className="text-[10px] text-gray-500 mt-1">Límite de tiempo previo al turno para que el cliente pueda reprogramarlo desde el portal.</p>
                                </div>
                                <div className="w-full md:w-1/2 mb-6">
                                    <select 
                                        className="w-full border p-2.5 rounded-lg focus:border-[var(--color-primary)] outline-none bg-gray-50 focus:bg-white text-sm font-medium text-gray-800 transition-all"
                                        value={agentConfig.reschedulePolicy || '24'}
                                        onChange={e => setAgentConfig({...agentConfig, reschedulePolicy: e.target.value})}
                                    >
                                        <option value="0">En cualquier momento (Sin límite)</option>
                                        <option value="12">Hasta 12 horas antes del turno</option>
                                        <option value="24">Hasta 24 horas antes del turno</option>
                                        <option value="48">Hasta 48 horas antes del turno</option>
                                        <option value="72">Hasta 72 horas antes del turno</option>
                                        <option value="disabled">No permitir reprogramar</option>
                                    </select>
                                </div>

                                {/* SWITCH Y TEXTO DE TÉRMINOS Y CONDICIONES */}
                                <div className="border-t border-gray-100 pt-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h5 className="font-bold text-sm text-gray-800 flex items-center gap-2"><Icon name="file-text" size={16} className="text-gray-500"/> Términos y Condiciones</h5>
                                            <p className="text-[10px] text-gray-500 mt-1">Exige al cliente aceptar tus reglas (señas, tolerancias) antes de pedir un turno.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                checked={agentConfig.showPolicyModal || false} 
                                                onChange={e => setAgentConfig({...agentConfig, showPolicyModal: e.target.checked})} 
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                        </label>
                                    </div>

                                    {agentConfig.showPolicyModal && (
                                        <div className="animate-fade-in">
                                            <textarea 
                                                rows="4" 
                                                className="w-full border border-gray-200 p-3 rounded-lg focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-sm text-gray-700 bg-gray-50 focus:bg-white transition-all resize-none"
                                                placeholder="Ej: Para reservar es obligatorio abonar una seña del 50%. En caso de cancelar con menos de 24hs de anticipación, la seña no será reembolsada. Tolerancia máxima de espera: 15 minutos."
                                                value={agentConfig.policyText || ''} 
                                                onChange={e => setAgentConfig({...agentConfig, policyText: e.target.value})}
                                            ></textarea>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ✅ NUEVO: HABILITAR DESCUENTOS */}
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 transition-all">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2"><Icon name="tag" size={16} className="text-purple-500"/> Descuentos y Promociones</h4>
                                        <p className="text-[10px] text-gray-500 mt-1">Habilita la opción de aplicar descuentos (en $ o %) al finalizar un servicio.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={agentConfig.enableDiscounts || false} 
                                            onChange={e => setAgentConfig({...agentConfig, enableDiscounts: e.target.checked})} 
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                                    </label>
                                </div>
                            </div>
                            
                            
                            {/* COBRO DE SEÑAS */}
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 transition-all">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-800">Cobro de Señas</h4>
                                        <p className="text-[10px] text-gray-500 mt-1">Solicita un pago anticipado para confirmar los turnos.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={agentConfig.requireDeposit || false} 
                                            onChange={e => setAgentConfig({...agentConfig, requireDeposit: e.target.checked})} 
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                    </label>
                                </div>
                                
                                {agentConfig.requireDeposit && (
                                    <div className="mt-5 pt-5 border-t border-gray-200 animate-fade-in space-y-5">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Monto de la Seña ($)</label>
                                            <input 
                                                type="number" 
                                                className="w-full md:w-1/2 border p-2.5 rounded-lg focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all" 
                                                value={agentConfig.depositAmount || ''} 
                                                onChange={e => setAgentConfig({...agentConfig, depositAmount: e.target.value})} 
                                                placeholder="Ej: 2000" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Método de Cobro</label>
                                            <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden w-full md:w-max shadow-sm">
                                                <button 
                                                    type="button"
                                                    onClick={() => setAgentConfig({...agentConfig, depositType: 'link'})}
                                                    className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold transition-colors ${(!agentConfig.depositType || agentConfig.depositType === 'link') ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'text-gray-500 hover:bg-gray-50'}`}
                                                >
                                                    Link de Pago
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setAgentConfig({...agentConfig, depositType: 'transfer'})}
                                                    className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold transition-colors ${agentConfig.depositType === 'transfer' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'text-gray-500 hover:bg-gray-50'}`}
                                                >
                                                    Transferencia
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            {(!agentConfig.depositType || agentConfig.depositType === 'link') ? (
                                                <div className="animate-fade-in">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Link de Pago (MercadoPago, Stripe...)</label>
                                                    <input type="url" className="w-full border p-2.5 rounded-lg focus:border-[var(--color-primary)] outline-none" value={agentConfig.paymentUrl || ''} onChange={e => setAgentConfig({...agentConfig, paymentUrl: e.target.value})} placeholder="https://..." />
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Alias / CBU</label>
                                                        <input type="text" className="w-full border p-2.5 rounded-lg focus:border-[var(--color-primary)] outline-none" value={agentConfig.transferAlias || ''} onChange={e => setAgentConfig({...agentConfig, transferAlias: e.target.value})} placeholder="mi.alias.mp" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre del Titular</label>
                                                        <input type="text" className="w-full border p-2.5 rounded-lg focus:border-[var(--color-primary)] outline-none" value={agentConfig.transferName || ''} onChange={e => setAgentConfig({...agentConfig, transferName: e.target.value})} placeholder="Juan Pérez" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CUIT / CUIL</label>
                                                        <input type="text" className="w-full border p-2.5 rounded-lg focus:border-[var(--color-primary)] outline-none" value={agentConfig.transferCuit || ''} onChange={e => setAgentConfig({...agentConfig, transferCuit: e.target.value})} placeholder="20-12345678-9" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. IDENTIDAD DE MARCA */}
                <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                    <button 
                        type="button" 
                        onClick={() => toggleSection('branding')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'branding' ? 'border-b border-gray-100' : ''}`}
                    >
                        <h3 className={accordionTitleClass}><Icon name="palette" className={accordionIconColor}/> Identidad de Marca</h3>
                        <Icon name={openSection === 'branding' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>

                    {openSection === 'branding' && (
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                            <div className="lg:col-span-1 border-r pr-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Logo</label>
                                <input type="text" placeholder="URL..." className="w-full border p-2.5 rounded-lg text-xs mb-3 outline-none focus:border-[var(--color-primary)]" value={branding.logoBase64 || ''} onChange={(e) => setBranding({...branding, logoBase64: e.target.value})} />
                                <div className="relative h-32 w-full border-2 border-dashed rounded-xl flex items-center justify-center bg-gray-50">
                                    {branding.logoBase64 ? (
                                        <><button type="button" onClick={() => setBranding({...branding, logoBase64: ''})} className="absolute top-2 right-2 text-red-400 bg-white rounded-full p-1 shadow-sm hover:text-red-600"><Icon name="x" size={16}/></button><img src={branding.logoBase64} className="max-h-24 object-contain" /></>
                                    ) : (
                                        <div className="text-center cursor-pointer relative w-full h-full flex flex-col items-center justify-center">
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                            <Icon name="upload-cloud" size={24} className="mx-auto text-gray-400"/>
                                            <p className="text-[10px] text-gray-500 mt-1">Subir Logo</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-4"><input type="color" value={branding.primaryColor} onChange={(e) => setBranding({...branding, primaryColor: e.target.value})} className="w-12 h-12 rounded-lg cursor-pointer" /><div><p className="text-sm font-bold text-gray-700">Color Primario</p></div></div>
                                <div className="flex items-center gap-4"><input type="color" value={branding.sidebarBg} onChange={(e) => setBranding({...branding, sidebarBg: e.target.value})} className="w-12 h-12 rounded-lg cursor-pointer" /><div><p className="text-sm font-bold text-gray-700">Fondo Sidebar</p></div></div>
                                <div className="flex items-center gap-4"><input type="color" value={branding.sidebarText} onChange={(e) => setBranding({...branding, sidebarText: e.target.value})} className="w-12 h-12 rounded-lg cursor-pointer" /><div><p className="text-sm font-bold text-gray-700">Texto Sidebar</p></div></div>
                                <div className="flex items-center gap-4"><input type="color" value={branding.sidebarActive} onChange={(e) => setBranding({...branding, sidebarActive: e.target.value})} className="w-12 h-12 rounded-lg cursor-pointer" /><div><p className="text-sm font-bold text-gray-700">Texto Activo</p></div></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. PLANTILLAS DE WHATSAPP */}
                <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                    <button 
                        type="button" 
                        onClick={() => toggleSection('whatsapp')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'whatsapp' ? 'border-b border-gray-100' : ''}`}
                    >
                        <h3 className={accordionTitleClass}><Icon name="message-circle" className={accordionIconColor}/> Plantillas de WhatsApp</h3>
                        <Icon name={openSection === 'whatsapp' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>

                    {openSection === 'whatsapp' && (
                        <div className="p-6 space-y-6 animate-fade-in bg-gray-50/50">
                            <p className="text-xs text-gray-500 mb-2 border-b border-gray-200 pb-4">Personaliza los mensajes automáticos. Los datos del cliente y del turno se completarán solos.</p>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-2">👋 Bienvenida a Nuevos Clientes</label>
                                <div className="text-sm text-gray-400 mb-2 italic">¡Hola *[Nombre Cliente]*!</div>
                                <textarea rows="3" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-700 resize-none transition-all" value={messagesConfig.welcome || ''} onChange={e=>setMessagesConfig({...messagesConfig, welcome: e.target.value})} placeholder="Escribe aquí tu mensaje de bienvenida..."></textarea>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-2">✅ Confirmación de Turno</label>
                                <div className="text-sm text-gray-400 mb-2 italic">¡Hola *[Nombre Cliente]*! Te confirmamos tu turno para *[Servicio]* el *[Día]* a las *[Hora]*.</div>
                                <textarea rows="2" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-700 resize-none transition-all" value={messagesConfig.confirm || ''} onChange={e=>setMessagesConfig({...messagesConfig, confirm: e.target.value})} placeholder="Ej: ¡Te esperamos!"></textarea>
                                <div className="text-sm text-gray-400 mt-2 italic">[Link de Google Maps] + [Link de Calendario]</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-2">❌ Rechazo / Reprogramación</label>
                                <div className="text-sm text-gray-400 mb-2 italic">¡Hola *[Nombre Cliente]*! Te escribimos de *[Tu Local]*.</div>
                                <textarea rows="3" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-700 resize-none transition-all" value={messagesConfig.reject || ''} onChange={e=>setMessagesConfig({...messagesConfig, reject: e.target.value})} placeholder="Motivo del rechazo y oferta de reprogramación..."></textarea>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-2">🎂 Saludo de Cumpleaños</label>
                                <div className="text-sm text-gray-400 mb-2 italic">¡Hola *[Nombre Cliente]*! En este día especial te deseamos un ¡MUY FELIZ CUMPLEAÑOS!</div>
                                <textarea rows="2" className="w-full border p-3 rounded-lg outline-none focus:border-[var(--color-primary)] text-gray-700 resize-none transition-all" value={messagesConfig.birthday || ''} onChange={e=>setMessagesConfig({...messagesConfig, birthday: e.target.value})} placeholder="Ej: Para festejar te regalamos..."></textarea>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. EMAIL MARKETING */}
                <div className="bg-white rounded-brand shadow-sm border border-brand-border overflow-hidden transition-all">
                    <button 
                        type="button" 
                        onClick={() => toggleSection('email')}
                        className={`w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors ${openSection === 'email' ? 'border-b border-gray-100' : ''}`}
                    >
                        <h3 className={accordionTitleClass}><Icon name="mail" className={accordionIconColor}/> Email Marketing Masivo</h3>
                        <Icon name={openSection === 'email' ? 'chevron-up' : 'chevron-down'} className="text-gray-400"/>
                    </button>

                    {openSection === 'email' && (
                        <div className="p-6 animate-fade-in">
                            <div className="space-y-4 mb-6">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asunto del Correo</label><input type="text" className="w-full border p-3 rounded-lg focus:border-[var(--color-primary)] outline-none transition-colors" value={messagesConfig.promoSubject || ''} onChange={e=>setMessagesConfig({...messagesConfig, promoSubject: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cuerpo del Mensaje</label><textarea rows="3" className="w-full border p-3 rounded-lg focus:border-[var(--color-primary)] outline-none resize-none transition-colors" value={messagesConfig.promo || ''} onChange={e=>setMessagesConfig({...messagesConfig, promo: e.target.value})}></textarea></div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                {emailGroups.length === 0 ? (
                                    <button type="button" onClick={handlePreparePromo} className="bg-[var(--color-primary)] text-[var(--color-primary-text)] px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Icon name="users" size={18}/> Preparar Lista de Envío</button>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-xs text-gray-700 font-medium">Se han creado {emailGroups.length} grupos de 50 correos. Haz clic en cada uno para abrir tu correo:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {emailGroups.map((group, index) => (
                                                <div key={index} className="flex shadow-sm hover:shadow-md transition-shadow rounded-lg">
                                                    <a href={getGmailLink(group)} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-l-lg font-bold text-xs no-underline hover:bg-gray-50 flex items-center gap-1 transition-colors"><Icon name="mail" size={14}/> Abrir en Gmail (G{index + 1})</a>
                                                    <button type="button" onClick={() => { navigator.clipboard.writeText(group.join(',')); notify("Correos copiados. Pégalos en CCO/BCC de tu correo.", "success"); }} className="bg-white border-y border-r border-gray-300 text-gray-700 px-3 py-2 rounded-r-lg hover:bg-gray-50 transition-colors" title="Copiar lista de correos"><Icon name="copy" size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => setEmailGroups([])} className="text-xs text-gray-500 hover:text-gray-800 font-bold underline decoration-gray-300 underline-offset-2">Reiniciar lista de envío</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="pt-10 pb-20 flex justify-end sticky bottom-0 z-10 p-4">
                    <button 
                        type="submit" 
                        disabled={isSaving} 
                        className="bg-[var(--color-primary)] text-[var(--color-primary-text)] px-12 py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition-transform w-full md:w-auto"
                    >
                        {isSaving ? "Guardando..." : "Guardar Todo"}
                    </button>                
                </div>
            </form>
        </div>
    );
};
