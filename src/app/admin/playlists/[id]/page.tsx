'use client'
import { useState, useEffect, Fragment } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import { Music, Plus, Trash2, ArrowLeft, Search, ListOrdered, Folder, ChevronRight, Home, CornerUpLeft, Clock, Calendar, Save, Loader2, ArrowUp, ArrowDown } from 'lucide-react'
import Link from 'next/link'

interface Pasta {
    id: string
    nome: string
    parent_id: string | null
}

const DIAS_NOME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const supabase = createClient()

// Função utilitária para formatar os segundos
function formatarDuracao(segundos: number | null) {
    if (!segundos) return '--:--'
    const minutos = Math.floor(segundos / 60)
    const restoSegundos = Math.floor(segundos % 60)
    return `${minutos.toString().padStart(2, '0')}:${restoSegundos.toString().padStart(2, '0')}`
}

function formatarTempoTotal(segundosTotais: number) {
    if (!segundosTotais || segundosTotais === 0) return '00:00'
    const horas = Math.floor(segundosTotais / 3600)
    const minutos = Math.floor((segundosTotais % 3600) / 60)
    const segundosRestantes = Math.floor(segundosTotais % 60)
    if (horas > 0) return `${horas}h ${minutos}m`
    return `${minutos}m ${segundosRestantes}s`
}

