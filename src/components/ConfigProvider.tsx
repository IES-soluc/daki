'use column'
'use client'
import { createContext, useContext, ReactNode } from 'react'

// 1. Interface expandida com TODOS os campos da nossa tabela
export interface ConfigData {
    nome_radio: string;
    descricao_radio: string;
    texto_rodape: string;
    url_logo: string | null;
    url_favicon: string | null;
    cor_primaria: string;
    cor_secundaria: string;
    cor_fundo: string;
    cor_superficie: string;
    cor_texto: string;
    cor_texto_secundario: string;
    fonte_principal: string;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    youtube: string | null;
}

// 2. Valores de segurança (Fallback) caso o banco falhe ou esteja vazio
const defaultValues: ConfigData = {
    nome_radio: 'Nossa Web Rádio',
    descricao_radio: 'A melhor programação da internet.',
    texto_rodape: 'Transmissão 24h',
    url_logo: null,
    url_favicon: null,
    cor_primaria: '#10b981',
    cor_secundaria: '#0f172a',
    cor_fundo: '#f8fafc',
    cor_superficie: '#ffffff',
    cor_texto: '#1e293b',
    cor_texto_secundario: '#64748b',
    fonte_principal: 'Inter',
    whatsapp: null,
    instagram: null,
    facebook: null,
    youtube: null
}

const ConfigContext = createContext<ConfigData>(defaultValues)

export function ConfigProvider({ children, config }: { children: ReactNode, config: Partial<ConfigData> | null }) {
    // 3. Mescla inteligente: junta os valores padrão com os que vieram do banco.
    // Isso garante que se o banco mandar 'null' para a cor_primaria, ele usa o verde padrão.
    const configAtualizada = { ...defaultValues, ...config }

    return (
        <ConfigContext.Provider value={configAtualizada as ConfigData}>
            {children}
        </ConfigContext.Provider>
    )
}

// Hook personalizado para os outros arquivos usarem facilmente
export const useConfig = () => useContext(ConfigContext)