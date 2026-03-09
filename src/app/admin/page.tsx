'use client'
import { useState, useEffect, useRef } from 'react'
import {
    Headphones, Radio, Users, Activity,
    PlayCircle, Check, X, Clock, Music,
    Zap, Square, RefreshCw, SkipForward, Search, Play, Settings2
} from 'lucide-react'
import { useConfig } from '@/components/ConfigProvider'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import Link from 'next/link'

// Tipagens (Removidas as Notícias)
interface DashboardStats { audios: number; regrasAtivas: number; pedidosPendentes: number; playlists: number; }
interface Pedido { id: string; nome_ouvinte: string; mensagem: string; audios: { titulo: string; artista: string }; }
interface AudioItem { id: string; titulo: string; artista: string; tipo: string; }

export default function AdminDashboard() {
    const supabase = createClient()
    const { nome_radio } = useConfig()
    const [loading, setLoading] = useState(true)

    // Estados do Dashboard
    const [stats, setStats] = useState<DashboardStats>({ audios: 0, regrasAtivas: 0, pedidosPendentes: 0, playlists: 0 })
    const [ultimosPedidos, setUltimosPedidos] = useState<Pedido[]>([])
    const [radioStatus, setRadioStatus] = useState({ isOnline: false, isLive: false, currentSong: 'Sincronizando...' })

    // Estados do Estúdio Virtual
    const [busca, setBusca] = useState('')
    const [resultados, setResultados] = useState<AudioItem[]>([])
    const [enviando, setEnviando] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // 1. CARREGAR DADOS DO DASHBOARD FOCADO NA RÁDIO
    const fetchDashboardData = async () => {
        try {
            const [countAudios, countRegras, countPedidos, countPlaylists, pedidosRecentes] = await Promise.all([
                supabase.from('audios').select('*', { count: 'exact', head: true }).eq('ativo', true),
                supabase.from('regras_programacao').select('*', { count: 'exact', head: true }).eq('ativa', true),
                supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
                supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('ativa', true),
                supabase.from('pedidos').select('*, audios(titulo, artista)').eq('status', 'pendente').order('created_at', { ascending: false }).limit(5)
            ])

            setStats({
                audios: countAudios.count || 0, regrasAtivas: countRegras.count || 0,
                pedidosPendentes: countPedidos.count || 0, playlists: countPlaylists.count || 0
            })
            if (pedidosRecentes.data) setUltimosPedidos(pedidosRecentes.data as unknown as Pedido[])
        } catch (error) {
            console.error("Erro ao carregar dashboard", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchDashboardData() }, [])

    // 2. MONITOR DO ICECAST (SSE)
    useEffect(() => {
        const eventSource = new EventSource('/api/icecast')
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.error) return setRadioStatus({ isOnline: false, isLive: false, currentSong: 'Transmissão Offline' })

                let sources = Array.isArray(data?.icestats?.source) ? data.icestats.source : (data?.icestats?.source ? [data.icestats.source] : [])
                const live = sources.find((s: any) => s?.listenurl?.endsWith('/live'))
                const autodj = sources.find((s: any) => s?.listenurl?.endsWith('/autodj'))

                let isLiveNow = false
                let textMusic = "Conectando..."

                if (live && live.server_name && live.server_name !== 'Nossa Web Rádio') {
                    isLiveNow = true; textMusic = live.title || live.server_description || "Acompanhe a transmissão"
                } else if (autodj && autodj.server_name === 'Nossa Web Rádio') {
                    isLiveNow = false; textMusic = autodj.title || autodj.server_description || "Programação Normal"
                } else if (live) {
                    isLiveNow = false; textMusic = live.title || live.server_description || "Rádio no Ar"
                } else {
                    return setRadioStatus({ isOnline: false, isLive: false, currentSong: 'Transmissão Offline' })
                }
                setRadioStatus({ isOnline: true, isLive: isLiveNow, currentSong: textMusic })
            } catch (err) { }
        }
        return () => eventSource.close()
    }, [])

    // 3. BUSCA DE ÁUDIOS PARA O ESTÚDIO VIRTUAL
    useEffect(() => {
        const handler = setTimeout(() => {
            if (busca.length < 2) { setResultados([]); return }
            const buscarAudios = async () => {
                const { data } = await supabase.from('audios').select('id, titulo, artista, tipo').eq('ativo', true).ilike('titulo', `%${busca}%`).limit(8)
                if (data) setResultados(data as AudioItem[])
            }
            buscarAudios()
        }, 300)
        return () => clearTimeout(handler)
    }, [busca])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setResultados([])
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [dropdownRef])

    // 4. AÇÕES (PEDIDOS E COMANDOS)
    const lidarComPedido = async (id: string, acao: 'aprovado' | 'rejeitado') => {
        const loadingToast = toast.loading('Processando...')
        const { error } = await supabase.from('pedidos').update({ status: acao }).eq('id', id)
        if (error) toast.error('Erro ao atualizar.', { id: loadingToast })
        else { toast.success(`Pedido ${acao}!`, { id: loadingToast }); fetchDashboardData() }
    }

    const dispararComando = async (comando: 'skip' | 'stop' | 'restart' | 'play_now', audio_id: string | null = null) => {
        setEnviando(true)
        const toastId = toast.loading('Enviando comando ao AutoDJ...')
        const { error } = await supabase.from('comandos_dj').insert({ comando, audio_id, processado: false })
        setEnviando(false)
        if (error) toast.error('Falha na comunicação.', { id: toastId })
        else {
            toast.success('Comando enviado!', { id: toastId })
            setBusca('')
            setResultados([])
        }
    }

    if (loading) return <div className="p-10 flex justify-center text-primary"><Activity size={40} className="animate-spin" /></div>

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <Toaster />

            {/* CABEÇALHO & STATUS */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-surface p-8 rounded-3xl border border-border shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight">Centro de Comando</h1>
                    <p className="text-text-muted mt-1 font-medium">Estúdio Virtual da <strong className="text-primary">{nome_radio}</strong>.</p>
                </div>
                <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border ${radioStatus.isOnline ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="relative flex h-4 w-4 shrink-0">
                        {radioStatus.isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-4 w-4 ${radioStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </div>
                    <div className="overflow-hidden">
                        <p className={`text-xs font-black uppercase tracking-widest ${radioStatus.isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {radioStatus.isOnline ? (radioStatus.isLive ? 'Locutor Ao Vivo' : 'AutoDJ Operando') : 'Sistema Offline'}
                        </p>
                        <p className="text-text-main font-bold truncate max-w-[200px]" title={radioStatus.currentSong}>{radioStatus.currentSong}</p>
                    </div>
                </div>
            </div>

            {/* ESTÚDIO VIRTUAL (CONTROLES AO VIVO) */}
            <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm space-y-6 relative">
                <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none"><Zap size={200} /></div>

                <div className="relative z-10">
                    <h2 className="text-xl font-black text-text-main flex items-center gap-2 mb-6">
                        <Zap className="text-primary" size={24} /> Estúdio Virtual (Ações Imediatas)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Botões de Ação */}
                        <div className="grid grid-cols-3 gap-4">
                            <button onClick={() => dispararComando('stop')} disabled={enviando} className="flex flex-col items-center justify-center p-4 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-2xl transition-all font-bold gap-2 border border-red-500/20">
                                <Square size={28} /> Parar
                            </button>
                            <button onClick={() => dispararComando('restart')} disabled={enviando} className="flex flex-col items-center justify-center p-4 bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white rounded-2xl transition-all font-bold gap-2 border border-blue-500/20">
                                <RefreshCw size={28} /> Reiniciar
                            </button>
                            <button onClick={() => dispararComando('skip')} disabled={enviando} className="flex flex-col items-center justify-center p-4 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-2xl transition-all font-bold gap-2 border border-primary/20">
                                <SkipForward size={28} /> Avançar
                            </button>
                        </div>

                        {/* Fura Fila / Tocar Efeito */}
                        <div className="space-y-3 relative" ref={dropdownRef}>
                            <label className="text-sm font-bold text-text-muted">Injetar Áudio Agora (Fura-Fila Absoluto)</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-3.5 text-text-muted" size={20} />
                                <input
                                    type="text"
                                    placeholder="Busque música, vinheta ou efeito..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    className="w-full p-3 pl-12 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main shadow-inner"
                                />
                            </div>

                            {/* DROPDOWN BLINDADO */}
                            {resultados.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 z-[100]">
                                    <ul className="bg-surface border border-border rounded-xl overflow-hidden shadow-2xl divide-y divide-border max-h-80 overflow-y-auto">
                                        {resultados.map(audio => (
                                            <li key={audio.id} className="p-3 flex items-center justify-between hover:bg-background transition-colors cursor-default">
                                                <div className="truncate pr-4 flex-1">
                                                    <p className="font-bold text-text-main text-sm truncate">{audio.titulo}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded uppercase ${audio.tipo === 'musica' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                                            audio.tipo === 'vinheta' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                                                'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                                            }`}>
                                                            {audio.tipo}
                                                        </span>
                                                        <span className="text-xs text-text-muted font-medium truncate">{audio.artista}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => dispararComando('play_now', audio.id)} className="bg-primary hover:bg-primary/90 text-white p-2.5 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shrink-0 shadow-sm">
                                                    <Play size={14} fill="currentColor" /> Tocar
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs DA RÁDIO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex items-center gap-5 hover:border-primary/50 transition-colors">
                    <div className="bg-primary/10 p-4 rounded-2xl text-primary"><Headphones size={28} /></div>
                    <div><p className="text-text-muted text-xs font-black uppercase tracking-wider mb-1">Acervo</p><p className="text-3xl font-black text-text-main leading-none">{stats.audios}</p></div>
                </div>
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex items-center gap-5 hover:border-primary/50 transition-colors">
                    <div className="bg-primary/10 p-4 rounded-2xl text-primary"><Music size={28} /></div>
                    <div><p className="text-text-muted text-xs font-black uppercase tracking-wider mb-1">Playlists</p><p className="text-3xl font-black text-text-main leading-none">{stats.playlists}</p></div>
                </div>
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex items-center gap-5 hover:border-primary/50 transition-colors">
                    <div className="bg-primary/10 p-4 rounded-2xl text-primary"><Settings2 size={28} /></div>
                    <div><p className="text-text-muted text-xs font-black uppercase tracking-wider mb-1">Regras AutoDJ</p><p className="text-3xl font-black text-text-main leading-none">{stats.regrasAtivas}</p></div>
                </div>
                <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex items-center gap-5 hover:border-primary/50 transition-colors relative overflow-hidden">
                    {stats.pedidosPendentes > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 animate-pulse" />}
                    <div className={`${stats.pedidosPendentes > 0 ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'} p-4 rounded-2xl`}><Users size={28} /></div>
                    <div><p className="text-text-muted text-xs font-black uppercase tracking-wider mb-1">Pendentes</p><p className="text-3xl font-black text-text-main leading-none">{stats.pedidosPendentes}</p></div>
                </div>
            </div>

            {/* INFERIOR: Pedidos e Atalhos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-text-main flex items-center gap-2"><Clock className="text-primary" size={20} /> Pedidos dos Ouvintes</h2>
                        <Link href="/admin/pedidos" className="text-sm font-bold text-primary hover:underline">Ver todos</Link>
                    </div>

                    <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden">
                        {ultimosPedidos.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center justify-center">
                                <Check size={48} className="text-text-muted mb-4 opacity-20" />
                                <p className="text-text-muted font-bold text-lg">A fila está livre.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {ultimosPedidos.map(pedido => (
                                    <li key={pedido.id} className="p-6 hover:bg-background/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <p className="font-bold text-text-main text-lg leading-tight">{pedido.audios?.titulo}</p>
                                            <p className="text-sm text-primary font-bold mb-2">{pedido.audios?.artista}</p>
                                            <p className="text-sm text-text-muted bg-background p-3 rounded-xl border border-border border-dashed inline-block"><strong className="text-text-main">{pedido.nome_ouvinte}</strong>: {pedido.mensagem || 'Sem mensagem.'}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => lidarComPedido(pedido.id, 'aprovado')} className="bg-green-500/10 hover:bg-green-500 hover:text-white text-green-600 p-3 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm"><Check size={20} /> Aprovar</button>
                                            <button onClick={() => lidarComPedido(pedido.id, 'rejeitado')} className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 p-3 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm"><X size={20} /> </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-black text-text-main flex items-center gap-2"><PlayCircle className="text-primary" size={20} /> Ações Rápidas</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <Link href="/admin/audios" className="bg-surface p-5 rounded-2xl border border-border hover:border-primary hover:shadow-sm transition-all group flex items-center justify-between">
                            <div><h3 className="font-bold text-text-main group-hover:text-primary transition-colors">Subir Músicas</h3><p className="text-xs text-text-muted mt-1">Google Drive</p></div>
                            <div className="bg-background p-3 rounded-full text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors"><Music size={20} /></div>
                        </Link>
                        <Link href="/admin/playlists" className="bg-surface p-5 rounded-2xl border border-border hover:border-primary hover:shadow-sm transition-all group flex items-center justify-between">
                            <div><h3 className="font-bold text-text-main group-hover:text-primary transition-colors">Montar Grade</h3><p className="text-xs text-text-muted mt-1">Editar playlists e Blocos</p></div>
                            <div className="bg-background p-3 rounded-full text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors"><Headphones size={20} /></div>
                        </Link>
                        <Link href="/admin/regras" className="bg-surface p-5 rounded-2xl border border-border hover:border-primary hover:shadow-sm transition-all group flex items-center justify-between">
                            <div><h3 className="font-bold text-text-main group-hover:text-primary transition-colors">Ajustar Inteligência</h3><p className="text-xs text-text-muted mt-1">Regras do AutoDJ</p></div>
                            <div className="bg-background p-3 rounded-full text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors"><Settings2 size={20} /></div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}