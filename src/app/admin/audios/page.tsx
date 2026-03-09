'use client'
import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import {
    Upload, Headphones, Trash2, Search, Music, Mic, DollarSign,
    Loader2, Folder, FolderPlus, ChevronRight, Home, CornerUpLeft,
    Clock, RefreshCw, Edit2, X, Save
} from 'lucide-react'

// Interfaces para tipagem
interface Pasta {
    id: string
    nome: string
    parent_id: string | null
}

interface Audio {
    id: string
    titulo: string
    artista: string | null
    tipo: 'musica' | 'vinheta' | 'comercial' | 'efeito'
    caminho_arquivo: string
    pasta_id: string | null
    duracao_segundos: number | null
}

const supabase = createClient()

function formatarDuracao(segundos: number | null) {
    if (!segundos) return '--:--'
    const minutos = Math.floor(segundos / 60)
    const restoSegundos = Math.floor(segundos % 60)
    return `${minutos.toString().padStart(2, '0')}:${restoSegundos.toString().padStart(2, '0')}`
}

export default function GerenciarAudios() {
    // Estados do Acervo
    const [pastas, setPastas] = useState<Pasta[]>([])
    const [todasPastas, setTodasPastas] = useState<Pasta[]>([]) // Para o Modal de Mover
    const [audios, setAudios] = useState<Audio[]>([])

    // Navegação Virtual
    const [pastaAtual, setPastaAtual] = useState<Pasta | null>(null)
    const [historicoPastas, setHistoricoPastas] = useState<Pasta[]>([])

    // Estados de UI
    const [filtro, setFiltro] = useState('')
    const [deletandoId, setDeletandoId] = useState<string | null>(null)
    const [criandoPasta, setCriandoPasta] = useState(false)
    const [nomeNovaPasta, setNomeNovaPasta] = useState('')
    const [syncing, setSyncing] = useState(false)

    // Estados de Edição/Mover
    const [audioEditando, setAudioEditando] = useState<Audio | null>(null)
    const [salvandoEdicao, setSalvandoEdicao] = useState(false)

    // Estados de Upload
    const [arquivo, setArquivo] = useState<File | null>(null)
    const [titulo, setTitulo] = useState('')
    const [artista, setArtista] = useState('')
    const [tipo, setTipo] = useState<'musica' | 'vinheta' | 'comercial' | 'efeito'>('musica')
    const [duracao, setDuracao] = useState<number>(0)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        carregarConteudo(pastaAtual?.id || null)
        carregarTodasPastas() // Atualiza a lista completa de pastas para o select
    }, [pastaAtual])

    // =======================================================================
    // FUNÇÕES DE DADOS E NAVEGAÇÃO
    // =======================================================================

    async function carregarTodasPastas() {
        const { data } = await supabase.from('pastas').select('*').order('nome')
        if (data) setTodasPastas(data)
    }

    async function carregarConteudo(parentId: string | null) {
        let queryPastas = supabase.from('pastas').select('*').order('nome')
        if (parentId) queryPastas = queryPastas.eq('parent_id', parentId)
        else queryPastas = queryPastas.is('parent_id', null)

        let queryAudios = supabase.from('audios').select('*').order('created_at', { ascending: false })
        if (parentId) queryAudios = queryAudios.eq('pasta_id', parentId)
        else queryAudios = queryAudios.is('pasta_id', null)

        const [resPastas, resAudios] = await Promise.all([queryPastas, queryAudios])

        if (resPastas.data) setPastas(resPastas.data)
        if (resAudios.data) setAudios(resAudios.data)
    }

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

    // =======================================================================
    // SINCRONIZAÇÃO E UPLOAD
    // =======================================================================

    async function handleSyncDrive() {
        setSyncing(true)
        const toastId = toast.loading('Sincronizando com o Google Drive...')
        try {
            // Chamaremos a API que fará a varredura do Drive e atualizará o banco
            const res = await fetch('/api/sync-drive', { method: 'POST' })
            const result = await res.json()

            if (!res.ok) throw new Error(result.error || 'Erro desconhecido')

            toast.success(`Sincronização concluída! ${result.adicionados || 0} novos áudios encontrados.`, { id: toastId })
            carregarConteudo(pastaAtual?.id || null)
        } catch (error: any) {
            toast.error(`Falha ao sincronizar: ${error.message}`, { id: toastId })
        } finally {
            setSyncing(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setArquivo(file)
        if (file) {
            const audioObj = document.createElement('audio')
            const objectUrl = URL.createObjectURL(file)
            audioObj.addEventListener('loadedmetadata', () => {
                setDuracao(Math.round(audioObj.duration))
                URL.revokeObjectURL(objectUrl)
            })
            audioObj.src = objectUrl
            if (!titulo) setTitulo(file.name.replace(/\.[^/.]+$/, ""))
        } else {
            setDuracao(0)
        }
    }

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault()
        if (!arquivo) return toast.error('Selecione o ficheiro de áudio')
        if (!titulo) return toast.error('O título é obrigatório')

        // Bloqueio amigável de segurança para a Vercel
        if (arquivo.size > 4.5 * 1024 * 1024) {
            return toast.error('Arquivo muito grande! Envie direto pelo Google Drive e clique em "Sincronizar".')
        }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', arquivo)
            const uploadResponse = await fetch('/api/upload-drive', { method: 'POST', body: formData })
            if (!uploadResponse.ok) throw new Error('Erro ao comunicar com o Google Drive (Arquivo pode ser muito grande)')

            const { fileId } = await uploadResponse.json()
            const { error: dbError } = await supabase.from('audios').insert([{
                titulo, artista: tipo === 'musica' ? artista : null,
                tipo, caminho_arquivo: fileId, ativo: true,
                pasta_id: pastaAtual?.id || null, duracao_segundos: duracao
            }])

            if (dbError) throw dbError

            toast.success('Áudio adicionado com sucesso!')
            setTitulo(''); setArtista(''); setArquivo(null); setDuracao(0);
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) fileInput.value = ''
            carregarConteudo(pastaAtual?.id || null)
        } catch (err: any) {
            toast.error('Erro no upload: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    // =======================================================================
    // EDIÇÃO E EXCLUSÃO
    // =======================================================================

    async function salvarEdicaoAudio(e: React.FormEvent) {
        e.preventDefault()
        if (!audioEditando) return
        setSalvandoEdicao(true)

        try {
            const { error } = await supabase.from('audios').update({
                titulo: audioEditando.titulo,
                artista: audioEditando.tipo === 'musica' ? audioEditando.artista : null,
                tipo: audioEditando.tipo,
                pasta_id: audioEditando.pasta_id
            }).eq('id', audioEditando.id)

            if (error) throw error
            toast.success('Áudio atualizado e movido!')
            setAudioEditando(null)
            carregarConteudo(pastaAtual?.id || null)
        } catch (error: any) {
            toast.error('Erro ao atualizar: ' + error.message)
        } finally {
            setSalvandoEdicao(false)
        }
    }

    async function handleNovaPasta(e: React.FormEvent) {
        e.preventDefault()
        if (!nomeNovaPasta.trim()) return
        const { error } = await supabase.from('pastas').insert([{ nome: nomeNovaPasta.trim(), parent_id: pastaAtual?.id || null }])
        if (error) toast.error('Erro ao criar pasta.')
        else {
            toast.success('Pasta criada!')
            setNomeNovaPasta(''); setCriandoPasta(false); carregarConteudo(pastaAtual?.id || null); carregarTodasPastas();
        }
    }

    async function excluirAudio(id: string, fileId: string) {
        if (!confirm('Excluir este áudio permanentemente do sistema E do Google Drive?')) return
        setDeletandoId(id)
        try {
            if (fileId) await fetch(`/api/delete-drive?fileId=${fileId}`, { method: 'DELETE' })
            const { error } = await supabase.from('audios').delete().eq('id', id)
            if (error) throw error
            toast.success('Ficheiro destruído com sucesso!')
            carregarConteudo(pastaAtual?.id || null)
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message)
        } finally {
            setDeletandoId(null)
        }
    }

    async function excluirPasta(id: string) {
        if (!confirm('ATENÇÃO: Excluir esta pasta apagará TODOS os áudios e subpastas dentro dela no sistema (Google Drive não será limpo). Tem certeza absoluta?')) return
        setDeletandoId(id)
        try {
            const { error } = await supabase.from('pastas').delete().eq('id', id)
            if (error) throw error
            toast.success('Pasta e conteúdos removidos do banco de dados!')
            carregarConteudo(pastaAtual?.id || null)
            carregarTodasPastas()
        } catch (err: any) {
            toast.error('Erro ao excluir pasta: ' + err.message)
        } finally {
            setDeletandoId(null)
        }
    }

    // Filtros
    const pastasFiltradas = pastas.filter(p => p.nome.toLowerCase().includes(filtro.toLowerCase()))
    const audiosFiltrados = audios.filter(a => a.titulo.toLowerCase().includes(filtro.toLowerCase()) || (a.artista && a.artista.toLowerCase().includes(filtro.toLowerCase())))

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 relative">
            <Toaster />

            {/* MODAL DE EDIÇÃO / MOVER */}
            {audioEditando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <form onSubmit={salvarEdicaoAudio} className="bg-surface w-full max-w-md p-6 rounded-3xl shadow-2xl border border-border">
                        <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                            <h2 className="text-xl font-black text-text-main flex items-center gap-2"><Edit2 size={20} className="text-primary" /> Editar Áudio</h2>
                            <button type="button" onClick={() => setAudioEditando(null)} className="text-text-muted hover:text-red-500 transition p-1"><X size={24} /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-muted mb-1">Título</label>
                                <input type="text" value={audioEditando.titulo} onChange={e => setAudioEditando({ ...audioEditando, titulo: e.target.value })} className="w-full p-3 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">Tipo</label>
                                    <select value={audioEditando.tipo} onChange={e => setAudioEditando({ ...audioEditando, tipo: e.target.value as any })} className="w-full p-3 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold">
                                        <option value="musica">Música</option>
                                        <option value="vinheta">Vinheta</option>
                                        <option value="comercial">Comercial</option>
                                        <option value="efeito">Efeito</option>
                                    </select>
                                </div>
                                {audioEditando.tipo === 'musica' && (
                                    <div>
                                        <label className="block text-xs font-bold text-text-muted mb-1">Artista</label>
                                        <input type="text" value={audioEditando.artista || ''} onChange={e => setAudioEditando({ ...audioEditando, artista: e.target.value })} className="w-full p-3 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-text-muted mb-1">Mover para Pasta</label>
                                <select value={audioEditando.pasta_id || ''} onChange={e => setAudioEditando({ ...audioEditando, pasta_id: e.target.value || null })} className="w-full p-3 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary">
                                    <option value="">[ Raiz Principal ]</option>
                                    {todasPastas.map(p => (
                                        <option key={p.id} value={p.id}>📁 {p.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button type="submit" disabled={salvandoEdicao} className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50">
                            {salvandoEdicao ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </form>
                </div>
            )}

            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <h1 className="text-3xl font-bold text-text-main flex items-center gap-2">
                    <Headphones className="text-primary" /> Gestor de Acervo
                </h1>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={handleSyncDrive} disabled={syncing} className="flex-1 md:flex-none bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white border border-blue-500/20 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50">
                        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Buscando...' : 'Sincronizar Drive'}
                    </button>
                    <button onClick={() => setCriandoPasta(!criandoPasta)} className="flex-1 md:flex-none bg-surface border border-border text-text-main hover:text-primary font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm">
                        <FolderPlus size={18} /> Nova Pasta
                    </button>
                </div>
            </div>

            {/* BREADCRUMBS... (Sem alterações) */}
            <div className="flex items-center gap-2 text-sm font-bold text-text-muted bg-surface p-4 rounded-xl border border-border overflow-x-auto whitespace-nowrap shadow-sm">
                <button onClick={() => irParaCaminhoIndex(-1)} className="hover:text-primary transition flex items-center gap-1"><Home size={16} /> Raiz</button>
                {historicoPastas.map((p, idx) => (
                    <Fragment key={p.id}>
                        <ChevronRight size={16} className="opacity-50" />
                        <button onClick={() => irParaCaminhoIndex(idx)} className="hover:text-primary transition">{p.nome}</button>
                    </Fragment>
                ))}
                {pastaAtual && (
                    <Fragment>
                        <ChevronRight size={16} className="opacity-50" />
                        <span className="text-primary">{pastaAtual.nome}</span>
                    </Fragment>
                )}
            </div>

            {/* FORMULÁRIO RÁPIDO: NOVA PASTA (Sem alterações) */}
            {criandoPasta && (
                <form onSubmit={handleNovaPasta} className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-4">
                    <div className="flex-1 relative">
                        <Folder className="absolute left-3 top-3 text-primary/50" size={18} />
                        <input autoFocus type="text" placeholder="Nome da nova pasta..." value={nomeNovaPasta} onChange={e => setNomeNovaPasta(e.target.value)} className="w-full p-2 pl-10 border border-primary/30 bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary font-bold" />
                    </div>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary/90 transition">Criar</button>
                    <button type="button" onClick={() => setCriandoPasta(false)} className="bg-surface border border-border text-text-muted font-bold py-2 px-6 rounded-lg hover:bg-background transition">Cancelar</button>
                </form>
            )}

            {/* FORMULÁRIO DE UPLOAD */}
            <form onSubmit={handleUpload} className="bg-surface p-6 rounded-2xl shadow-sm border border-border space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-orange-500/10 text-orange-600 px-4 py-1 text-[10px] font-black uppercase rounded-bl-xl border-b border-l border-orange-500/20">
                    Músicas longas? Use o Google Drive
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border pb-4 pt-2">
                    <div>
                        <label className="block text-xs font-bold text-text-muted mb-1">Tipo de Áudio (Upload Rápido)</label>
                        <select value={tipo} onChange={e => { setTipo(e.target.value as any); if (e.target.value !== 'musica') setArtista('') }} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary font-bold">
                            <option value="vinheta">🎙️ Vinheta (Pequeno)</option>
                            <option value="comercial">💰 Comercial (Pequeno)</option>
                            <option value="efeito">⚡ Efeito (Pequeno)</option>
                            <option value="musica">🎵 Música Única</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <div className="flex justify-between items-end mb-1">
                            <label className="block text-xs font-bold text-text-muted">Ficheiro Local (Máx. 4.5MB)</label>
                            {duracao > 0 && <span className="text-xs font-bold text-primary flex items-center gap-1"><Clock size={12} /> {formatarDuracao(duracao)}</span>}
                        </div>
                        <input id="file-upload" type="file" accept="audio/*" onChange={handleFileChange} className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary/10 file:text-primary file:font-bold hover:file:bg-primary/20 cursor-pointer" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-text-muted mb-1">{tipo === 'musica' ? 'Nome da Música' : 'Nome de Identificação'}</label>
                        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary" placeholder="Digite o título..." />
                    </div>
                    {tipo === 'musica' && (
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Artista / Banda</label>
                            <input type="text" value={artista} onChange={e => setArtista(e.target.value)} className="w-full p-2 border border-border bg-background text-text-main rounded-lg outline-none focus:ring-2 focus:ring-primary" placeholder="Nome..." />
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <button type="submit" disabled={uploading} className="bg-primary text-white font-bold py-2 px-8 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2">
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'A enviar...' : `Salvar em ${pastaAtual ? pastaAtual.nome : 'Raiz'}`}
                    </button>
                </div>
            </form>

            {/* LISTAGEM */}
            <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-background flex justify-between items-center">
                    <div className="relative w-72">
                        <Search size={16} className="absolute left-3 top-3 text-text-muted" />
                        <input type="text" placeholder="Buscar na pasta atual..." value={filtro} onChange={e => setFiltro(e.target.value)} className="w-full p-2 pl-9 border border-border bg-surface text-text-main rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <span className="text-xs font-bold text-text-muted">{pastasFiltradas.length} pastas, {audiosFiltrados.length} áudios</span>
                </div>

                <table className="w-full text-left">
                    <tbody className="divide-y divide-border">
                        {pastaAtual && !filtro && (
                            <tr onClick={voltarPastaAcima} className="hover:bg-background transition cursor-pointer text-text-muted">
                                <td colSpan={5} className="p-4 font-bold flex items-center gap-3"><div className="p-2 bg-surface border border-border rounded-lg"><CornerUpLeft size={18} /></div>.. (Voltar para nível acima)</td>
                            </tr>
                        )}

                        {pastasFiltradas.map((pasta) => (
                            <tr key={pasta.id} className="hover:bg-background transition group">
                                <td colSpan={2} className="p-4 cursor-pointer w-1/2" onClick={() => entrarNaPasta(pasta)}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-primary"><Folder size={18} className="fill-primary/20" /></div>
                                        <div><p className="font-bold text-sm text-text-main group-hover:text-primary transition">{pasta.nome}</p></div>
                                    </div>
                                </td>
                                <td className="p-4 w-1/4"></td>
                                <td className="p-4 text-xs font-bold uppercase text-text-muted cursor-pointer" onClick={() => entrarNaPasta(pasta)}>Pasta</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => excluirPasta(pasta.id)} disabled={deletandoId === pasta.id} title="Excluir Pasta" className="p-2 bg-background border border-transparent hover:border-red-200 hover:bg-red-50 text-text-muted hover:text-red-500 rounded-lg transition disabled:opacity-50">
                                        {deletandoId === pasta.id ? <Loader2 size={16} className="animate-spin text-red-500" /> : <Trash2 size={16} />}
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {audiosFiltrados.map((audio) => (
                            <tr key={audio.id} className="hover:bg-background transition text-text-main group">
                                <td className="p-4 w-1/2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-background border border-border rounded-lg text-text-muted">
                                            {audio.tipo === 'musica' ? <Music size={18} /> : audio.tipo === 'vinheta' ? <Mic size={18} /> : <DollarSign size={18} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{audio.titulo}</p>
                                            {audio.artista && <p className="text-xs text-text-muted font-medium truncate">{audio.artista}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 w-1/4">
                                    <div className="flex items-center gap-1 text-xs font-mono font-medium text-text-muted">
                                        <Clock size={12} /> {formatarDuracao(audio.duracao_segundos)}
                                    </div>
                                </td>
                                <td className="p-4 text-xs font-bold uppercase text-primary/70">{audio.tipo}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    {/* BOTÃO EDITAR / MOVER */}
                                    <button onClick={() => setAudioEditando(audio)} title="Editar e Mover" className="p-2 bg-background border border-transparent hover:border-blue-200 hover:bg-blue-50 text-text-muted hover:text-blue-500 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => excluirAudio(audio.id, audio.caminho_arquivo)} disabled={deletandoId === audio.id} title="Excluir Áudio" className="p-2 bg-background border border-transparent hover:border-red-200 hover:bg-red-50 text-text-muted hover:text-red-500 rounded-lg transition disabled:opacity-50">
                                        {deletandoId === audio.id ? <Loader2 size={16} className="animate-spin text-red-500" /> : <Trash2 size={16} />}
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {pastasFiltradas.length === 0 && audiosFiltrados.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-text-muted font-medium">Nenhum ficheiro ou pasta encontrado aqui.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}