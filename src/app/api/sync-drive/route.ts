import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST() {
    try {
        const cookieStore = await cookies()

        // 1. Prepara o acesso autenticado ao Supabase
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value }
                }
            }
        )

        // 2. Autenticação no Google Drive
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_DRIVE_CLIENT_ID,
            process.env.GOOGLE_DRIVE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN })
        const drive = google.drive({ version: 'v3', auth: oauth2Client })

        // 3. Busca todos os IDs que JÁ ESTÃO no banco para não duplicar
        const { data: audiosExistentes, error: dbError } = await supabase.from('audios').select('caminho_arquivo')
        if (dbError) throw new Error('Erro ao ler banco de dados.')

        const idsExistentes = new Set(audiosExistentes?.map(a => a.caminho_arquivo) || [])

        // 4. Puxa a lista do Google Drive (AGORA PEDINDO O TAMANHO EM BYTES)
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
        let queryDrive = "mimeType contains 'audio/' and trashed = false"

        if (folderId) {
            queryDrive += ` and '${folderId}' in parents`
        }

        const response = await drive.files.list({
            q: queryDrive,
            fields: 'files(id, name, mimeType, size)', // <-- Mudança aqui: 'size' em vez do metadado
            pageSize: 1000
        })

        const arquivosDrive = response.data.files || []
        let adicionados = 0
        const novosAudios = []

        // 5. Compara e prepara a injeção dos arquivos novos
        for (const file of arquivosDrive) {
            if (file.id && !idsExistentes.has(file.id)) {

                // Tratamento do Nome e Artista
                let tituloLimpo = file.name?.replace(/\.[^/.]+$/, "") || "Áudio Desconhecido"
                let artista = "Artista Desconhecido"

                if (tituloLimpo.includes(" - ")) {
                    const partes = tituloLimpo.split(" - ")
                    artista = partes[0].trim()
                    tituloLimpo = partes[1].trim()
                }

                // O CÁLCULO MÁGICO DA DURAÇÃO:
                // Divide o peso total do ficheiro por 16.000 bytes (média de 1 segundo de mp3 a 128kbps)
                let duracaoEmSegundos = null;
                if (file.size) {
                    duracaoEmSegundos = Math.round(Number(file.size) / 16000);
                }

                novosAudios.push({
                    titulo: tituloLimpo,
                    artista: artista,
                    tipo: 'musica',
                    caminho_arquivo: file.id,
                    ativo: true,
                    pasta_id: null,
                    duracao_segundos: duracaoEmSegundos // Agora vai salvar a estimativa calculada!
                })
                adicionados++
            }
        }

        // 6. Salva tudo de uma vez (Bulk Insert) no Supabase
        if (novosAudios.length > 0) {
            const { error: insertError } = await supabase.from('audios').insert(novosAudios)
            if (insertError) throw new Error('Erro ao salvar novos áudios no banco.')
        }

        return NextResponse.json({ success: true, adicionados })

    } catch (error: any) {
        console.error("Erro no Sync:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}