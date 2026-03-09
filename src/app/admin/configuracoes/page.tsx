'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import { Settings, Save, Palette, Type, Layout, Share2, Image as ImageIcon } from 'lucide-react'

const supabase = createClient()
// 1. Interface para tipagem do estado
interface ConfigState {
    nome_radio: string; descricao_radio: string; texto_rodape: string;
    url_logo: string; url_favicon: string;
    cor_primaria: string; cor_secundaria: string;
    cor_fundo: string; cor_superficie: string;
    cor_texto: string; cor_texto_secundario: string;
    fonte_principal: string;
    whatsapp: string; instagram: string; facebook: string; youtube: string;
}

// 2. COMPONENTES AUXILIARES FORA DO COMPONENTE PRINCIPAL (Isso resolve o bug do foco)
const ColorPickerField = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div>
        <label className="block text-sm font-bold text-text-muted mb-1">{label}</label>
        <div className="flex gap-2">
            <input
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="h-12 w-12 rounded cursor-pointer border-0 p-0 shadow-sm shrink-0"
            />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="flex-1 p-3 border border-border rounded-xl outline-none bg-background text-text-main font-mono uppercase focus:ring-2 focus:ring-primary min-w-0"
            />
        </div>
    </div>
)

const InputField = ({ label, value, onChange, placeholder, type = "text" }: { label: string, value: string, onChange: (val: string) => void, placeholder?: string, type?: string }) => (
    <div>
        <label className="block text-sm font-bold text-text-muted mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full p-3 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main"
        />
    </div>
)

