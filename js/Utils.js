const Icon = ({ name, size = 20, className = '', style = {} }) => {
    const ref = React.useRef(null);

    React.useEffect(() => {
        if (window.lucide && ref.current) {
            // Preparamos la etiqueta que Lucide necesita leer
            ref.current.innerHTML = `<i data-lucide="${name}"></i>`;
            // Le pedimos a Lucide que la convierta en el ícono SVG real
            window.lucide.createIcons({
                root: ref.current,
                attrs: {
                    width: size,
                    height: size,
                    class: className
                }
            });
        }
    }, [name, size, className]);

    return (
        <span 
            ref={ref} 
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
        ></span>
    );
};

const Logo = ({ className = "" }) => <img src={LOGO_URL} alt="Logo" className={`object-contain drop-shadow-sm ${className}`} style={{ width: 'auto', maxHeight: '120px' }} />;

const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);

const formatDate = (dateStr) => { 
    if (!dateStr) return '-'; 
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ✅ FUNCIÓN CORREGIDA: Limpia todo y NUNCA devuelve el signo "+"
window.formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); 
    if (!cleaned.startsWith('54')) {
        cleaned = '549' + cleaned;
    } else if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
        cleaned = '549' + cleaned.substring(2);
    }
    return cleaned;
};

const canClientModify = (dateIso) => {
    const apptDate = new Date(dateIso);
    const now = new Date();
    const diffHrs = (apptDate - now) / (1000 * 60 * 60);
    return diffHrs >= 48;
};

const StorageService = {
  loadAllData: (email) => new Promise((resolve) => google.script.run.withSuccessHandler(resolve).loadInitialData(email)),
  saveGeneric: (email, type, data) => new Promise((resolve) => google.script.run.withSuccessHandler(resolve).saveData(email, type, JSON.stringify(data)))
};

const ToastContainer = ({ toasts, removeToast }) => {
    if (!toasts || toasts.length === 0) return null;
    return (
        <div className="fixed top-6 right-6 z-[500] flex flex-col gap-3">
            {toasts.map(t => (
                <div key={t.id} className="min-w-[280px] p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in transition-all bg-white border border-gray-100">
                    <Icon name={t.type === 'success' ? 'check-circle' : 'alert-circle'} size={20} className={t.type === 'success' ? 'text-green-500' : 'text-red-500'} />
                    <span className="text-sm font-bold text-gray-700">{t.msg}</span>
                    <button onClick={() => removeToast(t.id)} className="ml-auto text-gray-400 hover:text-gray-600"><Icon name="x" size={14}/></button>
                </div>
            ))}
        </div>
    );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
         <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-scale-in">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
            <p className="text-gray-500 mb-8 leading-relaxed text-sm">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">{cancelText}</button>
                <button onClick={onConfirm} className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg transition-all">{confirmText}</button>
            </div>
         </div>
      </div>
    );
};

// ✅ NUEVO DESPLEGABLE PERSONALIZADO (ANTI MODO-OSCURO Y ANTI-LAG)
const CustomSelect = ({ value, onChange, options, placeholder = "Seleccione...", disabled = false, className = "" }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Buscar la opción seleccionada
    const selectedOption = options.find(opt => String(opt.value) === String(value));
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div 
                className={`w-full border border-gray-300 p-2.5 rounded-lg bg-white text-sm flex justify-between items-center transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-[var(--color-primary)] shadow-sm'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`truncate ${!value ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{displayLabel}</span>
                <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} className="text-gray-400 shrink-0" />
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-[1000] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                    {options.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 italic text-center">Sin opciones</div>
                    ) : (
                        options.map((opt, i) => {
                            const isSelected = String(opt.value) === String(value);
                            return (
                                <div 
                                    key={i}
                                    className={`p-3 text-sm cursor-pointer transition-colors ${isSelected ? 'bg-[var(--color-primary)] text-white font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                    onClick={() => {
                                        onChange({ target: { value: opt.value } }); // Simulamos el evento (e.target.value)
                                        setIsOpen(false);
                                    }}
                                >
                                    {opt.label}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
