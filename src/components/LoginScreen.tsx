import { useState } from "react";
import { TrendingUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
              <Label htmlFor="username" className="text-gray-300">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite o usuário"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-gray-300">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <Button type="submit" className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
