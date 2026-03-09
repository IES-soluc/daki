'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { useConfig } from '@/components/ConfigProvider' // <-- Importando nosso cérebro de configurações

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    // Puxando os dados dinâmicos da marca
    const { nome_radio, url_logo } = useConfig()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            toast.error('Erro no login: ' + error.message)
            setLoading(false)
        } else {
            toast.success('Acesso autorizado!')
            // 1. Refresh limpa o cache do servidor para o Middleware ver o cookie
            router.refresh()
            // 2. Redireciona para o admin
            setTimeout(() => router.push('/admin/audios'), 100)
        }
    }

    return (
        // Substituímos bg-gray-900 por bg-background para seguir o tema
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Toaster />

            {/* Substituímos bg-white por bg-surface e adicionamos bordas dinâmicas */}
            <form onSubmit={handleLogin} className="w-full max-w-md p-8 bg-surface rounded-3xl shadow-2xl border border-border">

                <div className="flex flex-col items-center mb-8">
                    {/* Se o cliente fez upload da logo, exibimos ela. Se não, mostramos um ícone estiloso com a inicial do nome da rádio */}
                    {url_logo ? (
                        <img src={url_logo} alt={`Logo ${nome_radio}`} className="h-20 object-contain mb-4" />
                    ) : (
                        <div className="h-20 w-20 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20 rotate-3">
                            <span className="text-4xl text-white font-black">{nome_radio.charAt(0)}</span>
                        </div>
                    )}

                    <h1 className="text-2xl font-black text-text-main text-center">
                        Acesso Restrito
                    </h1>
                    <p className="text-sm font-bold text-text-muted mt-1 uppercase tracking-widest">{nome_radio}</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-text-muted mb-2">E-mail de Acesso</label>
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            className="w-full p-4 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-text-muted mb-2">Senha</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full p-4 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary bg-background text-text-main transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Substituímos o botão verde fixo pela nossa cor primária com efeitos de sombra do Tailwind */}
                <button
                    disabled={loading}
                    className="w-full mt-8 bg-primary hover:opacity-90 text-white p-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition shadow-lg shadow-primary/30"
                >
                    {loading ? 'Verificando...' : 'Entrar no Sistema'}
                </button>
            </form>
        </div>
    )
}