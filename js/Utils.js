const Icon = ({ name, size = 20, className = '', style = {} }) => {
    if (!name) return null;
    
    // Convertir nombres como 'check-circle' a 'CheckCircle'
    const pascalName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    
    // Intentar buscar el icono en la librería Lucide cargada
    const LucideIcon = window.lucide && window.lucide.icons ? window.lucide.icons[pascalName] : null;

    if (!LucideIcon) {
        // Si no existe, devolvemos un círculo simple para que la app NO CRASHEE
        return <span className={className} style={{display:'inline-block', width: size, height: size, borderRadius: '50%', backgroundColor: '#ccc', ...style}}></span>;
    }

    return <LucideIcon size={size} className={className} style={style} />;
};;

const Logo = ({ className = "" }) => <img src={LOGO_URL} alt="Logo" className={`object-contain drop-shadow-sm ${className}`} style={{ width: 'auto', maxHeight: '120px' }} />;

const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);
const formatDate = (dateStr) => { 
    if (!dateStr) return '-'; 
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Por si no es una fecha válida
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('54')) return '+' + cleaned;
  return '+549' + cleaned;
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
    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3">
            {toasts.map(t => (
                <div key={t.id} className={`min-w-[280px] p-4 rounded-brand shadow-soft flex items-center gap-3 animate-bounce transition-all border ${
                    t.type === 'success' ? 'bg-white border-primary text-brand-text' : 
                    t.type === 'error' ? 'bg-white border-accent text-brand-text' : 
                    'bg-white border-brand-border text-brand-text'
                }`}>
                    <Icon name={t.type === 'success' ? 'check-circle' : 'alert-circle'} size={20} className={t.type === 'success' ? 'text-primary-dark' : 'text-accent'} />
                    <span className="text-sm font-medium">{t.msg}</span>
                    <button onClick={() => removeToast(t.id)} className="ml-auto opacity-40 hover:opacity-100"><Icon name="x" size={14}/></button>
                </div>
            ))}
        </div>
    )
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-brand-text/20 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
         <div className="bg-white rounded-brand p-8 w-full max-w-sm shadow-soft border border-brand-border animate-bounce">
            <h3 className="text-xl font-bold text-brand-text mb-3">{title}</h3>
            <p className="text-brand-text-light mb-8 leading-relaxed whitespace-pre-line">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="px-5 py-2.5 text-brand-text-light font-medium hover:bg-brand-bg rounded-brand transition-colors">{cancelText}</button>
                <button onClick={onConfirm} className="px-5 py-2.5 bg-primary text-brand-text font-bold rounded-brand hover:bg-primary-dark hover:text-white shadow-lg shadow-primary/20 transition-all">{confirmText}</button>
            </div>
         </div>
      </div>
    )
};
