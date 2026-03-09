'use client'
import { useState, useRef, useEffect } from 'react'
import { Play, Square, Loader2, Radio } from 'lucide-react'
import { useConfig } from '@/components/ConfigProvider'
import { createClient } from '@/utils/supabase/client'

export default function WidgetPlayer() {
    const [isPlaying, setIsPlaying] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)

    const [programaAtual, setProgramaAtual] = useState('')
    const [musicaAtual, setMusicaAtual] = useState('Conectando ao estúdio...')
    const [isAoVivo, setIsAoVivo] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Usando o IP local/domínio do seu Icecast
    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'http://localhost:8000/live'
    const { texto_rodape } = useConfig()

    // 1. Busca do Programa (Playlist)
    useEffect(() => {
        async function buscarProgramaAtual() {
            const agora = new Date()
            const diaAtual = agora.getDay()
            const horaAtual = agora.toTimeString().slice(0, 5)
            const supabase = createClient()

            const { data } = await supabase.from('playlists')
                .select('nome')
                .eq('tipo', 'musica')
                .eq('ativa', true)
                .contains('dias_semana', [diaAtual])
                .lte('hora_inicio', horaAtual)
                .gte('hora_fim', horaAtual)
                .single()

            if (data) setProgramaAtual(`Programa: ${data.nome}`)
            else setProgramaAtual(texto_rodape)
        }

        buscarProgramaAtual()
        const intervalo = setInterval(buscarProgramaAtual, 300000) // 5 minutos
        return () => clearInterval(intervalo)
    }, [texto_rodape])

    // 2. Analisador Blindado do Icecast (Através da API do Next.js para evitar bloqueio de CORS no Iframe)
    useEffect(() => {
        const buscarMetadados = async () => {
            try {
                // Vai buscar à nossa API proxy em vez de ir direto ao Icecast
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

    // WIDGET UI: Fundo transparente para herdar a cor do site hospedeiro, margens zero.
    return (
        <div className="w-full h-full bg-surface p-2 flex items-center justify-between font-main rounded-xl border border-border shadow-sm m-1 box-border" style={{ height: 'calc(100vh - 8px)' }}>

            <div className="flex items-center gap-3 w-full overflow-hidden px-2">
                <button
                    onClick={togglePlay}
                    className="bg-primary hover:opacity-80 text-white p-3 rounded-full transition-all shadow-md flex items-center justify-center min-w-[44px] min-h-[44px] shrink-0"
                >
                    {isBuffering ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : isPlaying ? (
                        <Square size={20} fill="currentColor" />
                    ) : (
                        <Play size={20} fill="currentColor" className="ml-1" />
                    )}
                </button>

                <div className="flex flex-col overflow-hidden whitespace-nowrap justify-center flex-1">
                    <h3 className="font-bold text-sm md:text-base text-text-main flex items-center gap-2 truncate">
                        {isAoVivo ? (
                            <span className="flex items-center gap-1.5 text-red-500">
                                <Radio size={14} className="animate-pulse" /> Ao Vivo
                            </span>
                        ) : (
                            programaAtual
                        )}
                    </h3>
                    <p className="text-xs md:text-sm text-text-muted font-bold text-primary truncate">
                        {isBuffering ? 'Conectando ao sinal...' : musicaAtual}
                    </p>
                </div>

                {isPlaying && !isBuffering && (
                    <div className="hidden sm:flex items-end gap-1 h-6 shrink-0 ml-2">
                        <div className="w-1 bg-primary h-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 bg-primary h-3/4 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 bg-primary h-4/5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-1 bg-primary h-2/4 animate-bounce" style={{ animationDelay: '450ms' }}></div>
                    </div>
                )}
            </div>
            <audio ref={audioRef} onEnded={tentarReconectar} onError={tentarReconectar} onWaiting={() => setIsBuffering(true)} onPlaying={() => setIsBuffering(false)} />
        </div>
    )
}