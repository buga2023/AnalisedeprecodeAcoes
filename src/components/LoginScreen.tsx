import { useState } from "react";
import { TrendingUp, Lock } from "lucide-react";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username === "admin" && password === "1234") {
      onLogin();
    } else {
      setError("Usuário ou senha incorretos.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <div className="bg-blue-600 p-3 rounded-full">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Preço de Ações</h1>
          <p className="text-gray-400 text-sm">Faça login para continuar</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300 text-sm font-medium">Autenticação</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium text-gray-300">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                placeholder="Digite o usuário"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoFocus
                className="h-9 rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-sm text-white placeholder:text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Senha
              </label>
              <input
                id="password"
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="h-9 rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-sm text-white placeholder:text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
