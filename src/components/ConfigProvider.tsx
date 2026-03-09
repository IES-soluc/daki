'use client'
import { createContext, useContext, ReactNode } from 'react'

// Define o formato dos dados que virão do banco
interface ConfigData {
    nome_radio: string;
    texto_rodape: string;
    url_logo: string | null;
}

const ConfigContext = createContext<ConfigData>({
    nome_radio: 'Nossa Web Rádio',
    texto_rodape: 'Transmissão 24h',
    url_logo: null
})

export function ConfigProvider({ children, config }: { children: ReactNode, config: ConfigData }) {
    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    )
}

// Hook personalizado para os outros arquivos usarem facilmente
export const useConfig = () => useContext(ConfigContext)