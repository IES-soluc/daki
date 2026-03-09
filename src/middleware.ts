import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    // Cria uma resposta inicial
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Inicializa o cliente Supabase para o Middleware
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    // BLINDAGEM: Usamos getUser() em vez de getSession().
    // O getUser() vai ao servidor do Supabase confirmar se o token ainda é válido,
    // garantindo que não há falsos positivos causados por cookies antigos no navegador.
    const { data: { user } } = await supabase.auth.getUser()

    const isLoginRoute = request.nextUrl.pathname.startsWith('/login')
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

    // LOG DE DIAGNÓSTICO (Olhe para o terminal após salvar)
    console.log(`[Middleware] Rota: ${request.nextUrl.pathname} | Autenticado: ${!!user}`);

    // PROTEÇÃO: Tentar aceder ao Admin sem estar logado
    if (isAdminRoute && !user) {
        console.log("[Middleware] Acesso negado. Redirecionando para login.");
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // PROTEÇÃO: Tentar aceder ao Login já estando logado
    if (isLoginRoute && user) {
        console.log("[Middleware] Utilizador já logado. Redirecionando para admin.");
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    return response
}

export const config = {
    // Define exatamente quais caminhos o Middleware deve vigiar
    // Adicionei '/' caso você queira vigiar a raiz também, mas o principal é o /admin e o /login
    matcher: ['/admin/:path*', '/login'],
}