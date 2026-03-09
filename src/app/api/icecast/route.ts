import { NextRequest } from 'next/server'

// Força a rota a ser dinâmica para manter a conexão aberta
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const icecastHost = process.env.ICECAST_HOST || 'localhost'
    const icecastPort = process.env.ICECAST_PORT || '8000'

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()

            // Função que busca os dados no Icecast e envia ao cliente
            const pushData = async () => {
                try {
                    const response = await fetch(`http://${icecastHost}:${icecastPort}/status-json.xsl`, {
                        headers: { 'Accept': 'application/json' },
                        cache: 'no-store' // Não queremos cache interno aqui, o SSE já é tempo real
                    })

                    if (response.ok) {
                        const data = await response.json()
                        // O formato 'data: {...}\n\n' é obrigatório no protocolo SSE
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                    }
                } catch (error) {
                    // Se o Icecast cair, enviamos um json vazio com erro para o player saber
                    controller.enqueue(encoder.encode(`data: {"error": "Icecast offline"}\n\n`))
                }
            }

            // Envia a primeira resposta imediatamente ao conectar
            await pushData()

            // Continua enviando a cada 10 segundos
            const intervalId = setInterval(pushData, 10000)

            // Limpeza: quando o ouvinte fechar o navegador, encerramos o loop no servidor
            req.signal.addEventListener('abort', () => {
                clearInterval(intervalId)
                controller.close()
            })
        }
    })

    // Retorna a resposta com os cabeçalhos específicos do SSE
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    })
}