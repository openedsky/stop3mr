import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { logAudit } from "./audit";
import { AppRole } from "./roles";
import { passwordFingerprint } from "./security";
import { rateLimitPersistent } from "./rate-limit";
import "./env";

declare module "next-auth" {
  interface User {
    id: string;
    role: AppRole;
    identifiant: string;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
      identifiant: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    identifiant: string;
    invalid?: boolean;
    pwdFp?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifiant: { label: "Identifiant", type: "text" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifiant || !credentials?.motDePasse) {
          return null;
        }

        const loginKey = `login:${credentials.identifiant.toLowerCase()}`;
        const rl = await rateLimitPersistent(loginKey, 5, 15 * 60 * 1000);
        if (!rl.success) {
          throw new Error("Trop de tentatives. Réessayez dans 15 minutes.");
        }

        const user = await prisma.utilisateur.findUnique({
          where: { identifiant: credentials.identifiant },
        });

        if (!user || !user.actif) {
          await bcrypt.compare(
            credentials.motDePasse,
            "$2b$12$wahqxeF6yJ0c59tf2.N7Bu5C5H1fMFFbE7q9sQ1ojsw.L3Bh5U71S"
          );
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.motDePasse,
          user.motDePasseHash
        );

        if (!valid) {
          await logAudit({
            utilisateurId: user.id,
            action: "CONNEXION_ECHOUEE",
            cible: user.identifiant,
          });
          return null;
        }

        await logAudit({
          utilisateurId: user.id,
          action: "CONNEXION",
          cible: user.identifiant,
        });

        return {
          id: String(user.id),
          identifiant: user.identifiant,
          role: user.role,
          name: [user.prenom, user.nom].filter(Boolean).join(" ") || user.identifiant,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.identifiant = user.identifiant;
        token.invalid = false;
        const db = await prisma.utilisateur.findUnique({
          where: { id: Number(user.id) },
          select: { motDePasseHash: true },
        });
        if (db) token.pwdFp = passwordFingerprint(db.motDePasseHash);
      }

      if (token.id && !user) {
        const id = Number(token.id);
        const dbUser = await prisma.utilisateur.findUnique({
          where: { id },
          select: {
            actif: true,
            role: true,
            identifiant: true,
            prenom: true,
            nom: true,
            motDePasseHash: true,
          },
        });

        if (!dbUser || !dbUser.actif) {
          token.invalid = true;
          return token;
        }

        if (token.pwdFp && token.pwdFp !== passwordFingerprint(dbUser.motDePasseHash)) {
          token.invalid = true;
          return token;
        }

        token.role = dbUser.role as typeof token.role;
        token.identifiant = dbUser.identifiant;
        token.name = [dbUser.prenom, dbUser.nom].filter(Boolean).join(" ") || dbUser.identifiant;
        token.pwdFp = passwordFingerprint(dbUser.motDePasseHash);
      }

      return token;
    },
    async session({ session, token }) {
      if (token.invalid || !token.id) {
        session.expires = "1970-01-01T00:00:00.000Z";
        return session;
      }
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.identifiant = token.identifiant;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") === true,
};
