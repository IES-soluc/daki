'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import { Music, Search, Send, User, MessageSquare } from 'lucide-react'
import { useConfig } from '@/components/ConfigProvider'

export default function WidgetPedidos() {
    const { nome_radio } = useConfig()
    const supabase = createClient()
    // Estados de Busca
    const [busca, setBusca] = useState('')
    const [resultados, setResultados] = useState<any[]>([])
    const [isBuscando, setIsBuscando] = useState(false)
    const [musicaSelecionada, setMusicaSelecionada] = useState<any>(null)
    const [mostrarDropdown, setMostrarDropdown] = useState(false)

    // Estados do Formulário
    const [nomeOuvinte, setNomeOuvinte] = useState('')
    const [mensagem, setMensagem] = useState('')
    const [enviando, setEnviando] = useState(false)

    // Debounce de busca
    useEffect(() => {
        if (busca.length < 2) {
            setResultados([])
            return
        }
        const buscarMusicas = async () => {
            setIsBuscando(true)
            const { data } = await supabase
                .from('audios')
                .select('id, titulo, artista')
                .eq('tipo', 'musica')
                .eq('ativo', true)
                .or(`titulo.ilike.%${busca}%,artista.ilike.%${busca}%`)
                .limit(10)

            setResultados(data || [])
            setIsBuscando(false)
            setMostrarDropdown(true)
        }
        const timer = setTimeout(buscarMusicas, 300)
        return () => clearTimeout(timer)
    }, [busca])

    const selecionarMusica = (musica: any) => {
        setMusicaSelecionada(musica)
        setBusca('')
        setMostrarDropdown(false)
    }

    async function enviarPedido(e: React.FormEvent) {
        e.preventDefault()
        if (!musicaSelecionada) return toast.error('Selecione uma música da lista!')
        if (!nomeOuvinte) return toast.error('Informe seu nome.')

        setEnviando(true)
        const { error } = await supabase.from('pedidos').insert([{
            audio_id: musicaSelecionada.id,
            nome_ouvinte: nomeOuvinte,
            mensagem: mensagem || null
        }])
        setEnviando(false)

        if (error) {
            toast.error('Erro ao enviar pedido.')
        } else {
            toast.success('Pedido enviado para o locutor!')
            setMusicaSelecionada(null)
            setNomeOuvinte('')
            setMensagem('')
        }
    }

    return (
        // Um design mais compacto, ideal para iframes. Fundo transparente para herdar a cor do WP.
        <div className="w-full bg-transparent font-main p-1">
            <Toaster position="top-center" />

            <form onSubmit={enviarPedido} className="bg-surface p-4 sm:p-5 rounded-2xl shadow-sm border border-border space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                        <Music size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-text-main leading-tight">Peça sua Música</h2>
                        <p className="text-xs text-text-muted">Direto para a {nome_radio}</p>
                    </div>
                </div>

                {/* PASSO 1: A BUSCA DA MÚSICA */}
                <div>
                    {!musicaSelecionada ? (
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-text-muted" size={18} />
                            <input
                                type="text"
                                value={busca}
                                onChange={e => { setBusca(e.target.value); setMostrarDropdown(true) }}
                                placeholder="Buscar música ou cantor..."
                                className="w-full p-2.5 pl-10 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                                autoComplete="off"
                            />
                            {isBuscando && <span className="absolute right-3 top-3 text-[10px] text-primary font-bold animate-pulse uppercase">Buscando</span>}

                            {/* DROPDOWN COMPACTO */}
                            {mostrarDropdown && resultados.length > 0 && (
                                <ul className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-border">
                                    {resultados.map(audio => (
                                        <li key={audio.id} onClick={() => selecionarMusica(audio)} className="p-2.5 hover:bg-background cursor-pointer transition flex items-center justify-between group">
                                            <div className="truncate pr-2">
                                                <p className="font-bold text-text-main text-sm truncate">{audio.titulo}</p>
                                                <p className="text-xs text-text-muted truncate">{audio.artista}</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition uppercase shrink-0">Escolher</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {mostrarDropdown && busca.length > 2 && resultados.length === 0 && !isBuscando && (
                                <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl p-3 text-center text-xs text-text-muted">
                                    Música não encontrada.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl">
                            <div className="flex items-center gap-2 truncate pr-2">
                                <Music className="text-primary shrink-0" size={16} />
                                <div className="truncate">
                                    <p className="font-bold text-text-main text-sm truncate">{musicaSelecionada.titulo}</p>
                                    <p className="text-[10px] font-medium text-text-muted truncate">{musicaSelecionada.artista}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setMusicaSelecionada(null)} className="text-[10px] font-bold text-primary hover:underline uppercase shrink-0">
                                Trocar
                            </button>
                        </div>
                    )}
                </div>

                {/* PASSO 2: DADOS DO OUVINTE (Empilhados para caber em barras laterais) */}
                <div className="space-y-3 pt-3 border-t border-border/50">
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-text-muted" size={16} />
                        <input
                            type="text"
                            value={nomeOuvinte}
                            onChange={e => setNomeOuvinte(e.target.value)}
                            placeholder="Seu Nome (Ex: João Silva)"
                            className="w-full p-2.5 pl-10 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                    </div>
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 text-text-muted" size={16} />
                        <input
                            type="text"
                            value={mensagem}
                            onChange={e => setMensagem(e.target.value)}
                            placeholder="Recado (Opcional)"
                            className="w-full p-2.5 pl-10 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                    </div>
                </div>

                <button type="submit" disabled={enviando || !musicaSelecionada} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm mt-2">
                    <Send size={16} /> {enviando ? 'Enviando...' : 'Pedir Música'}
                </button>
            </form>
        </div>
    )
}