// 3. COMPONENTE PRINCIPAL DA PÁGINA
export default function Configuracoes() {
    const [loading, setLoading] = useState(false)
    const [config, setConfig] = useState<ConfigState>({
        nome_radio: '', descricao_radio: '', texto_rodape: '',
        url_logo: '', url_favicon: '',
        cor_primaria: '#10b981', cor_secundaria: '#0f172a',
        cor_fundo: '#f8fafc', cor_superficie: '#ffffff',
        cor_texto: '#1e293b', cor_texto_secundario: '#64748b',
        fonte_principal: 'Inter',
        whatsapp: '', instagram: '', facebook: '', youtube: ''
    })

    useEffect(() => {
        async function fetchConfig() {
            const { data } = await supabase.from('configuracoes').select('*').single()
            if (data) {
                // Tratando nulos do banco para não quebrar os inputs controlados
                const safeData = Object.keys(data).reduce((acc, key) => {
                    acc[key as keyof ConfigState] = data[key] || '';
                    return acc;
                }, {} as any);
                setConfig((prev) => ({ ...prev, ...safeData }))
            }
        }
        fetchConfig()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // Remove campos vazios para salvar como NULL no banco
        const payload = Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v === '' ? null : v]))

        const { error } = await supabase.from('configuracoes').update(payload).eq('id', 1)
        setLoading(false)

        if (error) {
            toast.error('Erro ao salvar configurações')
        } else {
            toast.success('Tema e SEO aplicados com sucesso!')
            setTimeout(() => window.location.reload(), 2000)
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <Toaster />
            <h1 className="text-3xl font-bold text-text-main flex items-center gap-3">
                <Settings className="text-primary" size={32} /> Setup Global (White-Label)
            </h1>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* BLOCO 1: Identidade Visual e SEO */}
                <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2 border-b border-border pb-3 text-text-main">
                        <Type size={20} className="text-primary" /> Marca e SEO (Google)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Nome da Rádio / Portal" value={config.nome_radio} onChange={val => setConfig({ ...config, nome_radio: val })} placeholder="Ex: Rádio Sucesso FM" />
                        <InputField label="Slogan / Texto do Rodapé" value={config.texto_rodape} onChange={val => setConfig({ ...config, texto_rodape: val })} placeholder="Ex: A número 1 da cidade" />
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-text-muted mb-1">Descrição para SEO (Google e Compartilhamentos)</label>
                            <textarea
                                value={config.descricao_radio}
                                onChange={e => setConfig({ ...config, descricao_radio: e.target.value })}
                                placeholder="Descreva sua rádio em até 160 caracteres..."
                                className="w-full p-3 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main resize-none h-24"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOCO 2: Mídias (Logo e Favicon) */}
                <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2 border-b border-border pb-3 text-text-main">
                        <ImageIcon size={20} className="text-primary" /> Logotipo e Ícone
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="URL da Logo Principal" value={config.url_logo} onChange={val => setConfig({ ...config, url_logo: val })} placeholder="https://seudominio.com/logo.png" />
                        <InputField label="URL do Favicon (Ícone da Aba)" value={config.url_favicon} onChange={val => setConfig({ ...config, url_favicon: val })} placeholder="https://seudominio.com/favicon.ico" />
                    </div>
                    <p className="text-xs text-text-muted">
                        Dica: Faça o upload das imagens na aba "Storage" do Supabase e cole os links públicos aqui.
                    </p>
                </div>

                {/* BLOCO 3: Tipografia e Cores da Marca */}
                <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2 border-b border-border pb-3 text-text-main">
                        <Palette size={20} className="text-primary" /> Tipografia e Cores Base
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-text-muted mb-1">Fonte do Site</label>
                            <select value={config.fonte_principal} onChange={e => setConfig({ ...config, fonte_principal: e.target.value })} className="w-full p-3 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main font-bold">
                                <option value="Inter">Inter (Moderna)</option>
                                <option value="Roboto">Roboto (Clássica)</option>
                                <option value="Poppins">Poppins (Arredondada)</option>
                                <option value="Montserrat">Montserrat (Elegante)</option>
                            </select>
                        </div>
                        <ColorPickerField label="Cor Primária (Marca)" value={config.cor_primaria} onChange={val => setConfig({ ...config, cor_primaria: val })} />
                        <ColorPickerField label="Cor Secundária (Detalhes)" value={config.cor_secundaria} onChange={val => setConfig({ ...config, cor_secundaria: val })} />
                    </div>
                </div>

                {/* BLOCO 4: Estrutura (Fundo e Textos) */}
                <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2 border-b border-border pb-3 text-text-main">
                        <Layout size={20} className="text-primary" /> Estrutura Avançada (Cores)
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <ColorPickerField label="Fundo da Página" value={config.cor_fundo} onChange={val => setConfig({ ...config, cor_fundo: val })} />
                        <ColorPickerField label="Fundo dos Cartões" value={config.cor_superficie} onChange={val => setConfig({ ...config, cor_superficie: val })} />
                        <ColorPickerField label="Texto Principal" value={config.cor_texto} onChange={val => setConfig({ ...config, cor_texto: val })} />
                        <ColorPickerField label="Texto Secundário" value={config.cor_texto_secundario} onChange={val => setConfig({ ...config, cor_texto_secundario: val })} />
                    </div>
                    <p className="text-xs text-orange-500 font-bold bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                        ⚠️ Atenção: Garanta que a cor do "Texto Principal" tenha leitura sobre as cores de "Fundo".
                    </p>
                </div>

                {/* BLOCO 5: Redes Sociais */}
                <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2 border-b border-border pb-3 text-text-main">
                        <Share2 size={20} className="text-primary" /> Redes Sociais (Links)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="WhatsApp (Apenas números)" value={config.whatsapp} onChange={val => setConfig({ ...config, whatsapp: val })} placeholder="Ex: 5511999999999" />
                        <InputField label="Instagram (URL Completa)" value={config.instagram} onChange={val => setConfig({ ...config, instagram: val })} placeholder="https://instagram.com/suaradio" />
                        <InputField label="Facebook (URL Completa)" value={config.facebook} onChange={val => setConfig({ ...config, facebook: val })} placeholder="https://facebook.com/suaradio" />
                        <InputField label="YouTube (URL Completa)" value={config.youtube} onChange={val => setConfig({ ...config, youtube: val })} placeholder="https://youtube.com/@suaradio" />
                    </div>
                </div>

                {/* BOTÃO DE SALVAR */}
                <div className="sticky bottom-4 z-10 pt-4">
                    <button type="submit" disabled={loading} className="w-full bg-primary hover:opacity-90 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition shadow-lg shadow-primary/20">
                        <Save size={24} /> {loading ? 'Compilando e Salvando Layout...' : 'Aplicar Design Global'}
                    </button>
                </div>
            </form>
        </div>
    )
}