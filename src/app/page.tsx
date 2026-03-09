import { redirect } from 'next/navigation'

export default function Home() {
    // Redireciona a raiz do site para o painel de administração da rádio
    redirect('/admin')
}