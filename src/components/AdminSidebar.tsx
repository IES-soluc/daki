'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
    Headphones, ListMusic, LogOut, Home, Radio,
    Settings, Users, ShieldAlert, Upload,
    Play, Square, Loader2
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useConfig } from '@/components/ConfigProvider'

export default function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { nome_radio } = useConfig()

    // --- ESTADOS DO PLAYER ---
    const [isPlaying, setIsPlaying] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)
    const [musicaAtual, setMusicaAtual] = useState('Conectando...')
    const [radioModo, setRadioModo] = useState<'live' | 'normal' | 'standby' | 'offline'>('offline')

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'https://radio.m2.ies.net.br/live'
    const statsUrl = "https://radio.m2.ies.net.br/status-json.xsl"

    const menuItems = [
        { name: 'Centro de Comando', href: '/admin', icon: Home },
        { name: 'Acervo de Áudios', href: '/admin/audios', icon: Headphones },
        { name: 'Upload em Lote', href: '/admin/audios/batch', icon: Upload },
        { name: 'Grades e Blocos', href: '/admin/playlists', icon: ListMusic },
        { name: 'Regras AutoDJ', href: '/admin/regras', icon: ShieldAlert },
        { name: 'Pedidos de Ouvintes', href: '/admin/pedidos', icon: Users },
        { name: 'Configurações', href: '/admin/configuracoes', icon: Settings },
    ]

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.refresh()
        setTimeout(() => {
            window.location.replace('/login')
        }, 300)
    }

    // --- FUNÇÃO PARA CORRIGIR ACENTOS (MOJIBAKE) ---
    const corrigirTexto = (str: string) => {
        if (!str) return "";
        try {
            return decodeURIComponent(escape(str));
        } catch (e) {
            return str;
        }
    }

    // --- LÓGICA DE METADADOS DO PLAYER COM 3 REGRAS DE PRIORIDADE ---
    useEffect(() => {
        const buscarMetadados = async () => {
            try {
                const response = await fetch(`${statsUrl}?nocache=${new Date().getTime()}`, { cache: 'no-store' })
                if (!response.ok) return

                const data = await response.json()
                let sources = []
                if (data && data.icestats && data.icestats.source) {
                    sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source]
                }

                const live = sources.find((s: any) => s && s.listenurl && s.listenurl.endsWith('/live'))
                const autodj = sources.find((s: any) => s && s.listenurl && s.listenurl.endsWith('/autodj'))

                // Limpeza e correção inicial
                let tituloLive = "";
                if (live) {
                    tituloLive = corrigirTexto(live.title || live.server_description || "");
                    if (tituloLive === "Unspecified name" || tituloLive === "Unspecified description") tituloLive = "";
                }

                let tituloAutodj = "";
                if (autodj) {
                    tituloAutodj = corrigirTexto(autodj.title || autodj.server_description || "");
                    if (tituloAutodj === "Unspecified name" || tituloAutodj === "Unspecified description") tituloAutodj = "";
                }

                let modoAtual: 'live' | 'normal' | 'standby' | 'offline' = 'offline';
                let textoAtual = "Conectando...";

                // ==========================================
                // ÁRVORE DE DECISÃO HIERÁRQUICA
                // ==========================================
                if (tituloLive !== "") {
                    // Prioridade 1: Rota /live existe e tem nome
                    modoAtual = 'live';
                    textoAtual = tituloLive;
                } else if (tituloAutodj.toUpperCase().includes("FALLBACK")) {
                    // Prioridade 2: Música de Fallback (Stand-by)
                    modoAtual = 'standby';
                    textoAtual = tituloAutodj.replace(/FALLBACK\s*-\s*/i, "");
                } else if (tituloAutodj !== "") {
                    // Prioridade 3: Programação Normal
                    modoAtual = 'normal';
                    textoAtual = tituloAutodj;
                } else {
                    // Offline
                    modoAtual = 'offline';
                    textoAtual = "Rádio Offline";
                }

                setRadioModo(modoAtual);
                setMusicaAtual(textoAtual);
            } catch (error) {
                // Silêncio
            }
        }

        buscarMetadados()
        const metaInterval = setInterval(buscarMetadados, 4000)
        return () => clearInterval(metaInterval)
    }, [])

    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        }
    }, [])

    const tentarReconectar = () => {
        if (!isPlaying) return
        setIsBuffering(true)
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(() => {
            if (audioRef.current && isPlaying) {
                audioRef.current.src = `${streamUrl}?nocache=${new Date().getTime()}`
                audioRef.current.load()
                audioRef.current.play()
                    .then(() => setIsBuffering(false))
                    .catch(() => tentarReconectar())
            }
        }, 1500)
    }

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false)
            setIsBuffering(false)
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.src = ''
            }
        } else {
            setIsPlaying(true)
            setIsBuffering(true)
            if (audioRef.current) {
                audioRef.current.src = `${streamUrl}?nocache=${new Date().getTime()}`
                audioRef.current.play()
                    .then(() => setIsBuffering(false))
                    .catch(() => tentarReconectar())
            }
        }
    }

    // Auxiliar para a UI do mini-player
    const getBadgeInfo = () => {
        if (radioModo === 'live') return { color: 'bg-red-500', text: '🔴 Ao Vivo' };
        if (radioModo === 'normal') return { color: 'bg-blue-500', text: '🎧 Normal' };
        if (radioModo === 'standby') return { color: 'bg-slate-500', text: 'Stand-by' };
        return { color: 'bg-red-900', text: 'Offline' };
    }

    const badge = getBadgeInfo();

    return (
        <aside className="w-72 bg-surface border-r border-border flex flex-col h-screen sticky top-0 transition-colors duration-300">
            {/* CABEÇALHO DO MENU */}
            <div className="p-6 border-b border-border flex items-center gap-3">
                <div className="bg-primary p-2 rounded-lg text-white shadow-sm"><Radio size={20} /></div>
                <span className="font-bold text-text-main tracking-tight text-lg line-clamp-1">{nome_radio}</span>
            </div>

            {/* MINI PLAYER EMBUTIDO NO SIDEBAR */}
            <div className="p-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-3 bg-surface border border-border p-3 rounded-2xl shadow-sm">
                    {/* Botão Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="bg-primary hover:opacity-80 text-white p-3 rounded-xl transition-all shadow-md flex items-center justify-center min-w-[44px] min-h-[44px] shrink-0"
                    >
                        {isBuffering ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : isPlaying ? (
                            <Square size={18} fill="currentColor" />
                        ) : (
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                        )}
                    </button>

                    {/* Informações da Música */}
                    <div className="flex flex-col overflow-hidden whitespace-nowrap flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white transition-colors ${badge.color}`}>
                                {badge.text}
                            </span>
                            {radioModo === 'live' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping shrink-0" />}
                        </div>
                        <p className="text-xs font-bold text-primary truncate mt-1" title={musicaAtual}>
                            {isBuffering ? 'Conectando...' : musicaAtual}
                        </p>
                    </div>

                    {/* Equalizador Animado */}
                    {isPlaying && !isBuffering && (
                        <div className="flex items-end gap-0.5 h-4 shrink-0 ml-1">
                            <div className="w-1 bg-primary h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 bg-primary h-3/4 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1 bg-primary h-2/4 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    )}
                </div>

                {/* Elemento de áudio oculto */}
                <audio ref={audioRef} onEnded={tentarReconectar} onError={tentarReconectar} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
            </div>

            {/* NAVEGAÇÃO PRINCIPAL */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                        <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium text-sm ${isActive ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-background hover:text-primary'}`}>
                            <Icon size={18} /> {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* RODAPÉ (SAIR) */}
            <div className="p-4 border-t border-border space-y-2 bg-surface shrink-0">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition text-sm font-bold border border-red-500/20 bg-red-500/5">
                    <LogOut size={18} /> Sair do Estúdio
                </button>
            </div>
        </aside>
    )
}