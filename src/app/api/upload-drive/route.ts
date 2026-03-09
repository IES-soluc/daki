import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

function limparFolderId(idSujo: string): string {
    if (!idSujo) return '';
    let idLimpo = idSujo;
    if (idLimpo.includes('folders/')) idLimpo = idLimpo.split('folders/')[1];
    if (idLimpo.includes('?')) idLimpo = idLimpo.split('?')[0];
    return idLimpo.replace(/\/$/, '');
}

async function bufferToStream(buffer: ArrayBuffer) {
    const stream = new Readable()
    stream.push(Buffer.from(buffer))
    stream.push(null)
    return stream
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
        }

        // AQUI ESTÁ A MÁGICA: Autenticação OAuth2 (O seu Clone) em vez da Service Account
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_DRIVE_CLIENT_ID,
            process.env.GOOGLE_DRIVE_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        )

        // Injetamos a chave perpétua que você acabou de gerar
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
        })

        const drive = google.drive({ version: 'v3', auth: oauth2Client })

        const rawFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || ''
        const FOLDER_ID = limparFolderId(rawFolderId)

        const fileBuffer = await file.arrayBuffer()
        const media = {
            mimeType: file.type,
            body: await bufferToStream(fileBuffer),
        }

        // Faz o Upload consumindo a sua cota de 2TB
        const driveResponse = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: FOLDER_ID ? [FOLDER_ID] : [],
            },
            media: media,
            fields: 'id',
        })

        return NextResponse.json({ fileId: driveResponse.data.id })

    } catch (error: any) {
        console.error('Erro Crítico no Upload para o Drive:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}