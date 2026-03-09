'use client'
import Link from 'next/link'
// 1. Importamos o useRouter do Next.js
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
    // 2. Instanciamos o router
    const router = useRouter()
    const { nome_radio } = useConfig()

    // --- ESTADOS DO PLAYER ---
    const [isPlaying, setIsPlaying] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)
    const [musicaAtual, setMusicaAtual] = useState('Conectando...')
    const [isAoVivo, setIsAoVivo] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'http://localhost:8000/live'

    const menuItems = [
        { name: 'Centro de Comando', href: '/admin', icon: Home },
        { name: 'Acervo de Áudios', href: '/admin/audios', icon: Headphones },
        { name: 'Upload em Lote', href: '/admin/audios/batch', icon: Upload },
        { name: 'Grades e Blocos', href: '/admin/playlists', icon: ListMusic },
        { name: 'Regras AutoDJ', href: '/admin/regras', icon: ShieldAlert },
        { name: 'Pedidos de Ouvintes', href: '/admin/pedidos', icon: Users },
        { name: 'Configurações', href: '/admin/configuracoes', icon: Settings },
    ]

    // --- A IMPLEMENTAÇÃO CORRETA DO LOGOUT ---
    const handleLogout = async () => {
        // 1. Apaga a sessão na API e limpa o LocalStorage
        const supabase = createClient()
        await supabase.auth.signOut()

        // 2. Avisa o servidor Next.js para invalidar o cache da página atual
        router.refresh()

        // 3. Dá tempo (300ms) para os Cookies serem fisicamente apagados do navegador
        // antes de forçar o redirecionamento.
        setTimeout(() => {
            window.location.replace('/login')
        }, 300)
    }

    // --- LÓGICA DE METADADOS DO PLAYER ---
    useEffect(() => {
        const buscarMetadados = async () => {
            try {
                const response = await fetch('/api/icecast', { cache: 'no-store' })
                if (!response.ok) return

                const data = await response.json()
                let sources = []
                if (data && data.icestats && data.icestats.source) {
                    sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source]
                }

                const live = sources.find((s: any) => s && s.listenurl && s.listenurl.endsWith('/live'))
                const autodj = sources.find((s: any) => s && s.listenurl && s.listenurl.endsWith('/autodj'))

                let isLiveNow = false;
                let textMusic = "Conectando...";

                if (live && live.server_name && live.server_name !== 'Nossa Web Rádio') {
                    isLiveNow = true; textMusic = live.title || live.server_description || "Acompanhe a transmissão";
                } else if (autodj && autodj.server_name === 'Nossa Web Rádio') {
                    isLiveNow = false; textMusic = autodj.title || autodj.server_description || "Programação Normal";
                } else if (live) {
                    isLiveNow = false; textMusic = live.title || live.server_description || "Rádio no Ar";
                } else {
                    isLiveNow = false; textMusic = "Rádio Offline";
                }

                setIsAoVivo(isLiveNow);
                setMusicaAtual(textMusic);
            } catch (error) {
                // Silêncio
            }
        }

        buscarMetadados()
        const metaInterval = setInterval(buscarMetadados, 10000)
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
                            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                                {isAoVivo ? 'Locutor Ao Vivo' : 'Estúdio Virtual'}
                            </span>
                            {isAoVivo && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping shrink-0" />}
                        </div>
                        <p className="text-xs font-bold text-primary truncate" title={musicaAtual}>
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