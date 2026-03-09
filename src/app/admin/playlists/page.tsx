'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { ListMusic, Plus, Trash2, Settings2, Clock, FolderArchive, PlayCircle, Layers } from 'lucide-react'
import Link from 'next/link'

const DIAS_NOME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Utilitário para formatar segundos em um formato legível (Ex: 2h 15m ou 45m)
function formatarTempoTotal(segundosTotais: number) {
    if (!segundosTotais || segundosTotais === 0) return 'Vazia'

    const horas = Math.floor(segundosTotais / 3600)
    const minutos = Math.floor((segundosTotais % 3600) / 60)
    const segundosRestantes = Math.floor(segundosTotais % 60)

    if (horas > 0) return `${horas}h ${minutos}m`
    if (minutos > 0) return `${minutos}m ${segundosRestantes}s`
    return `${segundosRestantes}s`
}

export default function GerenciarPlaylists() {
    const [playlists, setPlaylists] = useState<any[]>([])
    const [nome, setNome] = useState('')
    const [tipo, setTipo] = useState('musica')

    // Exclusivo para Música
    const [horaInicio, setHoraInicio] = useState('08:00')
    const [horaFim, setHoraFim] = useState('12:00')
    const [reproducao, setReproducao] = useState('aleatoria')
    const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

    useEffect(() => { carregarPlaylists() }, [])

    async function carregarPlaylists() {
        // A MÁGICA DO BANCO: Puxamos a playlist e todas as músicas associadas a ela com os seus tempos
        const { data } = await supabase
            .from('playlists')
            .select(`
                *,
                playlist_musicas (
                    audios (duracao_segundos)
                )
            `)
            .order('hora_inicio')

        if (data) {
            // Transformamos o retorno bruto somando os segundos para cada playlist
            const playlistsComTempo = data.map(pl => {
                let totalSegundos = 0
                let totalItens = 0

                if (pl.playlist_musicas) {
                    totalItens = pl.playlist_musicas.length
                    pl.playlist_musicas.forEach((pm: any) => {
                        if (pm.audios && pm.audios.duracao_segundos) {
                            totalSegundos += pm.audios.duracao_segundos
                        }
                    })
                }

                return {
                    ...pl,
                    tempo_total: totalSegundos,
                    quantidade_itens: totalItens
                }
            })

            setPlaylists(playlistsComTempo)
        }
    }

    const toggleDia = (dia: number) => {
        setDias(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort())
    }

    async function criarPlaylist(e: React.FormEvent) {
        e.preventDefault()
        if (!nome) return toast.error('Nome é obrigatório')
        if (tipo === 'musica' && dias.length === 0) return toast.error('Selecione os dias da semana para o programa musical.')

        // Se for bloco (comercial/vinheta), enviamos nulo para horários e dias. A regra ficará no AutoDJ.
        const payload = tipo === 'musica'
            ? { nome, tipo, hora_inicio: horaInicio, hora_fim: horaFim, reproducao, dias_semana: dias }
            : { nome, tipo, reproducao, hora_inicio: null, hora_fim: null, dias_semana: null }

        const { error } = await supabase.from('playlists').insert([payload])

        if (error) toast.error('Erro ao criar')
        else { toast.success(tipo === 'musica' ? 'Programa criado!' : 'Bloco criado!'); setNome(''); carregarPlaylists() }
    }

    async function deletarPlaylist(id: string) {
        if (!confirm('Tem certeza? Isso apagará a estrutura (os áudios originais continuam no acervo).')) return
        await supabase.from('playlists').delete().eq('id', id)
        toast.success('Excluída'); carregarPlaylists()
    }

    const gradesMusicais = playlists.filter(p => p.tipo === 'musica')
    const blocosAudio = playlists.filter(p => p.tipo !== 'musica')

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-10">
            <Toaster />
            <h1 className="text-3xl font-bold text-text-main flex items-center gap-2"><ListMusic className="text-primary" /> Playlists e Blocos</h1>

            {/* FORMULÁRIO DINÂMICO */}
            <form onSubmit={criarPlaylist} className="bg-surface p-6 rounded-2xl shadow-sm border border-border space-y-4 transition-all">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-text-muted mb-1">Nome da Estrutura</label>
                        <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary" placeholder="Ex: Sertanejo Bom ou Bloco de Anunciantes" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-muted mb-1">Classificação</label>
                        <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary font-semibold">
                            <option value="musica">📻 Programa Musical (Grade)</option>
                            <option value="comercial">💰 Bloco Comercial (Pasta)</option>
                            <option value="vinheta">🎙️ Pacote de Vinhetas (Pasta)</option>
                            <option value="efeito">⚡ Bloco de Efeitos (Pasta)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-muted mb-1">Ordem Interna</label>
                        <select value={reproducao} onChange={e => setReproducao(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary">
                            <option value="aleatoria">Aleatória (Shuffle)</option>
                            <option value="ordenada">Sequencial (Ordem fixada)</option>
                        </select>
                    </div>
                </div>

                {/* EXIBE HORÁRIOS APENAS SE FOR GRADE MUSICAL */}
                {tipo === 'musica' && (
                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border mt-4">
                        <div className="flex gap-2 items-center">
                            <label className="text-xs font-bold text-text-muted">Horário Fixo:</label>
                            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="p-2 border border-border bg-background text-text-main rounded-lg outline-none text-sm font-mono font-bold" />
                            <span className="text-text-muted text-sm font-bold">até</span>
                            <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className="p-2 border border-border bg-background text-text-main rounded-lg outline-none text-sm font-mono font-bold" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-text-muted">Dias:</label>
                            <div className="flex gap-1">
                                {DIAS_NOME.map((dia, index) => (
                                    <button type="button" key={index} onClick={() => toggleDia(index)} className={`px-2 py-1 rounded text-xs font-bold transition ${dias.includes(index) ? 'bg-primary text-white shadow-sm' : 'bg-background text-text-muted border border-border hover:border-primary/50'}`}>{dia}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition flex items-center gap-2 shadow-sm">
                        <Plus size={18} /> {tipo === 'musica' ? 'Criar Programa Musical' : 'Criar Bloco Virtual'}
                    </button>
                </div>
            </form>

            {/* SEÇÃO 1: GRADES MUSICAIS */}
            <div>
                <h2 className="text-xl font-bold text-text-main mb-4 flex items-center gap-2"><PlayCircle className="text-primary" /> Grades Musicais</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {gradesMusicais.map(pl => (
                        <div key={pl.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-primary/30 transition">
                            <div>
                                <h3 className="font-bold text-lg text-text-main mb-1">{pl.nome}</h3>
                                <div className="flex items-center gap-2 text-text-muted text-sm font-bold mb-3 bg-background border border-border p-2 rounded-lg w-max">
                                    <Clock size={16} className="text-primary" /> {pl.hora_inicio?.slice(0, 5)} as {pl.hora_fim?.slice(0, 5)}
                                </div>
                                <div className="flex gap-1 flex-wrap mb-4">
                                    {DIAS_NOME.map((dia, index) => (
                                        <span key={index} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(pl.dias_semana || []).includes(index) ? 'bg-primary/20 text-primary' : 'bg-background text-text-muted/30 border border-border'}`}>{dia}</span>
                                    ))}
                                </div>

                                {/* NOVO: EXIBIÇÃO DE TEMPO E ITENS */}
                                <div className="flex justify-between items-center bg-primary/5 p-2 rounded-lg border border-primary/10 mb-4">
                                    <span className="text-xs font-bold text-text-main flex items-center gap-1"><Layers size={14} className="text-primary" /> {pl.quantidade_itens} faixas</span>
                                    <span className="text-xs font-mono font-bold text-primary">{formatarTempoTotal(pl.tempo_total)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 border-t border-border pt-4">
                                <Link href={`/admin/playlists/${pl.id}`} className="flex-1 bg-primary text-white hover:opacity-90 font-bold py-2 rounded-lg text-center text-sm transition flex justify-center items-center gap-2 shadow-sm"><Settings2 size={16} /> Curadoria</Link>
                                <button onClick={() => deletarPlaylist(pl.id)} className="p-2 bg-background border border-border text-text-muted hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-lg transition"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    {gradesMusicais.length === 0 && <p className="text-text-muted text-sm col-span-3 font-medium">Nenhum programa musical configurado.</p>}
                </div>
            </div>

            {/* SEÇÃO 2: BLOCOS (COMERCIAIS E VINHETAS) */}
            <div>
                <h2 className="text-xl font-bold text-text-main mb-4 flex items-center gap-2"><FolderArchive className="text-primary" /> Blocos (Comerciais e Vinhetas)</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {blocosAudio.map(pl => (
                        <div key={pl.id} className={`bg-surface border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm border-l-4 ${pl.tipo === 'comercial' ? 'border-l-yellow-500' : pl.tipo === 'vinheta' ? 'border-l-purple-500' : 'border-l-orange-500'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-md text-text-main line-clamp-1">{pl.nome}</h3>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${pl.tipo === 'comercial' ? 'bg-yellow-500/10 text-yellow-700' : pl.tipo === 'vinheta' ? 'bg-purple-500/10 text-purple-700' : 'bg-orange-500/10 text-orange-700'}`}>
                                        {pl.tipo} ({pl.reproducao})
                                    </span>
                                </div>

                                {/* NOVO: EXIBIÇÃO DE TEMPO NOS BLOCOS TAMBÉM */}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50 text-xs font-bold text-text-muted">
                                    <span>{pl.quantidade_itens} itens</span>
                                    <span className="font-mono">{formatarTempoTotal(pl.tempo_total)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                                <Link href={`/admin/playlists/${pl.id}`} className="flex-1 bg-background border border-border text-text-main hover:text-primary hover:border-primary transition text-sm font-bold text-center py-1.5 rounded-lg flex items-center justify-center gap-1"><Settings2 size={14} /> Abrir</Link>
                                <button onClick={() => deletarPlaylist(pl.id)} className="p-1.5 text-text-muted hover:text-red-500 bg-background border border-border hover:border-red-200 rounded-lg transition"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {blocosAudio.length === 0 && <p className="text-text-muted text-sm col-span-4 font-medium">Nenhum bloco virtual configurado.</p>}
                </div>
            </div>

        </div>
    )
}