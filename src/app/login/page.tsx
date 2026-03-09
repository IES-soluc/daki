'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { useConfig } from '@/components/ConfigProvider'
import { Play, Square, Loader2, Radio as RadioIcon, Lock } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    // 1. Puxando TUDO do nosso Cérebro de Configurações
    const {
        nome_radio, url_logo, descricao_radio, texto_rodape
    } = useConfig()

    // 2. Estados do Player Embutido
    const [isPlaying, setIsPlaying] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)
    const [musicaAtual, setMusicaAtual] = useState('Conectando...')
    const [isAoVivo, setIsAoVivo] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'https://radio.ies.net.br/live'

    // 3. Login Flow
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            toast.error('Acesso negado: ' + error.message)
            setLoading(false)
        } else {
            toast.success('Acesso autorizado!')
            router.refresh()
            setTimeout(() => router.push('/admin'), 300)
        }
    }

    // 4. Inteligência do Player (Metadados)
    useEffect(() => {
        const buscarMetadados = async () => {
            try {
                const response = await fetch('/api/icecast', { cache: 'no-store' })
                if (!response.ok) return

                const data = await response.json()
                let sources = Array.isArray(data?.icestats?.source) ? data.icestats.source : (data?.icestats?.source ? [data.icestats.source] : [])

                const live = sources.find((s: any) => s?.listenurl?.endsWith('/live'))
                const autodj = sources.find((s: any) => s?.listenurl?.endsWith('/autodj'))

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

    // 5. Controles de Áudio
    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false)
            setIsBuffering(false)
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
                    .catch(() => {
                        setIsBuffering(false)
                        setIsPlaying(false)
                        toast.error("O streaming está offline no momento.")
                    })
            }
        }
    }

    return (
        <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <Toaster />

            {/* Elemento de Áudio Oculto */}
            <audio
                ref={audioRef}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
            />

            {/* Decoração de Fundo Animada */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />

            <div className="w-full max-w-md z-10 flex flex-col gap-6">

                {/* CABEÇALHO PÚBLICO (Branding & Player) */}
                <div className="bg-surface p-8 rounded-3xl shadow-xl border border-border flex flex-col items-center text-center">

                    {/* Logo Dinâmica */}
                    {url_logo ? (
                        <img src={url_logo} alt={`Logo ${nome_radio}`} className="h-24 object-contain mb-4 drop-shadow-md" />
                    ) : (
                        <div className="h-20 w-20 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20 rotate-3">
                            <RadioIcon className="text-white" size={40} />
                        </div>
                    )}

                    <h1 className="text-3xl font-black text-text-main tracking-tight">{nome_radio}</h1>

                    {/* Descrição Dinâmica (SEO/Slogan) */}
                    {descricao_radio && (
                        <p className="text-sm font-medium text-text-muted mt-2 mb-6 px-4">
                            {descricao_radio}
                        </p>
                    )}

                    {/* PLAYER EMBUTIDO NO LOGIN */}
                    <div className="w-full bg-background border border-border p-3 rounded-2xl flex items-center gap-4 mt-2 shadow-inner">
                        <button
                            onClick={togglePlay}
                            className="bg-primary hover:opacity-80 text-white p-4 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0"
                        >
                            {isBuffering ? <Loader2 size={24} className="animate-spin" /> :
                                isPlaying ? <Square size={24} fill="currentColor" /> :
                                    <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>

                        <div className="flex flex-col overflow-hidden text-left flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                {isAoVivo && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0" />}
                                <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                                    {isAoVivo ? 'No Ar: Ao Vivo' : 'No Ar: Estúdio Virtual'}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-primary truncate" title={musicaAtual}>
                                {isBuffering ? 'Conectando ao estúdio...' : musicaAtual}
                            </p>
                        </div>

                        {/* Equalizador */}
                        {isPlaying && !isBuffering && (
                            <div className="flex items-end gap-1 h-6 shrink-0 pr-2">
                                <div className="w-1.5 bg-primary rounded-t-sm h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 bg-primary rounded-t-sm h-3/4 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 bg-primary rounded-t-sm h-2/4 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* FORMULÁRIO DE LOGIN RESTRITO */}
                <form onSubmit={handleLogin} className="bg-surface p-8 rounded-3xl shadow-xl border border-border">
                    <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                        <Lock size={18} className="text-primary" />
                        <h2 className="text-sm font-black text-text-main uppercase tracking-widest">Acesso Restrito</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <input
                                type="email"
                                placeholder="E-mail de Acesso"
                                className="w-full p-4 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Senha do Sistema"
                                className="w-full p-4 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-6 bg-text-main hover:bg-primary text-surface p-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                        {loading ? 'Verificando...' : 'Entrar no Painel'}
                    </button>
                </form>

                {/* Rodapé Dinâmico */}
                {texto_rodape && (
                    <p className="text-center text-xs font-medium text-text-muted mt-4">
                        {texto_rodape}
                    </p>
                )}
            </div>
        </div>
    )
}