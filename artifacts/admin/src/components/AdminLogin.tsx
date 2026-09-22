import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  onLogin: () => void;
};

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !data.user) {
      setLoading(false);
      setError("E-posta veya şifre hatalı.");
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id, role, is_active, two_factor_enabled")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !admin || !admin.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Bu hesap Yönetim Merkezi'ne yetkili değil.");
      return;
    }

    setLoading(false);
    onLogin();
  }

  return (
    <div className="loginPage">
      <form className="loginCard" onSubmit={handleSubmit}>
        <div className="loginLogo">A</div>

        <h1>AkılCEP</h1>
        <p>Yönetim Merkezi</p>

        <label>E-posta</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Yönetici e-postası"
          autoComplete="email"
          required
        />

        <label>Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <div className="loginError">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Yönetim Paneline Gir"}
        </button>
      </form>
    </div>
  );
}
