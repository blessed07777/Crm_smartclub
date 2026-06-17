import { GraduationCap, Database } from 'lucide-react';

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="card max-w-2xl w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-brand-600 text-white rounded-xl p-2"><GraduationCap size={28} /></div>
          <div>
            <h1 className="font-bold text-xl">SmartClub CRM</h1>
            <p className="text-sm text-slate-500">Подключите Supabase, чтобы начать работу</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <p>
            1. Создайте проект на <a className="text-brand-600 underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>
          </p>
          <p>
            2. Откройте <b>SQL Editor</b> и выполните миграцию <code className="bg-slate-100 px-1.5 py-0.5 rounded">supabase/migrations/0001_init.sql</code>
          </p>
          <p>
            3. Скопируйте <b>Project URL</b> и <b>anon key</b> из <i>Project Settings → API</i>
          </p>
          <p>
            4. Создайте файл <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env</code> в корне проекта:
          </p>

          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>

          <p>5. Перезапустите dev-сервер: <code className="bg-slate-100 px-1.5 py-0.5 rounded">npm run dev</code></p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
          <Database size={14} />
          После настройки Supabase эта страница исчезнет автоматически.
        </div>
      </div>
    </div>
  );
}
