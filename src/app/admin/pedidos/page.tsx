'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import { Users, PlayCircle, XCircle, CheckCircle2, ListOrdered, Clock, History } from 'lucide-react'

export default function GestaoPedidos() {
    const [pedidos, setPedidos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        carregarPedidos()
        // Atualiza a tela a cada 15 segundos (bom para rádio ao vivo)
        const interval = setInterval(carregarPedidos, 15000)
        return () => clearInterval(interval)
    }, [])

    async function carregarPedidos() {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, audios(titulo, artista)')
            .order('updated_at', { ascending: true }) // Agora vai funcionar perfeitamente

        if (error) {
            console.error("Erro Supabase:", error)
            toast.error(`Erro ao carregar: ${error.message}`)
            setLoading(false)
            return
        }

        if (data) setPedidos(data)
        setLoading(false)
    }

    async function alterarStatus(id: string, novoStatus: 'aprovado' | 'tocado' | 'rejeitado') {
        // Ao aprovar, o updated_at é atualizado para AGORA, colocando a música na fila de prioridade
        const { error } = await supabase
            .from('pedidos')
            .update({ status: novoStatus, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            toast.error(`Erro ao atualizar: ${error.message}`)
        } else {
            toast.success(novoStatus === 'aprovado' ? 'Enviado para o AutoDJ!' : `Pedido marcado como ${novoStatus}`)
            carregarPedidos()
        }
    }

    // Divisão Inteligente dos Dados
    const filaAutoDJ = pedidos.filter(p => p.status === 'aprovado')
    const pendentes = pedidos.filter(p => p.status === 'pendente').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Mais recentes primeiro
    const historico = pedidos.filter(p => p.status === 'tocado' || p.status === 'rejeitado').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10) // Últimos 10

    if (loading) return <div className="p-10 text-center font-bold text-text-muted animate-pulse">Carregando central de ouvintes...</div>

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <Toaster />

            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-text-main flex items-center gap-2"><Users className="text-primary" /> Interação com Ouvintes</h1>
                    <p className="text-text-muted mt-1">Gerencie os pedidos e controle a fila de prioridade do AutoDJ.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUNA ESQUERDA: FILA DE PRIORIDADE DO AUTODJ */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-primary text-white p-4 rounded-t-2xl flex items-center justify-between shadow-md">
                        <h2 className="font-bold flex items-center gap-2"><ListOrdered size={20} /> Fila do AutoDJ</h2>
                        <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">{filaAutoDJ.length} na fila</span>
                    </div>

                    <div className="bg-surface rounded-b-2xl shadow-sm border border-border p-4 min-h-[400px] space-y-3">
                        <p className="text-xs text-text-muted text-center mb-4">Estas músicas irão furar a programação normal e tocarão em seguida, na ordem abaixo.</p>

                        {filaAutoDJ.map((p, index) => (
                            <div key={p.id} className="bg-background border border-border p-3 rounded-xl flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className="text-primary font-black text-lg w-4">{index + 1}º</span>
                                    <div>
                                        <p className="font-bold text-sm text-text-main line-clamp-1">{p.audios?.titulo}</p>
                                        <p className="text-xs text-text-muted flex items-center gap-1">
                                            👤 {p.nome_ouvinte}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => alterarStatus(p.id, 'rejeitado')}
                                    title="Tirar da fila"
                                    className="text-text-muted hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        ))}

                        {filaAutoDJ.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-2 pt-10">
                                <PlayCircle size={40} className="opacity-20" />
                                <p className="text-sm font-medium">A Fila de Pedidos está vazia.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: PEDIDOS PENDENTES E HISTÓRICO */}
                <div className="lg:col-span-2 space-y-8">

                    {/* SESSÃO: NOVOS PEDIDOS */}
                    <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                        <div className="p-4 border-b border-border bg-background flex items-center gap-2">
                            <Clock className="text-yellow-500" size={20} />
                            <h2 className="font-bold text-text-main">Novos Pedidos (Aguardando)</h2>
                        </div>

                        <table className="w-full text-left">
                            <tbody className="divide-y divide-border">
                                {pendentes.map(p => (
                                    <tr key={p.id} className="hover:bg-background transition text-text-main">
                                        <td className="p-4 w-1/3">
                                            <p className="font-bold text-sm">{p.nome_ouvinte}</p>
                                            {p.mensagem && <p className="text-xs text-text-muted italic mt-1 bg-surface p-2 rounded border border-border">"{p.mensagem}"</p>}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-semibold text-primary">{p.audios?.titulo}</p>
                                            <p className="text-xs text-text-muted">{p.audios?.artista}</p>
                                        </td>
                                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                                            <button
                                                onClick={() => alterarStatus(p.id, 'aprovado')}
                                                className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-bold text-xs transition inline-flex items-center gap-1"
                                            >
                                                <PlayCircle size={16} /> Tocar em Seguida
                                            </button>
                                            <button
                                                onClick={() => alterarStatus(p.id, 'rejeitado')}
                                                className="p-2 bg-background border border-border text-text-muted hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-lg transition inline-flex items-center"
                                                title="Rejeitar"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pendentes.length === 0 && (
                                    <tr><td colSpan={3} className="p-8 text-center text-text-muted">Nenhum pedido novo no momento.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* SESSÃO: HISTÓRICO RECENTE */}
                    <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                        <div className="p-4 border-b border-border bg-background flex items-center gap-2">
                            <History className="text-text-muted" size={20} />
                            <h2 className="font-bold text-text-main">Histórico Recente</h2>
                        </div>
                        <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-border">
                                {historico.map(p => (
                                    <tr key={p.id} className="text-text-muted">
                                        <td className="p-4"><span className="font-bold">{p.nome_ouvinte}</span> pediu <span className="text-text-main">{p.audios?.titulo}</span></td>
                                        <td className="p-4 text-right">
                                            {p.status === 'tocado' ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-1 rounded text-xs"><CheckCircle2 size={14} /> Tocado</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-1 rounded text-xs"><XCircle size={14} /> Rejeitado</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {historico.length === 0 && (
                                    <tr><td colSpan={2} className="p-6 text-center text-text-muted text-xs">O histórico está vazio.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    )
}