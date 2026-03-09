'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { Upload, Trash2, CheckCircle2, AlertCircle, Loader2, Folder, Clock } from 'lucide-react'
import Link from 'next/link'

interface Pasta {
    id: string
    nome: string
    parent_id: string | null
}

interface FileBatch {
    id: string
    file: File
    titulo: string
    artista: string
    duracao_segundos: number // NOVO: Duração do arquivo em lote
    status: 'pendente' | 'uploading' | 'sucesso' | 'erro'
}

// Utilitário para formatar a duração na tabela
function formatarDuracao(segundos: number) {
    if (!segundos) return '--:--'
    const minutos = Math.floor(segundos / 60)
    const restoSegundos = Math.floor(segundos % 60)
    return `${minutos.toString().padStart(2, '0')}:${restoSegundos.toString().padStart(2, '0')}`
}

export default function UploadLote() {
    const [batch, setBatch] = useState<FileBatch[]>([])
    const [isProcessing, setIsProcessing] = useState(false)

    // Estados para as Pastas Virtuais
    const [pastas, setPastas] = useState<Pasta[]>([])
    const [pastaSelecionada, setPastaSelecionada] = useState<string>('')

    useEffect(() => {
        async function carregarPastas() {
            const { data } = await supabase.from('pastas').select('*').order('nome')
            if (data) setPastas(data)
        }
        carregarPastas()
    }, [])

    const parseFilename = (filename: string) => {
        const cleanName = filename.replace(/\.[^/.]+$/, "")
        if (cleanName.includes('-')) {
            const parts = cleanName.split('-')
            return { artista: parts[0].trim(), titulo: parts.slice(1).join('-').trim() }
        }
        return { artista: '', titulo: cleanName }
    }

    // MAGIA: Função assíncrona para extrair a duração de um File
    const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            const audioObj = document.createElement('audio')
            const objectUrl = URL.createObjectURL(file)

            audioObj.addEventListener('loadedmetadata', () => {
                resolve(Math.round(audioObj.duration))
                URL.revokeObjectURL(objectUrl)
            })

            audioObj.addEventListener('error', () => {
                resolve(0) // Fallback caso o navegador falhe ao ler o metadado
                URL.revokeObjectURL(objectUrl)
            })

            audioObj.src = objectUrl
        })
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return

        // Pega todos os ficheiros selecionados
        const filesArray = Array.from(e.target.files)

        // Cria uma promessa para processar cada ficheiro (extraindo metadados)
        const newFilesPromises = filesArray.map(async (file) => {
            const parsed = parseFilename(file.name)
            const duracao = await getAudioDuration(file) // Aguarda a leitura do tempo

            return {
                id: Math.random().toString(36).substring(2, 9),
                file,
                titulo: parsed.titulo,
                artista: parsed.artista,
                duracao_segundos: duracao,
                status: 'pendente' as const
            }
        })

        // Espera que todos os ficheiros sejam processados simultaneamente
        const newFiles = await Promise.all(newFilesPromises)
        setBatch(prev => [...prev, ...newFiles])
    }

    const updateField = (id: string, field: 'titulo' | 'artista', value: string) => {
        setBatch(batch.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const removeFile = (id: string) => setBatch(batch.filter(item => item.id !== id))

    const realizarUploadComTentativas = async (item: FileBatch, maxTentativas = 3) => {
        setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i))

        let tentativa = 0
        let sucesso = false

        while (tentativa < maxTentativas && !sucesso) {
            try {
                tentativa++

                // 1. Envia para a API (Google Drive)
                const formData = new FormData()
                formData.append('file', item.file)

                const uploadResponse = await fetch('/api/upload-drive', {
                    method: 'POST',
                    body: formData
                })

                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json()
                    throw new Error(errorData.error || 'Erro ao comunicar com o Google Drive')
                }

                const { fileId } = await uploadResponse.json()

                // 2. Registra no Supabase com a pasta e a DURAÇÃO!
                const { error: dbError } = await supabase.from('audios').insert([{
                    titulo: item.titulo,
                    artista: item.artista || null,
                    tipo: 'musica',
                    caminho_arquivo: fileId,
                    ativo: true,
                    pasta_id: pastaSelecionada || null,
                    duracao_segundos: item.duracao_segundos // GRAVA O TEMPO EXATO NO BANCO
                }])
                if (dbError) throw dbError

                sucesso = true
                setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sucesso' } : i))

            } catch (err: any) {
                console.error(`Tentativa ${tentativa} falhou para ${item.titulo}:`, err.message)

                if (tentativa >= maxTentativas) {
                    setBatch(prev => prev.map(i => i.id === item.id ? { ...i, status: 'erro' } : i))
                    toast.error(`Falha no arquivo: ${item.titulo}`)
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1500 * tentativa))
                }
            }
        }
    }

    const processarUpload = async () => {
        const itensParaProcessar = batch.filter(item => item.status === 'pendente' || item.status === 'erro')
        if (itensParaProcessar.length === 0) return
        setIsProcessing(true)
        await Promise.all(itensParaProcessar.map(item => realizarUploadComTentativas(item)))
        setIsProcessing(false)
        toast.success('Fila de processamento finalizada!')
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Toaster />
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-text-main">Upload em Lote</h1>
                    <p className="text-text-muted">Envie dezenas de ficheiros. O sistema calculará a duração de cada um automaticamente.</p>
                </div>
                <Link href="/admin/audios" className="text-primary font-bold hover:underline bg-primary/10 py-2 px-4 rounded-lg">
                    Voltar ao Acervo
                </Link>
            </div>

            {/* SELETOR DE PASTA DE DESTINO */}
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-4 items-center">
                <div className="w-full">
                    <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">Salvar os ficheiros na pasta:</label>
                    <div className="relative">
                        <Folder className="absolute left-4 top-3 text-primary/60" size={20} />
                        <select
                            value={pastaSelecionada}
                            onChange={e => setPastaSelecionada(e.target.value)}
                            className="w-full p-3 pl-12 border border-border bg-background text-text-main rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold cursor-pointer appearance-none"
                        >
                            <option value="">📁 Raiz (Acervo Principal)</option>
                            {pastas.map(p => (
                                <option key={p.id} value={p.id}>📁 {p.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ZONA DE DRAG & DROP */}
            <div className="border-2 border-dashed border-border p-10 rounded-2xl text-center bg-surface hover:border-primary hover:bg-primary/5 transition duration-300">
                <input type="file" multiple accept="audio/mpeg, audio/mp3, audio/wav" onChange={handleFileSelect} className="hidden" id="fileInput" />
                <label htmlFor="fileInput" className="cursor-pointer space-y-3 flex flex-col items-center">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Upload size={32} className="text-primary" />
                    </div>
                    <span className="font-bold text-text-main text-lg">Clique ou arraste os ficheiros de áudio aqui</span>
                    <span className="text-sm text-text-muted font-medium">Os metadados (título, artista e duração) serão extraídos instantaneamente.</span>
                </label>
            </div>

            {/* LISTA DE PROCESSAMENTO */}
            {batch.length > 0 && (
                <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="p-4 bg-background border-b border-border flex justify-between items-center">
                        <span className="font-bold text-text-main">{batch.length} ficheiros na fila</span>
                        <button
                            onClick={() => setBatch([])}
                            disabled={isProcessing}
                            className="text-sm font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                            Limpar Fila
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-surface border-b border-border text-text-muted uppercase text-xs font-bold">
                                <tr>
                                    <th className="p-4 w-1/5">Ficheiro Original</th>
                                    <th className="p-4 w-1/4">Título</th>
                                    <th className="p-4 w-1/5">Artista</th>
                                    <th className="p-4 text-center">Duração</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {batch.map(item => (
                                    <tr key={item.id} className="text-text-main hover:bg-background transition">
                                        <td className="p-4">
                                            <p className="text-sm font-mono text-text-muted truncate max-w-[150px]" title={item.file.name}>{item.file.name}</p>
                                        </td>
                                        <td className="p-4">
                                            <input type="text" value={item.titulo} onChange={e => updateField(item.id, 'titulo', e.target.value)} disabled={item.status === 'sucesso' || item.status === 'uploading'} className="w-full bg-background p-2 rounded-lg border border-border focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 text-sm font-medium" />
                                        </td>
                                        <td className="p-4">
                                            <input type="text" value={item.artista} onChange={e => updateField(item.id, 'artista', e.target.value)} disabled={item.status === 'sucesso' || item.status === 'uploading'} className="w-full bg-background p-2 rounded-lg border border-border focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 text-sm font-medium" />
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-xs font-mono font-bold text-text-muted bg-surface px-2 py-1 rounded-md border border-border flex items-center justify-center gap-1 max-w-max mx-auto">
                                                <Clock size={12} /> {formatarDuracao(item.duracao_segundos)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {item.status === 'pendente' && <span className="text-xs font-bold text-text-muted bg-background border border-border px-3 py-1.5 rounded-full shadow-sm">Aguardando</span>}
                                            {item.status === 'uploading' && <div className="flex justify-center"><Loader2 className="animate-spin text-primary" size={20} /></div>}
                                            {item.status === 'sucesso' && <div className="flex justify-center"><CheckCircle2 className="text-green-500" size={20} /></div>}
                                            {item.status === 'erro' && (
                                                <button onClick={() => realizarUploadComTentativas(item)} className="text-red-500 hover:text-red-700 flex flex-col items-center justify-center mx-auto transition-transform hover:scale-105" title="Tentar novamente">
                                                    <AlertCircle size={20} />
                                                    <span className="text-[10px] uppercase font-bold mt-1">Repetir</span>
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => removeFile(item.id)} disabled={item.status === 'uploading'} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-20">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-6 border-t border-border flex justify-end bg-background">
                        <button onClick={processarUpload} disabled={isProcessing} className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-primary/20">
                            {isProcessing && <Loader2 className="animate-spin" size={18} />}
                            {isProcessing ? 'Enviando para o Drive...' : 'Confirmar Upload em Lote'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}