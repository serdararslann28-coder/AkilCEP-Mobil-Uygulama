import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Admin access token gerekli.",
      });
      return;
    }

    if (!supabase) {
      res.status(503).json({
        error: "AdminAuthNotConfigured",
        message: "Supabase authentication yapılandırılmamış.",
      });
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: "InvalidToken",
        message: "Geçersiz veya süresi dolmuş oturum.",
      });
      return;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      res.status(403).json({
        error: "Forbidden",
        message: "Bu hesap admin yetkisine sahip değil.",
      });
      return;
    }

    (
      req as Request & {
        adminUser?: { id: string; email: string };
      }
    ).adminUser = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("[admin-auth]", error);

    res.status(500).json({
      error: "AdminAuthError",
      message: "Admin doğrulaması sırasında hata oluştu.",
    });
  }
}
