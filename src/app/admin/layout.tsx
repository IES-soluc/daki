import AdminSidebar from '@/components/AdminSidebar'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen bg-background overflow-hidden w-full">
            {/* O Player agora vive DENTRO do Sidebar! */}
            <AdminSidebar />

            {/* A área de conteúdo agora ocupa 100% da altura restante, sem precisar do pb-24 no fundo */}
            <main className="flex-1 overflow-y-auto w-full relative">
                {children}
            </main>
        </div>
    )
}