export default function DetalhesPlaylist() {
    const { id } = useParams()
    const [playlist, setPlaylist] = useState<any>(null)
    const [musicasNaPlaylist, setMusicasNaPlaylist] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Estados do Acervo e Navegação
    const [pastas, setPastas] = useState<Pasta[]>([])
    const [acervo, setAcervo] = useState<any[]>([])
    const [pastaAtual, setPastaAtual] = useState<Pasta | null>(null)
    const [historicoPastas, setHistoricoPastas] = useState<Pasta[]>([])
    const [filtro, setFiltro] = useState('')

    // Estados de Agendamento
    const [horaInicio, setHoraInicio] = useState('00:00')
    const [horaFim, setHoraFim] = useState('23:59')
    const [dias, setDias] = useState<number[]>([])
    const [salvandoAgenda, setSalvandoAgenda] = useState(false)

    useEffect(() => {
        carregarDadosBase()
    }, [id])

    useEffect(() => {
        if (playlist) carregarConteudoAcervo(pastaAtual?.id || null, playlist.tipo)
    }, [pastaAtual, playlist])

    async function carregarDadosBase() {
        setLoading(true)
        const { data: pl } = await supabase.from('playlists').select('*').eq('id', id).single()

        if (pl) {
            setPlaylist(pl)
            setHoraInicio(pl.hora_inicio ? pl.hora_inicio.slice(0, 5) : '00:00')
            setHoraFim(pl.hora_fim ? pl.hora_fim.slice(0, 5) : '23:59')
            setDias(pl.dias_semana || [0, 1, 2, 3, 4, 5, 6])
        }

        const { data: relacao } = await supabase.from('playlist_musicas').select('id, ordem, audios(*)').eq('playlist_id', id).order('ordem')
        setMusicasNaPlaylist(relacao || [])
        setLoading(false)
    }

    async function carregarConteudoAcervo(parentId: string | null, tipoAudio: string) {
        let queryPastas = supabase.from('pastas').select('*').order('nome')
        if (parentId) queryPastas = queryPastas.eq('parent_id', parentId)
        else queryPastas = queryPastas.is('parent_id', null)

        let queryAudios = supabase.from('audios').select('*').eq('tipo', tipoAudio).eq('ativo', true).order('titulo')
        if (parentId) queryAudios = queryAudios.eq('pasta_id', parentId)
        else queryAudios = queryAudios.is('pasta_id', null)

        const [resPastas, resAudios] = await Promise.all([queryPastas, queryAudios])

        if (resPastas.data) setPastas(resPastas.data)
        if (resAudios.data) setAcervo(resAudios.data)
    }

    // --- NAVEGAÇÃO DE PASTAS ---
    function entrarNaPasta(pasta: Pasta) {
        if (pastaAtual) setHistoricoPastas([...historicoPastas, pastaAtual])
        setPastaAtual(pasta)
        setFiltro('')
    }

    function voltarPastaAcima() {
        if (historicoPastas.length === 0) {
            setPastaAtual(null)
            return
        }
        const novoHistorico = [...historicoPastas]
        const pastaAnterior = novoHistorico.pop() || null
        setHistoricoPastas(novoHistorico)
        setPastaAtual(pastaAnterior)
    }

    function irParaCaminhoIndex(index: number) {
        if (index === -1) {
            setPastaAtual(null)
            setHistoricoPastas([])
        } else {
            setPastaAtual(historicoPastas[index])
            setHistoricoPastas(historicoPastas.slice(0, index))
        }
    }

    // --- AÇÕES DA PLAYLIST ---
    async function adicionarMusica(audioId: string) {
        const proximaOrdem = musicasNaPlaylist.length > 0
            ? Math.max(...musicasNaPlaylist.map(m => m.ordem)) + 1
            : 1

        const { error } = await supabase.from('playlist_musicas').insert([{ playlist_id: id, audio_id: audioId, ordem: proximaOrdem }])
        if (error) return toast.error('Áudio já está inserido ou ocorreu um erro.')
        toast.success('Adicionado!')
        carregarDadosBase()
    }

    async function removerMusica(relacaoId: string) {
        const { error } = await supabase.from('playlist_musicas').delete().eq('id', relacaoId)
        if (!error) { toast.success('Removido'); carregarDadosBase() }
    }

    // A MÁGICA DA REORDENAÇÃO (Mover para Cima / Baixo)
    async function reordenar(indexAtual: number, direcao: 'up' | 'down') {
        const indexDestino = direcao === 'up' ? indexAtual - 1 : indexAtual + 1
        if (indexDestino < 0 || indexDestino >= musicasNaPlaylist.length) return

        const itemAtual = musicasNaPlaylist[indexAtual]
        const itemDestino = musicasNaPlaylist[indexDestino]

        // Troca as ordens localmente para UI instantânea
        const novaLista = [...musicasNaPlaylist]
        novaLista[indexAtual] = { ...itemAtual, ordem: itemDestino.ordem }
        novaLista[indexDestino] = { ...itemDestino, ordem: itemAtual.ordem }

        // Ordena o array atualizado para renderizar certo
        novaLista.sort((a, b) => a.ordem - b.ordem)
        setMusicasNaPlaylist(novaLista)

        // Atualiza no banco de dados em lote
        await Promise.all([
            supabase.from('playlist_musicas').update({ ordem: itemDestino.ordem }).eq('id', itemAtual.id),
            supabase.from('playlist_musicas').update({ ordem: itemAtual.ordem }).eq('id', itemDestino.id)
        ])
    }

    // --- AGENDAMENTO ---
    const toggleDia = (dia: number) => {
        setDias(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort())
    }

    async function salvarAgendamento() {
        if (dias.length === 0) return toast.error('Selecione pelo menos um dia da semana.')
        setSalvandoAgenda(true)
        const { error } = await supabase.from('playlists').update({
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            dias_semana: dias
        }).eq('id', id)

        if (error) toast.error('Erro ao atualizar agendamento.')
        else toast.success('Horários atualizados com sucesso!')
        setSalvandoAgenda(false)
    }

    // --- FILTROS LOCAIS E CÁLCULOS ---
    const pastasFiltradas = pastas.filter(p => p.nome.toLowerCase().includes(filtro.toLowerCase()))
    const acervoFiltrado = acervo.filter(a =>
        a.titulo.toLowerCase().includes(filtro.toLowerCase()) &&
        !musicasNaPlaylist.some(mp => mp.audios?.id === a.id)
    )

    // Soma o tempo de todas as músicas atualmente na playlist
    const duracaoTotalPlaylist = musicasNaPlaylist.reduce((acc, curr) => acc + (curr.audios?.duracao_segundos || 0), 0)

    if (loading && !playlist) return <div className="p-10 text-center text-text-muted font-bold animate-pulse">Carregando editor...</div>

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <Toaster />

            {/* CABEÇALHO */}
            <div className="flex items-center gap-4">
                <Link href="/admin/playlists" className="p-2 hover:bg-background rounded-full transition text-text-muted hover:text-primary"><ArrowLeft size={24} /></Link>
                <div>
                    <h1 className="text-3xl font-bold text-text-main">{playlist?.nome}</h1>
                    <p className="text-text-muted text-sm uppercase font-bold text-primary tracking-widest">{playlist?.tipo}</p>
                </div>
            </div>

            {/* PAINEL DE AGENDAMENTO */}
            <div className="bg-surface rounded-2xl shadow-sm border border-border p-5">
                <h2 className="font-bold text-text-main flex items-center gap-2 mb-4 border-l-4 border-primary pl-2">
                    <Clock size={18} className="text-primary" /> Agendamento e Validade
                </h2>
                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex gap-2 items-center bg-background p-2 rounded-lg border border-border w-full md:w-auto">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-text-muted px-1">Início</span>
                            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="p-1 bg-transparent text-text-main outline-none text-sm font-mono font-bold" />
                        </div>
                        <span className="text-text-muted text-sm font-bold mt-4">até</span>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-text-muted px-1">Fim</span>
                            <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className="p-1 bg-transparent text-text-main outline-none text-sm font-mono font-bold" />
                        </div>
                    </div>
                    <div className="flex flex-col flex-1 w-full">
                        <span className="text-[10px] uppercase font-bold text-text-muted mb-1 px-1 flex items-center gap-1"><Calendar size={12} /> Dias da Semana</span>
                        <div className="flex gap-1">
                            {DIAS_NOME.map((dia, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    onClick={() => toggleDia(index)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${dias.includes(index) ? 'bg-primary text-white shadow-sm' : 'bg-background text-text-muted border border-border hover:border-primary/50'}`}
                                >
                                    {dia}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={salvarAgendamento}
                        disabled={salvandoAgenda}
                        className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 w-full md:w-auto"
                    >
                        {salvandoAgenda ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        <span className="hidden md:inline">Salvar Agenda</span>
                    </button>
                </div>
            </div>

            {/* ÁREA DE GESTÃO DE ÁUDIO (ACERVO VS PLAYLIST) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* COLUNA ESQUERDA: ACERVO */}
                <div className="bg-surface rounded-2xl shadow-sm border border-border flex flex-col h-[650px]">
                    <div className="p-4 border-b border-border bg-background rounded-t-2xl space-y-3">
                        <h2 className="font-bold flex items-center gap-2 text-text-main">
                            <Search size={18} className="text-primary" /> Explorar Acervo
                        </h2>
                        {/* Breadcrumbs de Navegação */}
                        <div className="flex items-center gap-1 text-xs font-bold text-text-muted bg-surface p-2 rounded-lg border border-border overflow-x-auto whitespace-nowrap">
                            <button onClick={() => irParaCaminhoIndex(-1)} className="hover:text-primary transition flex items-center gap-1">
                                <Home size={14} /> Raiz
                            </button>
                            {historicoPastas.map((p, idx) => (
                                <Fragment key={p.id}>
                                    <ChevronRight size={14} className="opacity-50" />
                                    <button onClick={() => irParaCaminhoIndex(idx)} className="hover:text-primary transition">{p.nome}</button>
                                </Fragment>
                            ))}
                            {pastaAtual && (
                                <Fragment>
                                    <ChevronRight size={14} className="opacity-50" />
                                    <span className="text-primary">{pastaAtual.nome}</span>
                                </Fragment>
                            )}
                        </div>
                        <input type="text" placeholder={`Buscar pasta ou ${playlist?.tipo}...`} value={filtro} onChange={e => setFiltro(e.target.value)} className="w-full p-2 border border-border bg-surface text-text-main rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {pastaAtual && !filtro && (
                            <div onClick={voltarPastaAcima} className="flex items-center gap-3 p-3 hover:bg-background rounded-lg cursor-pointer text-text-muted font-bold border border-transparent transition">
                                <CornerUpLeft size={16} /> .. (Voltar)
                            </div>
                        )}
                        {pastasFiltradas.map((pasta) => (
                            <div key={pasta.id} onClick={() => entrarNaPasta(pasta)} className="flex items-center gap-3 p-3 hover:bg-primary/5 rounded-lg cursor-pointer group border border-transparent hover:border-primary/20 transition">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Folder size={16} className="fill-primary/20" /></div>
                                <p className="font-semibold text-sm text-text-main group-hover:text-primary transition">{pasta.nome}</p>
                            </div>
                        ))}
                        {acervoFiltrado.map(musica => (
                            <div key={musica.id} className="flex justify-between items-center p-3 hover:bg-background rounded-lg group border border-transparent hover:border-border transition">
                                <div className="min-w-0 pr-4">
                                    <p className="font-semibold text-sm text-text-main truncate">{musica.titulo}</p>
                                    <p className="text-xs text-text-muted truncate">{musica.artista}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-medium text-text-muted whitespace-nowrap"><Clock size={12} className="inline mr-1" />{formatarDuracao(musica.duracao_segundos)}</span>
                                    <button onClick={() => adicionarMusica(musica.id)} title="Adicionar à Playlist" className="p-2 bg-primary/10 text-primary rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-primary hover:text-white shrink-0">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {pastasFiltradas.length === 0 && acervoFiltrado.length === 0 && (
                            <div className="text-center p-8 text-text-muted text-sm font-medium">Nenhum conteúdo compatível nesta pasta.</div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: FILA DA PLAYLIST */}
                <div className="bg-surface rounded-2xl shadow-sm border-2 border-primary/20 flex flex-col h-[650px]">
                    <div className="p-4 border-b border-border bg-background rounded-t-2xl flex justify-between items-center">
                        <div className="flex flex-col">
                            <h2 className="font-bold flex items-center gap-2 text-text-main"><ListOrdered size={18} className="text-primary" /> Fila Oficial</h2>
                            {playlist?.reproducao === 'aleatoria' && <span className="text-[10px] text-text-muted mt-1 uppercase font-bold tracking-wider">Modo Aleatório Ativado</span>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">{musicasNaPlaylist.length} faixas</span>
                            <span className="text-xs font-mono font-bold text-text-muted flex items-center gap-1"><Clock size={12} /> {formatarTempoTotal(duracaoTotalPlaylist)} totais</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {musicasNaPlaylist.map((item, index) => (
                            <div key={item.id} className="flex justify-between items-center bg-background p-3 rounded-xl border border-border group hover:border-primary/50 transition">
                                <div className="flex items-center gap-3 w-3/4">

                                    {/* CONTROLES DE REORDENAÇÃO */}
                                    {playlist?.reproducao === 'ordenada' ? (
                                        <div className="flex flex-col gap-1 items-center justify-center shrink-0 w-6">
                                            <button onClick={() => reordenar(index, 'up')} disabled={index === 0} className="text-text-muted hover:text-primary disabled:opacity-20 transition"><ArrowUp size={14} /></button>
                                            <span className="text-[10px] font-bold text-primary">{index + 1}</span>
                                            <button onClick={() => reordenar(index, 'down')} disabled={index === musicasNaPlaylist.length - 1} className="text-text-muted hover:text-primary disabled:opacity-20 transition"><ArrowDown size={14} /></button>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-text-muted w-6 text-center shrink-0">{index + 1}</span>
                                    )}

                                    <div className="min-w-0 pr-2">
                                        <p className="font-semibold text-sm text-text-main truncate">{item.audios?.titulo}</p>
                                        <p className="text-xs text-text-muted truncate">{item.audios?.artista}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs font-mono font-bold text-text-muted whitespace-nowrap bg-surface px-1.5 py-0.5 rounded border border-border">
                                        {formatarDuracao(item.audios?.duracao_segundos)}
                                    </span>
                                    <button onClick={() => removerMusica(item.id)} className="text-text-muted hover:text-red-500 transition opacity-50 group-hover:opacity-100 p-1"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                        {musicasNaPlaylist.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-2">
                                <Music size={48} className="opacity-20" />
                                <p className="font-medium">O bloco está vazio.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}