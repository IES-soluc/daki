import '@/app/globals.css'
import { cache } from 'react'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { ConfigProvider } from '@/components/ConfigProvider'

// 1. Interface alinhada
export interface ConfigData {
    nome_radio: string;
    descricao_radio: string;
    texto_rodape: string;
    cor_primaria: string;
    cor_secundaria: string;
    cor_fundo: string;
    cor_superficie: string;
    cor_texto: string;
    cor_texto_secundario: string;
    fonte_principal: string;
    url_logo: string | null;
    url_favicon: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    youtube: string | null;
}

// 2. Cache e Busca
const getGlobalConfig = cache(async (): Promise<ConfigData> => {
    try {
        const { data, error } = await supabase.from('configuracoes').select('*').single()
        if (error || !data) throw new Error('Erro ao buscar configurações')
        return data
    } catch (err) {
        return {
            nome_radio: 'Nossa Web Rádio', descricao_radio: 'Rádio 24h', texto_rodape: 'Transmissão 24h',
            cor_primaria: '#10b981', cor_secundaria: '#0f172a', cor_fundo: '#f8fafc', cor_superficie: '#ffffff',
            cor_texto: '#1e293b', cor_texto_secundario: '#64748b', fonte_principal: 'Inter',
            url_logo: null, url_favicon: null, whatsapp: null, instagram: null, facebook: null, youtube: null
        }
    }
})

// 3. SEO Básico
export async function generateMetadata(): Promise<Metadata> {
    const config = await getGlobalConfig()
    return {
        title: { default: config.nome_radio, template: `%s | ${config.nome_radio}` },
        description: config.descricao_radio,
        icons: { icon: config.url_favicon || '/favicon.ico' },
    }
}

// 4. Estrutura Raiz Limpa (Apenas Provedores e CSS)
export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const config = await getGlobalConfig()
    const fontUrlName = config.fonte_principal.replace(/ /g, '+')

    const customCSS = `
    :root {
      --primary: ${config.cor_primaria};
      --secondary: ${config.cor_secundaria};
      --background: ${config.cor_fundo};
      --surface: ${config.cor_superficie};
      --text-main: ${config.cor_texto};
      --text-muted: ${config.cor_texto_secundario};
      --font-main: '${config.fonte_principal}', sans-serif;
    }
    .dark { 
      --primary: ${config.cor_primaria}; 
      --secondary: ${config.cor_secundaria};
    }
    `

    return (
        <html lang="pt-BR" className="light">
            <head>
                <style dangerouslySetInnerHTML={{ __html: customCSS }} />
                <link href={`https://fonts.googleapis.com/css2?family=${fontUrlName}:wght@400;600;800;900&display=swap`} rel="stylesheet" />
            </head>
            {/* Removemos o pb-24 daqui, pois os widgets não terão o player fixo no rodapé */}
            <body className="bg-background text-text-main font-main antialiased min-h-screen transition-colors duration-300">
                <ConfigProvider config={config}>
                    {children}
                </ConfigProvider>
            </body>
        </html>
    )
}