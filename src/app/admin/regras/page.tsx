'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { Settings, Plus, Trash2, ShieldAlert, Tag } from 'lucide-react'

const DIAS_NOME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function GestaoRegras() {
    const [regras, setRegras] = useState<any[]>([])
    const [audios, setAudios] = useState<any[]>([])
    const [playlists, setPlaylists] = useState<any[]>([])

    // Formulário
    const [nomeRegra, setNomeRegra] = useState('') // NOVO: Estado para o nome da regra
    const [tipoItem, setTipoItem] = useState<'audio_unico' | 'playlist'>('audio_unico')
    const [audioId, setAudioId] = useState('')
    const [playlistId, setPlaylistId] = useState('')
    const [estrategia, setEstrategia] = useState<'intervalo' | 'hora_exata'>('intervalo')

    const [intervalo, setIntervalo] = useState('3')
    const [horaExata, setHoraExata] = useState('12:00')
    const [horaInicio, setHoraInicio] = useState('00:00')
    const [horaFim, setHoraFim] = useState('23:59')
    const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

    // Limites de Execução de Bloco
    const [tipoLimite, setTipoLimite] = useState<'completo' | 'itens' | 'minutos'>('completo')
    const [valorLimite, setValorLimite] = useState('1')

    useEffect(() => { carregarDados() }, [])

    async function carregarDados() {
        const { data: r } = await supabase.from('regras_programacao').select('*, audios(titulo, tipo), playlists(nome, tipo)')
        if (r) setRegras(r)

        const { data: a } = await supabase.from('audios').select('id, titulo, tipo').in('tipo', ['vinheta', 'comercial']).eq('ativo', true)
        if (a) { setAudios(a); if (a.length > 0) setAudioId(a[0].id) }

        const { data: p } = await supabase.from('playlists').select('id, nome, tipo').in('tipo', ['vinheta', 'comercial'])
        if (p) { setPlaylists(p); if (p.length > 0) setPlaylistId(p[0].id) }
    }

    const toggleDia = (dia: number) => {
        setDias(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort())
    }

    async function adicionarRegra(e: React.FormEvent) {
        e.preventDefault()

        // NOVO: Validação do nome
        if (!nomeRegra.trim()) return toast.error('Dê um nome para esta regra')

        const isAudio = tipoItem === 'audio_unico'
        if (isAudio && !audioId) return toast.error('Selecione um áudio')
        if (!isAudio && !playlistId) return toast.error('Selecione um bloco')

        const payload = {
            nome: nomeRegra.trim(), // NOVO: Injetando o nome no banco
            tipo_item: tipoItem,
            audio_id: isAudio ? audioId : null,
            playlist_id: !isAudio ? playlistId : null,
            estrategia,
            tocar_a_cada_x_musicas: estrategia === 'intervalo' ? parseInt(intervalo) : null,
            tocar_na_hora_exata: estrategia === 'hora_exata' ? horaExata : null,
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            dias_semana: dias,
            limite_itens: !isAudio && tipoLimite === 'itens' ? parseInt(valorLimite) : null,
            limite_minutos: !isAudio && tipoLimite === 'minutos' ? parseInt(valorLimite) : null,
        }

        const { error } = await supabase.from('regras_programacao').insert([payload])
        if (error) {
            toast.error('Erro ao salvar regra')
        } else {
            toast.success('Regra Ativada!')
            setNomeRegra('') // Limpa o campo após salvar
            carregarDados()
        }
    }

    async function deletarRegra(id: string) {
        if (!confirm('Remover esta automação?')) return
        await supabase.from('regras_programacao').delete().eq('id', id)
        toast.success('Regra removida!'); carregarDados()
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <Toaster />
            <h1 className="text-3xl font-bold text-text-main flex items-center gap-2"><ShieldAlert className="text-primary" /> Cérebro do AutoDJ</h1>

            <form onSubmit={adicionarRegra} className="bg-surface p-6 rounded-2xl shadow-sm border border-border space-y-6">

                {/* NOVO: CAMPO DE NOME DA REGRA */}
                <div className="border-b border-border pb-6">
                    <h3 className="text-lg font-bold text-text-main mb-4 border-l-4 border-primary pl-2">Identificação da Regra</h3>
                    <div className="relative max-w-2xl">
                        <Tag className="absolute left-3 top-3 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Ex: Break Comercial da Tarde, Vinheta a cada 3 músicas..."
                            value={nomeRegra}
                            onChange={(e) => setNomeRegra(e.target.value)}
                            className="w-full p-2 pl-10 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary font-bold"
                        />
                    </div>
                </div>

                {/* PARTE 1: O QUE E QUANDO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-border pb-6">
                    <div>
                        <h3 className="text-lg font-bold text-text-main mb-4 border-l-4 border-primary pl-2">1. O que vai ser injetado?</h3>
                        <div className="space-y-3">
                            <select value={tipoItem} onChange={e => setTipoItem(e.target.value as any)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none font-bold">
                                <option value="audio_unico">🎵 Apenas 1 Áudio Fixo (Ex: Vinheta Rápida)</option>
                                <option value="playlist">📂 Um Bloco de Áudios (Ex: Comerciais)</option>
                            </select>

                            {tipoItem === 'audio_unico' ? (
                                <select value={audioId} onChange={e => setAudioId(e.target.value)} className="w-full p-2 border border-border bg-background text-text-muted rounded-lg outline-none">
                                    {audios.map(a => <option key={a.id} value={a.id}>[{a.tipo.toUpperCase()}] {a.titulo}</option>)}
                                </select>
                            ) : (
                                <div className="space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/20">
                                    <select value={playlistId} onChange={e => setPlaylistId(e.target.value)} className="w-full p-2 border border-border bg-background text-text-muted rounded-lg outline-none">
                                        {playlists.map(p => <option key={p.id} value={p.id}>[{p.tipo.toUpperCase()}] {p.nome}</option>)}
                                    </select>

                                    {/* LIMITADORES DE BLOCO (A MÁGICA) */}
                                    <div>
                                        <label className="block text-xs font-bold text-text-main mb-1">Como o AutoDJ deve processar este bloco?</label>
                                        <div className="flex gap-2 items-center">
                                            <select value={tipoLimite} onChange={e => setTipoLimite(e.target.value as any)} className="flex-1 p-2 border border-border bg-background text-text-main rounded-lg outline-none text-sm">
                                                <option value="completo">Tocar o bloco inteiro</option>
                                                <option value="itens">Sortear X propagandas do bloco</option>
                                                <option value="minutos">Tocar no máximo X minutos do bloco</option>
                                            </select>
                                            {tipoLimite !== 'completo' && (
                                                <input type="number" min="1" value={valorLimite} onChange={e => setValorLimite(e.target.value)} className="w-20 p-2 border border-border bg-background text-text-main rounded-lg outline-none text-center" placeholder="X" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-text-main mb-4 border-l-4 border-primary pl-2">2. Qual o Gatilho?</h3>
                        <div className="space-y-3">
                            <select value={estrategia} onChange={e => setEstrategia(e.target.value as any)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none font-bold">
                                <option value="intervalo">🕒 Injetar a cada intervalo de músicas</option>
                                <option value="hora_exata">⏰ Injetar numa hora cravada</option>
                            </select>

                            {estrategia === 'intervalo' ? (
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">A cada quantas músicas?</label>
                                    <input type="number" min="1" value={intervalo} onChange={e => setIntervalo(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none" />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">Hora exata (Ex: 15:00 Break Comercial)</label>
                                    <input type="time" value={horaExata} onChange={e => setHoraExata(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* PARTE 2: VALIDADE */}
                <div>
                    <h3 className="text-sm font-bold text-text-main mb-3">3. Em quais horários e dias essa regra é válida?</h3>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex gap-2 items-center bg-background p-2 rounded-lg border border-border">
                            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="p-1 bg-transparent text-text-main outline-none text-sm font-mono" />
                            <span className="text-text-muted text-sm font-bold">até</span>
                            <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className="p-1 bg-transparent text-text-main outline-none text-sm font-mono" />
                        </div>

                        <div className="flex gap-1 flex-1">
                            {DIAS_NOME.map((dia, index) => (
                                <button type="button" key={index} onClick={() => toggleDia(index)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${dias.includes(index) ? 'bg-primary text-white shadow-sm' : 'bg-background text-text-muted border border-border'}`}>
                                    {dia}
                                </button>
                            ))}
                        </div>

                        <button type="submit" className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-md">
                            <Plus size={18} /> Ligar Regra
                        </button>
                    </div>
                </div>
            </form>

            {/* LISTAGEM DE REGRAS ATIVAS */}
            <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-background border-b border-border text-text-muted uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Regra / Conteúdo</th>
                            <th className="p-4">Gatilho</th>
                            <th className="p-4">Validade</th>
                            <th className="p-4 text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {regras.map(r => (
                            <tr key={r.id} className="hover:bg-background transition text-text-main">
                                <td className="p-4">
                                    {/* NOVO: Mostrando o Nome da Regra em Destaque */}
                                    <p className="font-extrabold text-sm text-primary mb-1">{r.nome}</p>
                                    <p className="font-semibold text-sm text-text-muted flex items-center gap-2">
                                        {r.tipo_item === 'audio_unico' ? `🎵 Áudio: ${r.audios?.titulo}` : `📂 Bloco: ${r.playlists?.nome}`}
                                    </p>
                                    {r.tipo_item === 'playlist' && (
                                        <p className="text-[11px] text-text-muted font-bold mt-1 uppercase bg-background inline-block px-2 py-0.5 rounded border border-border">
                                            Modo: {r.limite_itens ? `Sortear ${r.limite_itens} spots` : r.limite_minutos ? `Máx ${r.limite_minutos} min` : 'Tocar Bloco Completo'}
                                        </p>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded text-sm inline-flex items-center gap-2">
                                        {r.estrategia === 'intervalo' ? `🕒 A cada ${r.tocar_a_cada_x_musicas} músicas` : `⏰ Exatamente às ${r.tocar_na_hora_exata.slice(0, 5)}`}
                                    </span>
                                </td>
                                <td className="p-4 text-xs text-text-muted font-medium">
                                    <div className="flex flex-col gap-1">
                                        <span>Horário: {r.hora_inicio.slice(0, 5)} às {r.hora_fim.slice(0, 5)}</span>
                                        <span>Dias ativos: {r.dias_semana.length === 7 ? 'Todos os dias' : `${r.dias_semana.length} dias na semana`}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => deletarRegra(r.id)} className="p-2 bg-background border border-border text-text-muted hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-lg transition">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {regras.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-text-muted">Nenhuma regra ativa no momento.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}