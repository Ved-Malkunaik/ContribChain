import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Suspense } from 'react'

async function TodosList() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul className="space-y-2">
      {todos?.map((todo: { id: string | number; name?: string }) => (
        <li key={todo.id} className="p-3 bg-[#111113] border border-[#27272a] rounded-lg">
          {todo.name}
        </li>
      ))}
      {(!todos || todos.length === 0) && (
        <li className="text-zinc-500 text-sm">No todos returned yet from Supabase `todos` table.</li>
      )}
    </ul>
  )
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#000000] text-white p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Supabase SSR Todos</h1>
        <Suspense fallback={<p className="text-zinc-500 text-sm">Loading todos…</p>}>
          <TodosList />
        </Suspense>
      </div>
    </div>
  )
}

