import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const fileId = searchParams.get('fileId')

        if (!fileId) return NextResponse.json({ error: 'ID do ficheiro não fornecido.' }, { status: 400 })

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_DRIVE_CLIENT_ID,
            process.env.GOOGLE_DRIVE_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN })

        const drive = google.drive({ version: 'v3', auth: oauth2Client })

        await drive.files.delete({ fileId: fileId })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Erro ao apagar ficheiro no Drive:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}